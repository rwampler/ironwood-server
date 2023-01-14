

export default class Account {
  id: string;
  username: string;
  name: string;
  passwordHash: string;

  viewX: number;
  viewY: number;

  constructor (id: string, username: string, name: string, passwordHash: string, viewX: number, viewY: number) {
    this.id = id;
    this.username = username;
    this.name = name;
    this.passwordHash = passwordHash;
    this.viewX = viewX;
    this.viewY = viewY;
  }

  toJson () {
    return {
      id: this.id,
      username: this.username,
      name: this.name,
      passwordHash: this.passwordHash,
      viewX: this.viewX,
      viewY: this.viewY
    };
  }

  static fromJson (json:any) {
    return new Account(
      json.id,
      json.username,
      json.name,
      json.passwordHash,
      json.viewX,
      json.viewY
    );
  }
}
