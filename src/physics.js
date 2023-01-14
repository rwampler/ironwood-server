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


Logger.banner();

let x = 0;
let y = 0;
let bearing = Math.PI / 2;

const bearingVelocity = (Math.PI * 3 / 2 - bearing) / 10;
const velocity = 10;

for (let i = 0; i < 10; i++) {
  x = x + Math.sin(bearing) * velocity;
  y = y - Math.cos(bearing) * velocity;
  bearing = bearing + bearingVelocity;

  console.log('[' + x + ', ' + y + '] @ ' + bearing);
}


