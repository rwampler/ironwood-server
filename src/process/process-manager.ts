import _ from 'lodash';
import cluster, { Worker } from 'cluster';
import { fork } from 'child_process';
import os from 'os';
import fs from 'fs';

import path from 'path';

import Logger from '../utils/logger';

interface Processes {
  simulation?: any;
  model?: any;
  workerById: any;
}

export default class ProcessManager {
  running: boolean = false;
  processes: Processes = {
    simulation: null,
    model: null,
    workerById: {}
  };

  constructor () {
    Logger.banner();

    this.setupConfigurations();
  }

  setupConfigurations (): void {
    if (!fs.existsSync('db')) {
      fs.mkdirSync('db', { recursive: true });
    }

    if (!fs.existsSync('./config/server.config.json')) {
      console.log("[Process Manager] Unable to find server.config.json; try again after running setup");
      process.exit(1);
    }
  }

  start (): void {
    const cpuCount = os.cpus().length;
    const workerCount = Math.max(1, cpuCount - 1 - 1);

    this.running = true;
    this.initializeSimulation('ironwood');
    this.initializeModelServer();
    this.initializeHttpWorkers(workerCount);

    console.log(`[Process Manager] Total: ${cpuCount}`);
    console.log("[Process Manager] Model Server: 1");
    console.log("[Process Manager] Simulation: 1");
    console.log(`[Process Manager] HTTP Worker: ${workerCount}\n`);
  }

  stop (): void {
    if (this.running) {
      console.log('[Process Manager] Shutting down server...');
      this.running = false;
      this.shutdownPollingLoop();
    }
  }

  shutdownPollingLoop (): void {
    if (!this.running) {
      if (!this.processes.simulation && !this.processes.model && !_.compact(_.values(this.processes.workerById)).length) {
        console.log('[Process Manager] All processes stopped, exitting');
        process.exit();
      }
      else {
        const simulationStatus = 'simulation ' + (this.processes.simulation ? 'running' : 'stopped');
        const modelStatus = 'model ' + (this.processes.model ? 'running' : 'stopped');
        const workerStatus = _.compact(_.values(this.processes.workerById)).length + ' HTTP workers running';
        console.log('[Process Manager] Waiting for processes to end... (' + simulationStatus + ', ' + modelStatus + ', ' + workerStatus + ')');
        setTimeout(() => this.shutdownPollingLoop(), 1000);
      }
    }
  }

  initializeSimulation (simulationId: any): void {
    this.processes.simulation = fork(path.join(__dirname, '../process/process-simulation.js'), [simulationId]);
    this.processes.simulation.on('exit', (code: any) => {
      if (this.running) {
        console.log(`[Process Manager] Simulation engine for ${simulationId} exitted with status ${code}, will restart`);
        this.initializeSimulation(simulationId);
      }
      else {
        this.processes.simulation = null;
      }
    });
  }

  initializeModelServer (): void {
    this.processes.model = fork(path.join(__dirname, '../process/process-model-server.js'));
    this.processes.model.on('exit', (code: any) => {
      if (this.running) {
        console.log(`[Process Manager] Model server exitted with status ${code}, will restart`);
        this.initializeModelServer();
      }
      else {
        this.processes.model = null;
      }
    });
  }

  initializeHttpWorkers (workerCount: number): void {
    for (let i = 0; i < workerCount; i++) {
      // required to use cluster forking, for express to delegate single port to children processes
      const worker = cluster.fork();
      this.processes.workerById[worker.id] = worker;
    }

    cluster.on('exit', (worker: Worker, code: number, signal: string) => {
      this.processes.workerById[worker.id] = null;
      if (this.running) {
        console.log(`[Process Manager] Worker ${worker.id} stopped with code ${code}, will restart`);
        const newWorker = cluster.fork();
        this.processes.workerById[newWorker.id] = newWorker;
      }
    });
  }

}
