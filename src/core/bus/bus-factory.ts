import _ from 'lodash';
import express from 'express';
import http from 'http';
import passport from 'passport';
import socketio from 'socket.io';

import Account from '../../account/account';

import AccountSocketCache from '../../account/account-socket-cache';
import ActorCache from '../../actor/actor-cache';
import ConnectionManager from '../connection-manager';
import SimulationStateCache from '../../simulation/simulation-state-cache';
import ModelEventPublisher from '../events/model-event-publisher';


export default class BusFactory {

  static create (server: http.Server): socketio.Server {
    const io = new socketio.Server(server, {
      cors: {
        origin: [/localhost\:9000/],
        credentials: true
      }
    });

    BusFactory.configureAuthentication(io);
    return io;
  }

  static configureAuthentication (io: socketio.Server): void {
    io.use((socket: socketio.Socket, next: (err?: Error) => void) => passport.initialize()(<express.Request>socket.request, <express.Response>{}, <express.NextFunction>next));
    io.use((socket: socketio.Socket, next: (err?: Error) => void) => {
      passport.authenticate('jwt', { session: false }, (err: Error, user: any, info: any) => {
        if (err || !user) return next();
        return (<express.Request>socket.request).logIn(user, { session: false }, (err: Error) => err ? next(err) : next());
      })(<express.Request>socket.request, <express.Response>{}, <express.NextFunction>next);
    });
    io.use((socket: socketio.Socket, next) => {
      if ((<express.Request>socket.request).user) {
        next();
      } else {
        next(new Error('unauthorized'))
      }
    });
  }

  static configureEvents (io: socketio.Server, connectionManager: ConnectionManager, modelEventPublisher: ModelEventPublisher, socketCache: AccountSocketCache, simulationStateCache: SimulationStateCache, actorCache: ActorCache): void {
    io.on('connect', (socket: socketio.Socket) => {
      if (!connectionManager.state.running) {
        socket.disconnect(true);
        return;
      }

      socket.on('disconnect', () => {
        connectionManager.disconnectSocket(socket.id);
        modelEventPublisher.disconnectSocket(socket.id);
        console.log('[HTTP Worker] Client socket disconnected');
      });

      socket.on('view', (data: any) => {
        const user: Account = <Account>(<express.Request>socket.request).user;
        if (user && _.isInteger(data.viewX) && _.isInteger(data.viewY)) {
          modelEventPublisher.updateViewTarget(user.id, data.viewX, data.viewY);
        }
      });

      const user: Account = <Account>(<express.Request>socket.request).user;
      const existingSocketId: string | null = socketCache.forId(user.id);
      if (existingSocketId) {
        connectionManager.disconnectSocket(socket.id);
        modelEventPublisher.disconnectSocket(existingSocketId);
      }
      modelEventPublisher.connectSocket(socket.id, user.id);
      connectionManager.connectSocket(socket.id, user.id);

      socket.emit('initialize', {
        view: { x: user.viewX ?? 256, y: user.viewY ?? 256 },
        time: {
          simulationTime: simulationStateCache.state.simulationTime.toISO(),
          simulationTimeVelocity: simulationStateCache.state.simulationTimeVelocity,
          serverTime: simulationStateCache.state.serverTime
        },
        actors: _.map(actorCache.all(), (a) => a.toJson())
      });

      console.log('[HTTP Worker] Client socket connected');
    });
  }

}
