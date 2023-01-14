import _ from 'lodash';
import * as sqlite3 from 'sqlite3';

import Actor from '../actor/actor';

export interface ActorDao {
  close (): Promise<void>;

  all (): Promise<Actor[]>;
  set (actor: Actor): Promise<Actor>;
}

export default class ActorStore {
  readOnly: boolean;
  db: sqlite3.Database;

  constructor (readOnly: boolean) {
    this.readOnly = readOnly;
    this.db = new sqlite3.Database("./db/actors.db", readOnly ? sqlite3.OPEN_READONLY : (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE));

    if (!readOnly) {
      this.db.exec("PRAGMA journal_mode = wal; CREATE TABLE IF NOT EXISTS actors (id TEXT PRIMARY KEY, content TEXT NOT NULL)", (err:any) => {
        if (err) throw err;
      });
    }
  }

  close (): Promise<void> {
    return new Promise((resolve:Function, reject:Function) => {
      this.db.close((err:any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  all (): Promise<Actor[]> {
    return new Promise((resolve:Function, reject:Function) => {
      this.db.all("SELECT content FROM actors", [], (err: Error, rows: Array<any>) => {
        if (err) return reject(err);
        resolve(_.map(_.filter(rows, (row: any) => row?.content != null), (row: any) => Actor.fromJson(JSON.parse(row.content))));
      });
    });
  }

  get (id: string): Promise<Actor | null> {
    return new Promise((resolve:Function, reject:Function) => {
      return this.db.get("SELECT content FROM actors WHERE id = ?", [id], (err: Error, row: any) => {
        if (err) return reject(err);
        resolve(row?.content ? Actor.fromJson(JSON.parse(row.content)) : null);
      });
    });
  }

  set (actor: Actor): Promise<Actor> {
    return new Promise((resolve, reject) => {
      if (this.readOnly) return reject('READ_ONLY');

      this.db.run("INSERT OR REPLACE INTO actors (id, content) VALUES (?, ?)", [actor.id, JSON.stringify(actor.toJson())], (err: Error, row: any) => {
        if (err) return reject(err);
        resolve(actor);
      });
    });
  }

  destroy (id: string): Promise<void> {
    return new Promise<void>((resolve: (value: void) => void, reject: (value: any) => void) => {
      if (this.readOnly) return reject('READ_ONLY');
      this.db.run("DELETE FROM actors WHERE id = ?", [id], (err: Error | null) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

}
