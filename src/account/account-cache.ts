import _ from 'lodash';

import Account from '../account/account';
import Utils from '../utils/utils';
import { AccountDao } from './account-store';

export default class AccountCache {
  dao: AccountDao;

  loaded: boolean = false;
  dirtyIds: Set<string> = new Set();

  byId: Record<string, Account>;
  idByUsername: Record<string, string>;

  constructor (dao: AccountDao) {
    this.dao = dao;
    this.byId = {};
    this.idByUsername = {};
  }

  close (): Promise<any> {
    return this.dao.close();
  }

  load (): Promise<void> {
    return Utils.withRetries(10, async () => {
      for (let account of await this.dao.all()) {
        this.byId[account.id] = account;
        this.idByUsername[account.username] = account.id;
      }
      this.loaded = true;
    });
  }

  loadAccount (account: Account): Account {
    this.byId[account.id] = account;
    this.idByUsername[account.username] = account.id;
    return account;
  }

  all (): Array<Account> { return _.values(this.byId); }

  forId (accountId:string): Account | null { return this.byId[accountId]; }
  forUsername (username:string): Account | null { return this.forId(this.idByUsername[username]); }

  update (accountOrAccounts:Account | Array<Account>): void {
    if (Array.isArray(accountOrAccounts)) {
      for (const account of accountOrAccounts) {
        this.update(account);
      }
    }
    else {
      this.byId[accountOrAccounts.id] = accountOrAccounts;
      this.idByUsername[accountOrAccounts.username] = accountOrAccounts.id;
      this.dirtyIds.add(accountOrAccounts.id);
    }
  }

}
