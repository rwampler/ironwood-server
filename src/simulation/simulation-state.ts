import { DateTime } from "luxon";

export default class SimulationState {
  simulationTime: DateTime;
  simulationTimeVelocity: number; // seconds of simulation per real-world millis
  serverTime: number; // real-world server time in millis

  constructor (simulationTime: DateTime, simulationTimeVelocity: number, serverTime: number) {
    this.simulationTime = simulationTime;
    this.simulationTimeVelocity = simulationTimeVelocity;
    this.serverTime = serverTime;
  }

  toJson () {
    return {
      simulationTime: this.simulationTime.toISO(),
      simulationTimeVelocity: this.simulationTimeVelocity,
      serverTime: this.serverTime
    };
  }

  static fromJson (json: any) {
    return new SimulationState(
      DateTime.fromISO(json.simulationTime),
      json.simulationTimeVelocity ?? 0,
      json.serverTime ?? 0
    );
  }

}
