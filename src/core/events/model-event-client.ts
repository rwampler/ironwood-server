import _ from 'lodash';
import EventEmitter from 'events';
import { Request } from 'zeromq';

import Account from '../../account/account';
import { AccountDao } from '../../account/account-store';
import Actor from '../../actor/actor';
import { ActorDao } from '../../actor/actor-store';
import SimulationState from '../../simulation/simulation-state';
import { SimulationStateDao } from '../../simulation/simulation-state-store';


const SYNC_API_PORT = 19165;


export default class ModelEventClient {
  running: boolean = false;
  events: EventEmitter;

  requestSocket: Request;

  constructor () {
    this.running = false;
    this.events = new EventEmitter();

    this.requestSocket = new Request();
  }

  start (): void {
    try {
      this.requestSocket.connect(`tcp://127.0.0.1:${SYNC_API_PORT}`);
      console.log(`[Model Event Client] API Requester started on port ${SYNC_API_PORT}`);

      this.running = true;
    }
    catch (err) {
      if (this.running) {
        throw err;
      }
    }
  }

  stop () {
    this.running = false;
    console.log('[Model Event Client] Stopping...');
    this.requestSocket.close();
    console.log('[Model Event Client] Stopped');
  }

  accountDao (): AccountDao {
    const client = this;
    return {
      close (): Promise<void> {
        return new Promise(resolve => resolve());
      },
      all (): Promise<Account[]> {
        return client.allAccounts();
      }
    };
  }
  actorDao (): ActorDao {
    const client = this;
    return {
      close (): Promise<void> {
        return new Promise(resolve => resolve());
      },
      all (): Promise<Actor[]> {
        return client.allActors();
      },
      set (actor: Actor): Promise<Actor> {
        return new Promise(resolve => resolve(actor));
      }
    };
  }
  simulationStateDao (): SimulationStateDao {
    const client = this;
    return {
      close (): Promise<void> {
        return new Promise(resolve => resolve());
      },
      getState (): Promise<SimulationState> {
        return client.simulationState();
      },
      setState (state: SimulationState): Promise<SimulationState> {
        return new Promise(resolve => resolve(state));
      }
    };
  }

  async allAccounts (): Promise<Account[]> {
    await this.requestSocket.send(JSON.stringify({ type: 'ACCOUNT:LIST' }));
    const [result] = await this.requestSocket.receive();
    return _.map(JSON.parse(result.toString()).accounts, Account.fromJson);
  }

  async createAccount (account: Account): Promise<Account> {
    await this.requestSocket.send(JSON.stringify({ type: 'ACCOUNT:CREATE', payload: account.toJson() }));
    const [result] = await this.requestSocket.receive();
    return Account.fromJson(JSON.parse(result.toString()).account);
  }
  async account (accountId: string): Promise<Account> {
    await this.requestSocket.send(JSON.stringify({ type: 'ACCOUNT:GET', accountId: accountId }));
    const [result] = await this.requestSocket.receive();
    return Account.fromJson(JSON.parse(result.toString()).account);
  }

  async issueToken (account: Account): Promise<string> {
    await this.requestSocket.send(JSON.stringify({ type: 'TOKEN:ISSUE', accountId: account.id }));
    const [result] = await this.requestSocket.receive();
    return JSON.parse(result.toString()).token;
  }
  async loginToken (token: string): Promise<Account> {
    await this.requestSocket.send(JSON.stringify({ type: 'TOKEN:LOGIN', tokenId: token }));
    const [result] = await this.requestSocket.receive();
    return Account.fromJson(JSON.parse(result.toString()).account);
  }

  async simulationState (): Promise<SimulationState> {
    await this.requestSocket.send(JSON.stringify({ type: 'SIMULATION_STATE:GET' }));
    const [result] = await this.requestSocket.receive();
    return SimulationState.fromJson(JSON.parse(result.toString()).state);
  }

  async allActors (): Promise<Actor[]> {
    await this.requestSocket.send(JSON.stringify({ type: 'ACTOR:LIST' }));
    const [result] = await this.requestSocket.receive();
    return _.map(JSON.parse(result.toString()).actors, Actor.fromJson);
  }

}
