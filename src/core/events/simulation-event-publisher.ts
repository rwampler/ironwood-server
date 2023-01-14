import { DateTime } from 'luxon';
import { Publisher } from 'zeromq';

import Actor from '../../actor/actor';
import SimulationState from '../../simulation/simulation-state';


const SUBSCRIBE_PORT = 19170;

export default class SimulationEventPublisher {
  publisherSocket: Publisher;
  bound: boolean;

  constructor () {
    this.publisherSocket = new Publisher();
    this.bound = false;
  }

  async start (): Promise<void> {
    await this.publisherSocket.bind(`tcp://127.0.0.1:${SUBSCRIBE_PORT}`);
    console.log(`[Simulation Event Publisher] Started on port ${SUBSCRIBE_PORT}`);
    this.bound = true;
  }

  stop (): void {
    console.log('[Simulation Event Publisher] Stopping...');
    this.bound = false;
    this.publisherSocket.close();
    console.log('[Simulation Event Publisher] Stopped');
  }

  async sendEvent (state: SimulationState, updatedActors: Array<Actor>): Promise<void> {
    if (this.bound) {
      await this.publisherSocket.send(['SIMULATION', JSON.stringify({
        state: state.toJson(),
        updatedActors: updatedActors.map((a) => a.toJson())
      })]);
    }
  }
}
