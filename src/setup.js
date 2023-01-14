'use strict';

import { DateTime } from 'luxon';

import Actor, { Posture, Vision } from './actor/actor';
import ActorStore from './actor/actor-store';
import SimulationState from './simulation/simulation-state';
import SimulationStateStore from './simulation/simulation-state-store';

import Logger from './utils/logger';
import Utils from './utils/utils';

// import SetupMaps from './setup/setup-maps';

const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

const actorStore = new ActorStore(false);
const simulationStateStore = new SimulationStateStore(false);


Logger.banner();


const initializeSimulation = async () => {
  try {
    const state = await simulationStateStore.getState();
    console.log("Simulation time is already " + state.simulationTime.toISO());
  }
  catch (err) {
    const state = new SimulationState(DateTime.fromISO("1880-01-01T00:00:00"), 0, 0);
    simulationStateStore.setState(state);
    console.log("Simulation time is now " + state.simulationTime.toISO());
  }
};

const initializeActors = async () => {
  const actors = await actorStore.all();
  console.log("Found " + actors.length + " existing actors");

  for (var actor of actors) {
    actorStore.destroy(actor.id);
  }

  for (let i = 0; i < 10; i++) {
    const posture = new Posture(256 + (Math.random() * 50 - 25), 256 + (Math.random() * 50 - 25), 0);
    const vision = new Vision(300 * TO_RADIANS, 20);
    actorStore.set(new Actor(Utils.uuid(), 'DEER', 'Deer', posture, vision, []));
  }
};


initializeSimulation()
  .then(initializeActors)
  // .then(SetupMaps.setup())
  .then(() => {
    console.log("Finished setup");
  });
