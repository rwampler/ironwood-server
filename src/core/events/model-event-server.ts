import { Publisher, Reply, Subscriber } from 'zeromq';

import Account from '../../account/account';
import AccountCache from '../../account/account-cache';
import ActorCache from '../../actor/actor-cache';
import AccountStore from '../../account/account-store';
import AccountTokenStore from '../../account/account-token-store';
import SimulationStateCache from '../../simulation/simulation-state-cache';

import Utils from '../../utils/utils';
import _ from 'lodash';

const SYNC_API_PORT = 19165;
const ASYNC_SERVER_TO_CLIENT_PORT = 19166;
const ASYNC_CLIENT_TO_SERVER_PORT = 19167;

const SOCKET_SUBSCRIBER_TOPICS = ['SOCKET:CONNECT', 'SOCKET:DISCONNECT', 'SOCKET:VIEW:SAVE'];


export default class ModelEventServer {
  running: boolean = false;

  replySocket: Reply;
  publisherSocket: Publisher;
  subscriberSocket: Subscriber;

  accountStore: AccountStore;
  accountTokenStore: AccountTokenStore;

  accountCache: AccountCache;
  actorCache: ActorCache;
  simulationStateCache: SimulationStateCache;

  constructor (accountStore: AccountStore, accountTokenStore: AccountTokenStore, accountCache: AccountCache, actorCache: ActorCache, simulationStateCache: SimulationStateCache) {
    this.running = false;
    this.replySocket = new Reply();
    this.publisherSocket = new Publisher();
    this.subscriberSocket = new Subscriber();

    this.accountStore = accountStore;
    this.accountTokenStore = accountTokenStore;

    this.accountCache = accountCache;
    this.actorCache = actorCache;
    this.simulationStateCache = simulationStateCache;
  }

  async start (): Promise<void> {
    try {
      await this.replySocket.bind(`tcp://127.0.0.1:${SYNC_API_PORT}`);
      console.log(`[Model Event Server] API Receiver started on port ${SYNC_API_PORT}`);

      await this.publisherSocket.bind(`tcp://127.0.0.1:${ASYNC_SERVER_TO_CLIENT_PORT}`);
      console.log(`[Model Event Server] Publisher started on port ${ASYNC_SERVER_TO_CLIENT_PORT}`);

      // this.subscriberSocket.connect(`tcp://127.0.0.1:${ASYNC_CLIENT_TO_SERVER_PORT}`);
      await this.subscriberSocket.bind(`tcp://127.0.0.1:${ASYNC_CLIENT_TO_SERVER_PORT}`);
      this.subscriberSocket.subscribe(...SOCKET_SUBSCRIBER_TOPICS);
      console.log(`[Model Event Server] Subscriber started on port ${ASYNC_CLIENT_TO_SERVER_PORT}`);

      this.running = true;

      this.receiveRequests();
      this.receiveNotifications();
    }
    catch (err) {
      if (this.running) {
        throw err;
      }
    }
  }

  stop (): void {
    this.running = false;
    console.log('[Model Event Server] Stopping...');

    this.replySocket.close();
    this.publisherSocket.close();
    this.subscriberSocket.close();

    console.log('[Model Event Server] Stopped');
  }

  async receiveRequests (): Promise<void> {
    for await (const [message] of this.replySocket) {
      const request = JSON.parse(message.toString());

      if (request.type == 'ACCOUNT:CREATE') {
        const account: Account = this.accountCache.loadAccount(await this.accountStore.set(Account.fromJson(request.payload)));
        await this.replySocket.send(JSON.stringify({ account: account.toJson() }))
        await this.publisherSocket.send(['ACCOUNT:UPDATE', JSON.stringify({ id: account.id })]);
      }
      else if (request.type == 'ACCOUNT:LIST') {
        await this.replySocket.send(JSON.stringify({ accounts: _.map(this.accountCache.all(), (a) => a.toJson()) }));
      }
      else if (request.type == 'ACCOUNT:GET') {
        const account: Account | null = this.accountCache.forId(request.accountId);
        await this.replySocket.send(JSON.stringify({ account: account?.toJson() }))
      }
      else if (request.type === 'TOKEN:ISSUE') {
        const token = await this.accountTokenStore.set(Utils.randomString(64), request.accountId);
        await this.replySocket.send(JSON.stringify({ token: token }));
      }
      else if (request.type === 'TOKEN:LOGIN') {
        const accountId = await this.accountTokenStore.consumeToken(request.tokenId);
        const account: Account | null = this.accountCache.forId(accountId);
        await this.replySocket.send(JSON.stringify({ account: account?.toJson() }));
      }
      else if (request.type === 'SIMULATION_STATE:GET') {
        await this.replySocket.send(JSON.stringify({ state: this.simulationStateCache.state.toJson() }));
      }
      else if (request.type === 'ACTOR:LIST') {
        await this.replySocket.send(JSON.stringify({ actors: _.map(this.actorCache.all(), (a) => a.toJson()) }));
      }


      else {
        console.log(`[Model Event Server] Unknown request type ${request.type}`);
      }
    }
  }

  async receiveNotifications (): Promise<void> {
    try {
      for await (const [topic, message] of this.subscriberSocket) {
        const request = JSON.parse(message.toString());
        const type = topic.toString();
        if (type === 'SOCKET:CONNECT') {
          await this.publisherSocket.send(['SOCKET:CONNECT', JSON.stringify({ accountId: request.accountId, socketId: request.socketId })]);
        }
        else if (type === 'SOCKET:DISCONNECT') {
          await this.publisherSocket.send(['SOCKET:DISCONNECT', JSON.stringify({ socketId: request.socketId })]);
        }
        else if (type === 'SOCKET:VIEW:SAVE') {
          const account: Account | null = this.accountCache.forId(request.accountId);
          if (account) {
            account.viewX = request.viewX;
            account.viewY = request.viewY;
            this.accountCache.update(account);
            await this.publisherSocket.send(['ACCOUNT:UPDATE', JSON.stringify({ id: account.id })]);
          }
        }
        else {
          console.log(`[Model Event Server] Unknown event topic ${topic}`);
        }
      }

      console.log(`[Model Event Server] Subscriber no longer listening`);
    }
    catch (err) {
      if (this.running) {
        throw err;
      }
    }
  }
}
