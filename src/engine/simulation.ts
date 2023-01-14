import winston from 'winston';
import Action from '../actor/action';

import SimulationEventPublisher from '../core/events/simulation-event-publisher';

import Actor from '../actor/actor';
import ActorCache from '../actor/actor-cache';

import SimulationState from '../simulation/simulation-state';
import SimulationStateCache from '../simulation/simulation-state-cache';

import Utils from '../utils/utils';
import ServerManager from '../core/server-manager';
import { xor } from 'lodash';

const FRAME_DURATION_MS = 500;

const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

const RADIANS_360 = 2 * Math.PI;
const RADIANS_180 = Math.PI;
const RADIANS_90 = Math.PI / 2;

const MPH_TO_MPS = 2.237;

class SimulationFrame {
  state: SimulationState;
  updatedActors: Array<Actor>;

  constructor (state: SimulationState, updatedActors: Array<Actor>) {
    this.state = state;
    this.updatedActors = updatedActors;
  }
}

export default class Simulation {
  logger: winston.Logger;
  serverManager: ServerManager;
  eventPublisher: SimulationEventPublisher;

  simulationStateCache: SimulationStateCache;
  actorCache: ActorCache;

  running: boolean = false;

  constructor (serverManager: ServerManager, eventPublisher: SimulationEventPublisher, simulationStateCache: SimulationStateCache, actorCache: ActorCache) {
    this.serverManager = serverManager;
    this.eventPublisher = eventPublisher;
    this.simulationStateCache = simulationStateCache;
    this.actorCache = actorCache;

    this.logger = winston.createLogger({
      transports: [new winston.transports.File({ filename: 'simulation.log' })],
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.timestamp(),
        winston.format.printf(({ level, message, label, timestamp }) => `${timestamp} [${level}]: ${message}`)
      )
    });
  }

  currentMs (): number {
    const hrTime = process.hrtime();
    return hrTime[0] * 1000 + hrTime[1] / 1000000;
  }

  start (): void {
    this.running = true;
    this.mainLoop();
  }

  stop (): void {
    console.log('[Simulation] Stopping engine...');
    this.running = false;
  }

  mainLoop (): void {
    if (!this.running) {
      console.log("[Simulation] Engine stopped");
      return;
    }

    if (!this.simulationStateCache.loaded || !this.actorCache.loaded) {
      setTimeout(() => this.mainLoop(), 1000);
      return;
    }

    const startMs = this.currentMs();
    const frame: SimulationFrame | null = this.simulate(Date.now());
    const endMs = this.currentMs();

    const durationMs = Math.round(endMs - startMs);
    const toWait = durationMs > FRAME_DURATION_MS ? 0 : Math.max(0, (FRAME_DURATION_MS - durationMs));

    if (frame) this.eventPublisher.sendEvent(frame.state, frame.updatedActors);
    setTimeout(() => this.mainLoop(), toWait);
  }

  simulate (serverTimeMs: number): SimulationFrame {
    const simulationSecondsInFrame: number = this.serverManager.getSimulationVelocity() * 30;
    const simulationVelocity: number = simulationSecondsInFrame / FRAME_DURATION_MS;

    const state: SimulationState = this.simulationStateCache.state;
    state.simulationTime = state.simulationTime.plus({ seconds: simulationSecondsInFrame });
    state.simulationTimeVelocity = simulationVelocity;
    state.serverTime = serverTimeMs;

    if (state.simulationTime.minute == 0) {
      this.logger.info("Current time is %s", state.simulationTime.toISO());
    }

    const currentFrameSeconds = state.simulationTime.toSeconds();
    const updatedActors: Array<Actor> = [];
    for (let actor of this.actorCache.all()) {
      actor.cleanupActions(currentFrameSeconds);

      if (!actor.actions.length) {
        const choice = Math.random();


        if (choice < 0.25) {
          const toBearing = Math.random() * RADIANS_360;

          const delta = ((toBearing - actor.posture.bearing) + RADIANS_180) % RADIANS_360 - RADIANS_180;
          const duration = Math.ceil(Math.abs(delta) / RADIANS_90) * 5;

          actor.actions.push(new Action(Utils.uuid(), 'ROTATE', currentFrameSeconds, currentFrameSeconds + duration, {
            fromBearing: actor.posture.bearing,
            toBearing: toBearing,
            delta: delta
          }));
        }
        else if (choice < 0.50) {
          const speed = Utils.between(1.34112, 1.78816);
          const distance = Utils.between(5, 25);

          const x = Math.max(0, Math.min(1000, actor.posture.x + Math.sin(actor.posture.bearing) * distance));
          const y = Math.max(0, Math.min(1000, actor.posture.y - Math.cos(actor.posture.bearing) * distance));

          const delta = Math.sqrt(Math.pow(x - actor.posture.x, 2) + Math.pow(y - actor.posture.y, 2))
          const duration = Math.ceil(delta / speed);

          actor.actions.push(new Action(Utils.uuid(), 'MOVE', currentFrameSeconds, currentFrameSeconds + duration, {
            fromX: actor.posture.x,
            fromY: actor.posture.y,
            toX: x,
            toY: y
          }));

        }
        else {
          actor.actions.push(new Action(Utils.uuid(), 'IDLE', currentFrameSeconds, currentFrameSeconds + 60, {}));
        }

        updatedActors.push(actor);
      }
    }

    this.simulationStateCache.update(state);

    return new SimulationFrame(state, updatedActors);
  }

}
