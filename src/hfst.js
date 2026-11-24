import fs from 'node:fs';
import {
  HfstInputStream as CoreHfstInputStream,
  Hfst as CoreHfst,
  getTransducer as coreGetTransducer,
} from './core.js';

/**
 * Creates a Transducer instance from the given transducer file path, Buffer, or Uint8Array.
 * @param {string | Buffer | Uint8Array | ArrayBuffer} input
 * @returns {import('./transducer.js').Transducer}
 */
export function getTransducer(input) {
  if (typeof input === 'string') {
    const buffer = fs.readFileSync(input);
    return coreGetTransducer(buffer);
  }
  return coreGetTransducer(input);
}

export const get_transducer = getTransducer;

/**
 * Class representing an HFST input stream, supporting file paths and buffers.
 */
export class HfstInputStream extends CoreHfstInputStream {
  /**
   * @param {string | Buffer | Uint8Array | ArrayBuffer} pathOrBuffer
   * @param {boolean | { cache?: boolean }} [cache=true]
   */
  constructor(pathOrBuffer, cache = true) {
    let resolvedBuffer;
    if (typeof pathOrBuffer === 'string') {
      resolvedBuffer = fs.readFileSync(pathOrBuffer);
    } else {
      resolvedBuffer = pathOrBuffer;
    }
    super(resolvedBuffer, cache);
    this.path = pathOrBuffer;
  }

  /**
   * Creates an HfstInputStream from a file path.
   * @param {string} path
   * @param {boolean | { cache?: boolean }} [cache=true]
   * @returns {HfstInputStream}
   */
  static fromFile(path, cache = true) {
    return new HfstInputStream(path, cache);
  }

  /**
   * Asynchronously reads a transducer from disk in Node.js.
   * @param {string} filePath
   * @param {boolean} [cache=true]
   * @returns {Promise<Hfst>}
   */
  static async fromFileAsync(filePath, cache = true) {
    const buffer = await fs.promises.readFile(filePath);
    return new HfstInputStream(buffer, cache).read();
  }
}

export const Hfst = CoreHfst;
