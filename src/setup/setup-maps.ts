'use strict';

import fs from 'fs-extra';
import { createGzip } from 'zlib';
import { Readable } from 'stream';
import sharp from 'sharp';

import Noise from '../utils/noise';


const CHUNK_COLUMN_COUNT = 4;
const CHUNK_ROW_COUNT = 4;

const CHUNK_SIZE = 1000;
const CHUNK_BLEND_SIZE = 200;

interface Chunks {
  chunks: Array<Array<number>>;
  rawChunks: Array<Array<number>>;
}

export default class SetupMaps {

  static blendRightEdge (primary: Array<number>, rhs: Array<number>, size: number, blendSize: number): void {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < blendSize; x++) {
        const a = primary[y * size + size - 1 - x] * (x / blendSize * 0.5 + 0.5);
        const b = rhs[(y + blendSize) * (size + 2 * blendSize) + (blendSize - 1 - x)] * (0.5 - x / blendSize * 0.5);
        primary[y * size + size - 1 - x] = a + b;
      }
    }
  }

  static blendLeftEdge (primary: Array<number>, lhs: Array<number>, size: number, blendSize: number): void {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < blendSize; x++) {
        const a = primary[y * size + x] * (x / blendSize * 0.5 + 0.5);
        const b = lhs[(y + blendSize) * (size + 2 * blendSize) + blendSize + size + x] * (0.5 - x / blendSize * 0.5);
        primary[y * size + x] = a + b;
      }
    }
  }

  static blendTopEdge (primary: Array<number>, ths: Array<number>, size: number, blendSize: number): void {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < blendSize; y++) {
        const a = primary[y * size + x] * (y / blendSize * 0.5 + 0.5);
        const b = ths[(blendSize + size + y) * (size + 2 * blendSize) + x + blendSize] * (0.5 - y / blendSize * 0.5);
        primary[y * size + x] = a + b;
      }
    }
  }

  static blendBottomEdge (primary: Array<number>, bhs: Array<number>, size: number, blendSize: number): void {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < blendSize; y++) {
        const a = primary[(size - 1 - y) * size + x] * (y / blendSize * 0.5 + 0.5);
        const b = bhs[(blendSize - 1 - y) * (size + 2 * blendSize) + x + blendSize] * (0.5 - y / blendSize * 0.5);
        primary[(size - 1 - y) * size + x] = a + b;
      }
    }
  }

  static blendEdges (chunkData: Chunks): void {
    for (let chunkY = 0; chunkY < CHUNK_ROW_COUNT; chunkY++) {
      for (let chunkX = 0; chunkX < CHUNK_COLUMN_COUNT; chunkX++) {
        const lhsChunk = chunkData.rawChunks[chunkY * CHUNK_COLUMN_COUNT + (chunkX === 0 ? CHUNK_COLUMN_COUNT : chunkX) - 1];
        const rhsChunk = chunkData.rawChunks[chunkY * CHUNK_COLUMN_COUNT + (chunkX === CHUNK_COLUMN_COUNT - 1 ? 0 : (chunkX + 1))];
        const thsChunk = chunkData.rawChunks[(chunkY === 0 ? (CHUNK_ROW_COUNT - 1) : (chunkY - 1)) * CHUNK_COLUMN_COUNT + chunkX];
        const bhsChunk = chunkData.rawChunks[(chunkY === CHUNK_ROW_COUNT - 1 ? 0 : (chunkY + 1)) * CHUNK_COLUMN_COUNT + chunkX];
        const chunk = chunkData.chunks[chunkY * CHUNK_COLUMN_COUNT + chunkX];

        this.blendRightEdge(chunk, rhsChunk, CHUNK_SIZE, CHUNK_BLEND_SIZE);
        this.blendLeftEdge(chunk, lhsChunk, CHUNK_SIZE, CHUNK_BLEND_SIZE);
        this.blendTopEdge(chunk, thsChunk, CHUNK_SIZE, CHUNK_BLEND_SIZE);
        this.blendBottomEdge(chunk, bhsChunk, CHUNK_SIZE, CHUNK_BLEND_SIZE);
      }
    }
  }

  static createChunks (seed: number): Chunks {
    const rawChunks = [];
    const chunks = [];
    for (let chunkY = 0; chunkY < CHUNK_ROW_COUNT; chunkY++) {
      for (let chunkX = 0; chunkX < CHUNK_COLUMN_COUNT; chunkX++) {
        const rawWidth = CHUNK_SIZE + CHUNK_BLEND_SIZE * 2;
        const rawHeight = CHUNK_SIZE + CHUNK_BLEND_SIZE * 2;
        rawChunks.push(Noise.perlin(rawWidth, rawHeight, {
          seed: `seed-${seed}-${chunkX}-${chunkY}`,
          octaveCount: 8,
          amplitude: 0.1,
          persistence: 0.5
        }));

        const chunk = new Array(CHUNK_SIZE * CHUNK_SIZE);
        for (let y = 0; y < CHUNK_SIZE; y++) {
          for (let x = 0; x < CHUNK_SIZE; x++) {
            chunk[y * CHUNK_SIZE + x] = rawChunks[chunkY * CHUNK_COLUMN_COUNT + chunkX][(y + CHUNK_BLEND_SIZE) * rawWidth + x + CHUNK_BLEND_SIZE];
          }
        }
        chunks.push(chunk);
      }
    }

    return {
      chunks,
      rawChunks
    };
  }

  static saveImage (input: Uint8Array, name: string): Promise<sharp.OutputInfo> {
    return sharp(input, {
      raw: {
        width: CHUNK_SIZE,
        height: CHUNK_SIZE,
        channels: 1
      }
    }).toFile(name);
  }

  static async saveChunks (chunkData: Chunks): Promise<Array<void>> {
    const promises: Array<Promise<void>> = [];
    for (let chunkY = 0; chunkY < CHUNK_ROW_COUNT; chunkY++) {
      for (let chunkX = 0; chunkX < CHUNK_COLUMN_COUNT; chunkX++) {
        const chunk: Array<number> = chunkData.chunks[chunkY * CHUNK_COLUMN_COUNT + chunkX];
        const input: Uint8Array = Uint8Array.from(chunk.map(v => Math.floor(255 * v)));

        promises.push(new Promise((resolve: Function, reject: Function): void => {
          Readable.from([input]).pipe(createGzip())
            .pipe(fs.createWriteStream(`maps/temp-${chunkX}-${chunkY}.bin`))
            .on('finish', () => resolve())
            .on('error', (err: Error) => reject(err));
        }));
      }
    }
    return Promise.all(promises);
  }

  static async setup () {
    await fs.mkdir('maps', { recursive: true });

    const seed = Math.random();
    const chunkData: Chunks = this.createChunks(seed);
    this.blendEdges(chunkData);
    await this.saveChunks(chunkData);
  }

}
