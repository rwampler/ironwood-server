import _ from 'lodash';

import Actor from '../actor/actor';
import { ActorDao } from './actor-store';
import Utils from '../utils/utils';

export default class ActorCache {
  dao: ActorDao;

  loaded: boolean = false;
  dirtyIds: Set<string> = new Set();

  byId: Record<string, Actor>;

  constructor (dao: ActorDao) {
    this.dao = dao;
    this.byId = {};
  }

  close (): Promise<any> {
    return this.dao.close();
  }

  load (): Promise<void> {
    return Utils.withRetries(10, async () => {
      for (let actor of await this.dao.all()) {
        this.byId[actor.id] = actor;
      }
      this.loaded = true;
    });
  }

  all (): Array<Actor> { return _.values(this.byId); }
  forId (actorId:string): Actor | null { return this.byId[actorId]; }

  flush (): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.dirtyIds.size) {
        return resolve();
      }

      Promise.all(Array.from(this.dirtyIds).map(id => this.dao.set(this.byId[id])))
        .then(() => { this.dirtyIds.clear(); })
        .then(resolve)
        .catch(reject);
    });
  }

  update (actorOrActors: Actor | Array<Actor>): Actor | Array<Actor> {
    if (Array.isArray(actorOrActors)) {
      for (const actor of actorOrActors) {
        this.update(actor);
      }
    }
    else {
      this.byId[actorOrActors.id] = actorOrActors;
      this.dirtyIds.add(actorOrActors.id);
    }
    return actorOrActors;
  }

}
