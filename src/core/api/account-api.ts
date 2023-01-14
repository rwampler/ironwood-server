import passport from 'passport';
import jwt from 'jsonwebtoken';

import Account from '../../account/account';
import ModelEventClient from '../events/model-event-client';


export default class AccountApi {

  secret: string;
  modelEventClient: ModelEventClient;

  constructor (secret: string, modelEventClient: ModelEventClient) {
    this.secret = secret;
    this.modelEventClient = modelEventClient;
  }

  loginUser (req: any, res: any, next: any, user: Account, issueRefreshToken: boolean): void {
    req.logIn(user, { session: false }, async (err: any) => {
      if (err) return next(err);

      try {
        const accessToken: string = jwt.sign({ id: user.id }, this.secret, { expiresIn: 3600 });
        const response: object = { id: user.id, username: user.username, name: user.name, accessToken: accessToken };
        if (!issueRefreshToken) return res.json(response);

        const token: string = await this.modelEventClient.issueToken(user);
        return res.json(Object.assign(response, { refreshToken: token }));
      }
      catch (error) {
        console.error(error);
        return res.status(500).json(error);
      }
    });
  }

  create (): any {
    return (req: any, res: any, next: any) => {
      if (!req.body.username?.length || !req.body.password?.length) return res.status(400);
      passport.authenticate('register', { session: false }, (error: any, user: Account, info: any) => {
        if (error) return res.status(500).json(error);
        if (!user) return res.status(401).json({message: info.message});
        this.loginUser(req, res, next, user, req.body.rememberMe);
      })(req, res, next);
    };
  }

  login (): any {
    return (req: any, res: any, next: any) => {
    if (req.body.refreshToken?.length) {
      this.modelEventClient.loginToken(req.body.refreshToken)
        .then((user: Account) => this.loginUser(req, res, next, user, true))
        .catch((error) => {
          console.error(error);
          return res.status(500).json(error);
        });
    }
    else {
      passport.authenticate('login', { session: false }, (error, user, info) => {
        if (error) return res.status(500).json(error);
        if (!user) return res.status(401).json({message: info.message});
        this.loginUser(req, res, next, user, req.body.rememberMe);
      })(req, res, next);
    }
    };
  }

  logout (): any {
    return (req: any, res: any, next: any) => {
      req.logout();
      res.status(200).json({});
    };
  }

}
