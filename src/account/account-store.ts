import _ from 'lodash';
import * as sqlite3 from 'sqlite3';

import Account from '../account/account';

export interface AccountDao {
  close (): Promise<void>;

  all (): Promise<Account[]>;
}

export default class AccountStore {
  readOnly: boolean;
  db: sqlite3.Database;

  constructor (readOnly: boolean) {
    this.readOnly = readOnly;
    this.db = new sqlite3.Database("./db/accounts.db", readOnly ? sqlite3.OPEN_READONLY : (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE));

    if (!readOnly) {
      this.db.exec("PRAGMA journal_mode = wal; CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, content TEXT NOT NULL)", (err:any) => {
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

  all (): Promise<Account[]> {
    return new Promise((resolve:Function, reject:Function) => {
      this.db.all("SELECT content FROM accounts", [], (err: Error, rows: Array<any>) => {
        if (err) return reject(err);
        resolve(_.map(_.filter(rows, (row: any) => row?.content != null), (row: any) => Account.fromJson(JSON.parse(row.content))));
      });
    });
  }

  get (id: string): Promise<Account | null> {
    return new Promise((resolve:Function, reject:Function) => {
      return this.db.get("SELECT content FROM accounts WHERE id = ?", [id], (err: Error, row: any) => {
        if (err) return reject(err);
        resolve(row?.content ? Account.fromJson(JSON.parse(row.content)) : null);
      });
    });
  }

  forUsername (username: string): Promise<Account | null> {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT content FROM accounts WHERE username = ?", [username], (err: Error, row: any) => {
        if (err) return reject(err);
        resolve(row?.content ? Account.fromJson(JSON.parse(row.content)) : null);
      });
    });
  }

  set (account: Account): Promise<Account> {
    return new Promise((resolve, reject) => {
      if (this.readOnly) return reject('READ_ONLY');

      this.db.run("INSERT OR REPLACE INTO accounts (id, username, content) VALUES (?, ?, ?)", [account.id, account.username, JSON.stringify(account.toJson())], (err: Error, row: any) => {
        if (err) return reject(err);
        resolve(account);
      });
    });
  }

}
