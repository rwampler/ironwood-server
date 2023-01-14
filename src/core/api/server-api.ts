import express from 'express';

import Account from '../../account/account';


export default class ServerApi {


  constructor () {
  }

  getMetadata () {
    return (req: express.Request, res: express.Response, next: any): void => {
      const response: any = {
        seed: 'ironwood',
        chunkSize: 1000,
        chunkColumnCount: 4,
        chunkRowCount: 4
      };

      if (req.isAuthenticated()) {
        const account: Account = <Account>req.user;
        response.account = { id: account.id, username: account.username, name: account.name };
      }

      res.json(response);
    };
  }

}
