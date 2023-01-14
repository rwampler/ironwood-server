import _ from 'lodash';

export default class AccountSocketCache {
  socketIdByAccountId: Record<string, string>;
  accountIdBySocketId: Record<string, string>;

  constructor () {
    this.socketIdByAccountId = {};
    this.accountIdBySocketId = {};
  }

  forId (accountId: string): string | null { return this.socketIdByAccountId[accountId]; }
  forSocketId (socketId: string): string | null { return this.accountIdBySocketId[socketId]; }

  set (accountId: string, socketId: string) {
    if (this.socketIdByAccountId[accountId]) {
      throw Error("Account already has socket");
    }

    this.socketIdByAccountId[accountId] = socketId;
    this.accountIdBySocketId[socketId] = accountId;
  }

  clearBySocketId (socketId: string) {
    const accountId = this.accountIdBySocketId[socketId];
    if (accountId) {
      delete this.accountIdBySocketId[socketId];
      const otherSocketId: string | null = this.socketIdByAccountId[accountId];
      if (otherSocketId && otherSocketId === socketId) {
        delete this.socketIdByAccountId[accountId];
      }
    }
  }

}
