'use strict';

import ModelEventClient from '../core/events/model-event-client';
import SimulationEventPublisher from '../core/events/simulation-event-publisher';

import Simulation from '../engine/simulation';

import ActorCache from '../actor/actor-cache';
import SimulationStateCache from '../simulation/simulation-state-cache';
import ServerManager from '../core/server-manager';

const modelEventClient = new ModelEventClient();
const simulationStateCache = new SimulationStateCache(modelEventClient.simulationStateDao());
const actorCache = new ActorCache(modelEventClient.actorDao());

const serverManager = new ServerManager();
const eventPublisher = new SimulationEventPublisher();
const simulation = new Simulation(serverManager, eventPublisher, simulationStateCache, actorCache);

process.on('SIGINT', async () => {
  try {
    modelEventClient.stop();
    eventPublisher.stop();
    simulation.stop();
    await Promise.all([simulationStateCache.close(), actorCache.close()]);
  }
  catch (err) {
    console.log('[Simulation] Unable to shutdown cleanly: ' + err);
  }
  process.exit();
});

const loadData = async () => {
  modelEventClient.start();
  await simulationStateCache.load();
  await actorCache.load();
};

loadData()
  .then(() => eventPublisher.start())
  .then(() => simulation.start())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
