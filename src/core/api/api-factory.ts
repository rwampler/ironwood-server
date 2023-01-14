import express from 'express';
import http from 'http';
import Cors from 'cors';
import * as bodyParser from 'body-parser';
import compression from 'compression';
import passport from 'passport';

import winston from 'winston';
import expressWinston from 'express-winston';

import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';

import AccountApi from './account-api';
import ServerApi from './server-api';

import ServerManager from '../server-manager';
import ModelEventClient from '../events/model-event-client';
import AccountManager from '../../account/account-manager';
import AccountCache from '../../account/account-cache';


export default class ApiFactory {

  static create (serverManager: ServerManager, modelEventClient: ModelEventClient, accountCache: AccountCache): http.Server {
    ApiFactory.configureAuthentication(serverManager, new AccountManager(modelEventClient, accountCache));

    const app = express();
    app.use(Cors({
      origin: [/localhost\:9000/],
      credentials: true
    }));
    app.use(compression());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(expressWinston.logger({
      transports: [new winston.transports.File({ filename: 'access.log' })],
      format: winston.format.simple(),
      meta: false,
      expressFormat: true
    }));
    app.use(passport.initialize());
    ApiFactory.configureRoutes(app, serverManager, modelEventClient);

    return http.createServer(app);
  }

  static configureAuthentication (serverManager: ServerManager, accountManager: AccountManager): void {
    passport.use(
      'register',
      new LocalStrategy(
        {
          usernameField: 'username',
          passwordField: 'password'
        },
        async (username: string, password: string, done: any) => {
          return accountManager.create(username, password)
            .then((user) => done(null, user))
            .catch((err) => done(err));
        }
      )
    );

    passport.use(
      'login',
      new LocalStrategy(
        {
          usernameField: 'username',
          passwordField: 'password'
        },
        async (username: string, password: string, done: any) => {
          return accountManager.forUsernamePassword(username, password)
            .then((account) => account ? done(null, account) : done(null, false, { message: 'SIGNIN' }))
            .catch((err) => done(err));
        }
      )
    );

    passport.use(
      'jwt',
      new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('JWT'),
          secretOrKey: serverManager.getSecret()
        },
        (payload: any, done: any) => {
          if (new Date(payload.exp * 1000) < new Date()) return done(null, false);
          const account = accountManager.forId(payload.id);
          return account ? done(null, account) : done(null, false, { message: 'NOT_FOUND' });
        }
      )
    );
  }

  static configureRoutes (app: express.Express, serverManager: ServerManager, modelEventClient: ModelEventClient): void {
    const authenticate = (req: any, res: any, next: any): any => {
      return passport.authenticate('jwt', { session: false }, (err: Error, user: any, info: any) => {
        if (err || !user) return next();
        return req.logIn(user, { session: false }, (err: Error) => err ? next(err) : next());
      })(req, res, next);
    };

    const serverApi = new ServerApi();
    const accountApi = new AccountApi(serverManager.getSecret(), modelEventClient);

    app.get('/metadata', authenticate, serverApi.getMetadata())

    app.post('/account/create', accountApi.create());
    app.post('/account/login', accountApi.login());
    app.post('/account/logout', authenticate, accountApi.logout());
  }

}
