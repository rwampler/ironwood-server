'use strict';

import ModelEventServer from '../core/events/model-event-server';
import SimulationEventSubscriber from '../core/events/simulation-event-subscriber';

import AccountCache from '../account/account-cache';
import AccountTokenStore from '../account/account-token-store';
import AccountStore from '../account/account-store';

import ActorCache from '../actor/actor-cache';
import ActorStore from '../actor/actor-store';

import SimulationStateCache from '../simulation/simulation-state-cache';
import SimulationStateStore from '../simulation/simulation-state-store';


const accountStore = new AccountStore(false);
const accountTokenStore = new AccountTokenStore(false);
const accountCache = new AccountCache(accountStore);

const actorStore = new ActorStore(false);
const actorCache = new ActorCache(actorStore);

const simulationStateStore = new SimulationStateStore(false);
const simulationStateCache = new SimulationStateCache(simulationStateStore);

const modelServer = new ModelEventServer(accountStore, accountTokenStore, accountCache, actorCache, simulationStateCache);
const simulationSubscriber = new SimulationEventSubscriber();

process.on('SIGINT', async () => {
  try {
    simulationSubscriber.stop();
    modelServer.stop();

    await Promise.all([
      accountTokenStore.close(),
      accountCache.close(), // closes accountStore
      simulationStateCache.close(),
      actorCache.close()
    ]);
  }
  catch (err) {
    console.log('[Model Event Server] Unable to shutdown cleanly: ' + err);
  }
  process.exit();
});


const loadData = async () => {
  await Promise.all([
    accountCache.load(),
    simulationStateCache.load(),
    actorCache.load()
  ]);
};

const handleEvent = async (event) => {
  simulationStateCache.update(event.state);

  for (let actor of event.updatedActors) {
    actorCache.update(actor);
  }
};

const persistCaches = async () => {
  // save caches to disk every 5 minutes
  try {
    await Promise.all([
      simulationStateCache.flush(),
      actorCache.flush()
    ]);
  }
  catch (err) {
    console.error(err);
  }
};


loadData()
  .then(() => setInterval(persistCaches, 1000 * 60 * 5))
  .then(() => modelServer.start())
  .then(() => simulationSubscriber.start(handleEvent))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
