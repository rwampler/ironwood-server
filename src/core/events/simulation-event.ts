import Actor from '../../actor/actor';
import SimulationState from '../../simulation/simulation-state';


export default class SimulationEvent {
  state: SimulationState;
  updatedActors: Array<Actor>;

  constructor (state: SimulationState, updatedActors: Array<Actor>) {
    this.state = state;
    this.updatedActors = updatedActors;
  }

  static fromJson (json: any) {
    return new SimulationEvent(
      SimulationState.fromJson(json.state),
      json.updatedActors?.map(Actor.fromJson) ?? []
    );
  }

}
