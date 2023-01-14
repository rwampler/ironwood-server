
import random from 'random';
import seedrandom from 'seedrandom';

function interpolate(x0:number, x1:number, alpha:number):number {
  return x0 * (1 - alpha) + alpha * x1;
}

type SmoothNoiseOptions = {
  seed?: string;
  whiteNoise?: Array<number>;
};

type Options = {
  seed?: string;
  octaveCount?: number;
  amplitude?: number;
  persistence?: number;
};

export default class Noise {

  static white (width:number, height:number, seed:string | null):Array<number> {
    const rng = random.clone(seedrandom(seed ?? "default-seed"));
    var noise = new Array(width * height);
    for (var i = 0; i < noise.length; ++i) {
      noise[i] = rng.float();
    }
    return noise;
  }

  static smooth (width:number, height:number, octave:number, options:SmoothNoiseOptions | null):Array<number> {
    const whiteNoise = options?.whiteNoise ?? Noise.white(width, height, options?.seed ?? "default-seed");
    const noise = new Array(width * height);
    const samplePeriod = Math.pow(2, octave);
    const sampleFrequency = 1 / samplePeriod;

    let noiseIndex = 0;
    for (let y = 0; y < height; ++y) {
      const sampleY0 = Math.floor(y / samplePeriod) * samplePeriod;
      const sampleY1 = (sampleY0 + samplePeriod) % height;
      const vertBlend = (y - sampleY0) * sampleFrequency;
      for (var x = 0; x < width; ++x) {
        const sampleX0 = Math.floor(x / samplePeriod) * samplePeriod;
        const sampleX1 = (sampleX0 + samplePeriod) % width;
        const horizBlend = (x - sampleX0) * sampleFrequency;

        // blend top two corners
        const top = interpolate(whiteNoise[sampleY0 * width + sampleX0], whiteNoise[sampleY1 * width + sampleX0], vertBlend);
        // blend bottom two corners
        const bottom = interpolate(whiteNoise[sampleY0 * width + sampleX1], whiteNoise[sampleY1 * width + sampleX1], vertBlend);
        // final blend
        noise[noiseIndex] = interpolate(top, bottom, horizBlend);
        noiseIndex += 1;
      }
    }
    return noise;
  }

  static perlin (width:number, height:number, options: Options | null):Array<number> {
    const whiteNoise = Noise.white(width, height, options?.seed ?? "default-seed");

    const octaveCount = options?.octaveCount ?? 4;
    const smoothNoiseList = new Array(octaveCount);
    for (let i = 0; i < octaveCount; ++i) {
      smoothNoiseList[i] = Noise.smooth(width, height, i, { whiteNoise });
    }

    const perlinNoise = new Array(width * height);
    var totalAmplitude = 0;

    // blend noise together
    const persistence = options?.persistence ?? 0.2;
    let amplitude = options?.amplitude ?? 0.1;
    for (let i = octaveCount - 1; i >= 0; --i) {
      amplitude *= persistence;
      totalAmplitude += amplitude;

      for (var j = 0; j < perlinNoise.length; ++j) {
        perlinNoise[j] = perlinNoise[j] || 0;
        perlinNoise[j] += smoothNoiseList[i][j] * amplitude;
      }
    }

    // normalization
    for (let i = 0; i < perlinNoise.length; ++i) {
      perlinNoise[i] /= totalAmplitude;
    }

    return perlinNoise;
  }

}



