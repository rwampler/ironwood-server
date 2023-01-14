import { readFileSync } from 'fs';

interface Metadata {
  secretHash: string;
  simulationVelocity: number;
}

export default class ServerManager {
  metadata: Metadata;

  constructor () {
    this.metadata = JSON.parse(readFileSync('./config/server.config.json')?.toString());
  }


  getSecret (): string { return this.metadata.secretHash; }
  getSimulationVelocity (): number { return this.metadata.simulationVelocity; }

}
