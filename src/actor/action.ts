

export default class Action {
  id: string;
  type: string;

  startAt: number;
  finishAt: number;

  parameters: any;

  constructor (id: string, type: string, startAt: number, finishAt: number, parameters: any) {
    this.id = id;
    this.type = type;
    this.startAt = startAt;
    this.finishAt = finishAt;
    this.parameters = parameters;
  }

  toJson () {
    return {
      id: this.id,
      type: this.type,
      startAt: this.startAt,
      finishAt: this.finishAt,
      parameters: this.parameters
    };
  }

  static fromJson (json:any) {
    return new Action(
      json.id,
      json.type,
      json.startAt,
      json.finishAt,
      json.parameters ?? {}
    );
  }
}
