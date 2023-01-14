import _ from 'lodash';
import EventEmitter from 'events';
import { Subscriber } from 'zeromq';

import ModelEventClient from './model-event-client';
import AccountCache from '../../account/account-cache';
import AccountSocketCache from '../../account/account-socket-cache';

const ASYNC_SERVER_TO_CLIENT_PORT = 19166;

const SOCKET_SUBSCRIBER_TOPICS = ['SOCKET:CONNECT', 'SOCKET:DISCONNECT', 'ACCOUNT:UPDATE'];


export default class ModelEventSubscriber {
  running: boolean = false;
  events: EventEmitter;

  subscriberSocket: Subscriber;
  modelEventClient: ModelEventClient;

  constructor (modelEventClient: ModelEventClient) {
    this.running = false;
    this.events = new EventEmitter();

    this.subscriberSocket = new Subscriber();
    this.modelEventClient = modelEventClient;
  }

  async start (accountCache: AccountCache, accountSocketCache: AccountSocketCache): Promise<void> {
    try {
      this.subscriberSocket.connect(`tcp://127.0.0.1:${ASYNC_SERVER_TO_CLIENT_PORT}`);
      this.subscriberSocket.subscribe(...SOCKET_SUBSCRIBER_TOPICS);
      console.log(`[Model Event Subscriber] Subscriber started on port ${ASYNC_SERVER_TO_CLIENT_PORT}`);

      this.running = true;

      for await (const [topic, message] of this.subscriberSocket) {
        const request = JSON.parse(message.toString());
        const type = topic.toString();
        if (type === 'SOCKET:CONNECT') {
          accountSocketCache.set(request.accountId, request.socketId);
        }
        else if (type === 'SOCKET:DISCONNECT') {
          accountSocketCache.clearBySocketId(request.socketId);
          this.events.emit('disconnectSocket', request.socketId);
        }
        else if (type === 'ACCOUNT:UPDATE') {
          accountCache.loadAccount(await this.modelEventClient.account(request.id));
        }
        else {
          console.log(`[Model Event Subscriber] Unknown event topic ${topic}`);
        }
      }
    }
    catch (err) {
      if (this.running) {
        throw err;
      }
    }
  }

  stop () {
    this.running = false;
    console.log('[Model Event Subscriber] Stopping...');
    this.subscriberSocket.close();
    console.log('[Model Event Subscriber] Stopped');
  }

}
