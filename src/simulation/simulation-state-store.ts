import { DateTime } from 'luxon';
import * as sqlite3 from 'sqlite3';

import SimulationState from './simulation-state';

export interface SimulationStateDao {
  close (): Promise<void>;

  getState (): Promise<SimulationState>;
  setState (state: SimulationState): Promise<SimulationState>;
}

export default class SimulationStateStore implements SimulationStateDao {
  readOnly: boolean;
  db: sqlite3.Database;

  constructor (readOnly:boolean) {
    this.readOnly = readOnly;
    this.db = new sqlite3.Database("./db/simulation-state.db", readOnly ? sqlite3.OPEN_READONLY : (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE));

    if (!readOnly) {
      this.db.exec("PRAGMA journal_mode = wal; CREATE TABLE IF NOT EXISTS simulation_state (id TEXT PRIMARY KEY, content TEXT NOT NULL)", (err) => {
        if (err) throw err;
      });
    }
  }

  close (): Promise<void> {
    return new Promise((resolve:Function, reject:Function) => {
      this.db.close((err:Error | null): void => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  get (id:string): Promise<SimulationState | null> {
    return new Promise((resolve:Function, reject:Function) => {
      this.db.get("SELECT content FROM simulation_state WHERE id = ?", [id], (err:Error, row:any) => {
        if (err) return reject(err);
        resolve(row?.content ? SimulationState.fromJson(JSON.parse(row.content)) : null);
      });
    });
  }

  set (id: string, content: SimulationState): Promise<SimulationState> {
    return new Promise((resolve:Function, reject:Function) => {
      if (this.readOnly) return reject('READ_ONLY');
      this.db.get("INSERT OR REPLACE INTO simulation_state (id, content) VALUES (?, ?)", [id, JSON.stringify(content)], (err:Error, row:any) => {
        if (err) return reject(err);
        resolve(content);
      });
    });
  }

  getState (): Promise<SimulationState> {
    return new Promise(async (resolve, reject) => {
      try {
        const state = await this.get('ironwood');
        if (state) return resolve(state);
        else reject();
      }
      catch (err) {
        reject(err);
      }
    });
  }
  setState (state: SimulationState): Promise<SimulationState> {
    return this.set('ironwood', state);
  }

}
