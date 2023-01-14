import _ from 'lodash';
import http from 'http';
import socketio from 'socket.io';

import ModelEventClient from './events/model-event-client';
import SimulationEvent from './events/simulation-event';
import SimulationEventSubscriber from './events/simulation-event-subscriber';

import ApiFactory from './api/api-factory';
import BusFactory from './bus/bus-factory';
import ConnectionManager from './connection-manager';

import ServerManager from './server-manager';

import AccountCache from '../account/account-cache';
import ActorCache from '../actor/actor-cache';
import ModelEventPublisher from './events/model-event-publisher';
import AccountSocketCache from '../account/account-socket-cache';
import ModelEventSubscriber from './events/model-event-subscriber';
import Actor from '../actor/actor';
import SimulationStateCache from '../simulation/simulation-state-cache';
import SimulationState from '../simulation/simulation-state';


export default class HttpServer {
  modelEventClient: ModelEventClient;
  modelEventPublisher: ModelEventPublisher;
  modelEventSubscriber: ModelEventSubscriber;

  simulationSubscriber: SimulationEventSubscriber;

  serverManager: ServerManager;

  accountCache: AccountCache;
  accountSocketCache: AccountSocketCache;
  simulationStateCache: SimulationStateCache;
  actorCache: ActorCache;

  running: boolean = false;

  connectionManager: ConnectionManager;

  server: http.Server;
  io: socketio.Server;


  constructor () {
    this.modelEventClient = new ModelEventClient();
    this.modelEventPublisher = new ModelEventPublisher();
    this.modelEventSubscriber = new ModelEventSubscriber(this.modelEventClient);

    this.simulationSubscriber = new SimulationEventSubscriber();

    this.serverManager = new ServerManager();

    this.accountCache = new AccountCache(this.modelEventClient.accountDao());
    this.accountSocketCache = new AccountSocketCache();
    this.simulationStateCache = new SimulationStateCache(this.modelEventClient.simulationStateDao());
    this.actorCache = new ActorCache(this.modelEventClient.actorDao());

    this.server = ApiFactory.create(this.serverManager, this.modelEventClient, this.accountCache);
    this.io = BusFactory.create(this.server);
    this.connectionManager = new ConnectionManager(this.io);

    this.configureEvents();
    this.loadCaches();
  }

  configureEvents () {
    this.server.on('connection', (socket) => this.connectionManager.handleConnection(socket));
    BusFactory.configureEvents(this.io, this.connectionManager, this.modelEventPublisher, this.accountSocketCache, this.simulationStateCache, this.actorCache);
    this.modelEventClient.events.on('disconnectSocket', (socketId) => this.connectionManager.disconnectSocket(socketId));
  }

  async loadCaches () {
    await this.accountCache.load();
    await this.simulationStateCache.load();
    await this.actorCache.load();
  }

  waitForSimulationState (finishCallback: Function): void {
    if (!this.accountCache.loaded && !this.simulationStateCache.loaded && !this.actorCache.loaded) {
      setTimeout(() => this.waitForSimulationState(finishCallback), 1000);
    }
    else {
      finishCallback();
    }
  }

  start (): void {
    this.connectionManager.start();
    this.modelEventClient.start();
    this.modelEventPublisher.start();
    this.modelEventSubscriber.start(this.accountCache, this.accountSocketCache);
    this.simulationSubscriber.start((event) => this.notifySocketsWithSimulation(event));

    this.waitForSimulationState(() => {
      this.server.listen(19160, () => {
        console.log('[HTTP Worker] Started on port 19160');
        this.running = true;
      });
    });
  }

  async stop (): Promise<void> {
    if (this.running) {
      this.running = false;
      console.log('[HTTP Worker] Stopping...');

      this.connectionManager.stop();
      await new Promise<void>((resolve: () => void, reject: (err: Error) => void) => this.io.close((err?: Error) => err ? reject(err) : resolve()));

      this.modelEventClient.stop();
      this.modelEventPublisher.stop();
      this.modelEventSubscriber.stop();
      this.simulationSubscriber.stop();

      await Promise.all([
        this.accountCache.close(),
        this.simulationStateCache.close(),
        this.actorCache.close()
      ]);

      console.log('[HTTP Worker] Stopped');
      process.exit();
    }
    else {
      console.log('[HTTP Worker] Already stopped');
      process.exit();
    }
  }

  async notifySocketsWithSimulation (event: SimulationEvent): Promise<void> {
    const info = this.connectionManager.connectionInformation();
    for (let socketId of info.disconnectableSocketIds) {
      await this.modelEventPublisher.disconnectSocket(socketId);
    }

    const state: SimulationState = this.simulationStateCache.update(event.state);
    const actors: Actor[] = <Actor[]> this.actorCache.update(event.updatedActors);

    for (const [accountId, socket] of Object.entries(info.connectedSocketsByAccountIds)) {
      const account = this.accountCache.forId(accountId);
      if (account) {
        socket.emit('simulation', {
          time: {
            simulationTime: state.simulationTime.toISO(),
            simulationTimeVelocity: state.simulationTimeVelocity,
            serverTime: state.serverTime
          },
          updatedActors: actors.map((j) => j.toJson())
        });
      }
    }
  }

}
