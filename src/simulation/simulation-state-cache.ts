import _ from 'lodash';

import SimulationState from './simulation-state';
import { SimulationStateDao } from './simulation-state-store';

import Utils from '../utils/utils';
import { DateTime } from 'luxon';

export default class SimulationStateCache {
  dao: SimulationStateDao;

  loaded: boolean = false;
  dirty: boolean = false;

  state: SimulationState = new SimulationState(DateTime.now(), 0, 0);

  constructor (dao: SimulationStateDao) {
    this.dao = dao;
  }

  close (): Promise<any> {
    return this.dao.close();
  }

  load (): Promise<void> {
    return Utils.withRetries(10, async () => {
      this.state = await this.dao.getState();
      this.loaded = true;
    });
  }

  flush (): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.dirty || !this.state) {
        return resolve();
      }

      this.dao.setState(this.state)
        .then(() => { this.dirty = false; })
        .then(resolve)
        .catch(reject);
    });
  }

  update (state: SimulationState): SimulationState {
    this.state = state;
    this.dirty = true;
    return state;
  }

}
