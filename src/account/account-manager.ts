import { hash, compare } from 'bcrypt';

import ModelEventClient from '../core/events/model-event-client';

import Account from '../account/account';
import AccountCache from '../account/account-cache';

import Utils from '../utils/utils';


export default class AccountManager {
  modelClient: ModelEventClient;
  cache: AccountCache;

  constructor (modelClient: ModelEventClient, accountCache: AccountCache) {
    this.modelClient = modelClient;
    this.cache = accountCache;
  }

  create (username: string, password: string): Promise<Account> {
    return new Promise<Account>((resolve: (value: Account) => void, reject: (value: any) => void) => {
      if (!username?.length || !password?.length) return reject('INVALID_PARAMETERS');
      const existingAccount: Account | null = this.forUsername(username);
      if (existingAccount) {
        return reject('USERNAME_CONFLICT');
      }
      else {
        hash(password, 10, (err: Error | undefined, hash: string) => {
          if (err) return reject(err);
          this.modelClient.createAccount(new Account(Utils.uuid(), username, username, hash, 256, 256))
            .then(resolve)
            .catch(reject)
        });
      }
    });
  }

  forId (accountId: string): Account | null { return this.cache.forId(accountId); }
  forUsername (username: string): Account | null { return this.cache.forUsername(username); }

  forUsernamePassword (username: string, password: string): Promise<Account | null> {
    return new Promise((resolve: (value: Account | null) => void, reject: (value: any) => void) => {
      const user: Account | null = this.forUsername(username);
      if (!user) {
        return resolve(null);
      }
      else {
        compare(password, user.passwordHash || '')
          .then((res) => resolve(res ? user : null))
          .catch(reject);
      }
    });
  }

}

