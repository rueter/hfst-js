import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Read core modules
const filesOrder = [
  'constants.js',
  'byte_array.js',
  'flag_diacritic_operation.js',
  'transducer_header.js',
  'transducer_alphabet.js',
  'tables.js',
  'result.js',
  'state.js',
  'transducer.js',
  'analyzer.js',
];

let cjsContent = `/**
 * pyhfst / hfst-js - Pure JavaScript HFST optimized lookup transducer library
 * CommonJS build
 */
'use strict';

const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

`;

for (const file of filesOrder) {
  const filePath = path.join(srcDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Strip multi-line and single-line import statements
  content = content.replace(/import\s*[\s\S]*?from\s*['"][^'"]+['"];?\r?\n/gm, '');
  content = content.replace(/import\s*['"][^'"]+['"];?\r?\n/gm, '');

  // Strip export keywords
  content = content.replace(/^export\s+const\s+/gm, 'const ');
  content = content.replace(/^export\s+function\s+/gm, 'function ');
  content = content.replace(/^export\s+class\s+/gm, 'class ');
  content = content.replace(/^export\s*\{[\s\S]*?\};?\r?\n/gm, '');
  content = content.replace(/^export\s+default\s+[\s\S]*?;?\r?\n/gm, '');

  cjsContent += `// --- ${file} ---\n` + content + '\n\n';
}

// Add HfstInputStream, Hfst, and getTransducer with Node filesystem support
cjsContent += `// --- hfst.js ---
function getTransducer(input) {
  let buffer;
  if (typeof input === 'string') {
    buffer = fs.readFileSync(input);
  } else if (
    (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) ||
    input instanceof Uint8Array ||
    input instanceof ArrayBuffer
  ) {
    buffer = input;
  } else if (input instanceof BinaryReader) {
    const reader = input;
    const header = new TransducerHeader(reader);
    const alphabet = new TransducerAlphabet(reader, header.getSymbolCount());
    return new Transducer(reader, header, alphabet, header.isWeighted());
  } else {
    throw new TypeError(
      'getTransducer: expected a file path string, Buffer, Uint8Array, or ArrayBuffer'
    );
  }

  const reader = new BinaryReader(buffer);
  const header = new TransducerHeader(reader);
  const alphabet = new TransducerAlphabet(reader, header.getSymbolCount());
  return new Transducer(reader, header, alphabet, header.isWeighted());
}

const get_transducer = getTransducer;

class HfstInputStream {
  constructor(pathOrBuffer, cache = true) {
    let resolvedBuffer;
    if (typeof pathOrBuffer === 'string') {
      resolvedBuffer = fs.readFileSync(pathOrBuffer);
    } else {
      resolvedBuffer = pathOrBuffer;
    }
    this.buffer = resolvedBuffer;
    this.path = pathOrBuffer;
    this.cache = typeof cache === 'boolean' ? cache : (cache?.cache ?? true);
  }

  read() {
    const tr = getTransducer(this.buffer);
    return new Hfst(tr, this.cache);
  }

  static fromFile(path, cache = true) {
    return new HfstInputStream(path, cache);
  }

  static fromBuffer(buffer, cache = true) {
    return new HfstInputStream(buffer, cache);
  }

  static async fromUrl(url, { cache = true, fetchOptions } = {}) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error('Failed to fetch transducer: ' + response.statusText);
    }
    const arrayBuffer = await response.arrayBuffer();
    const tr = getTransducer(arrayBuffer);
    return new Hfst(tr, cache);
  }

  static async fromFileAsync(filePath, cache = true) {
    const buffer = await fs.promises.readFile(filePath);
    return new HfstInputStream(buffer, cache).read();
  }
}

class Hfst {
  constructor(tr, cache = true) {
    this.tr = tr;
    this.cache = cache;
    this.mem = new Map();
  }

  static fromFile(path, cache = true) {
    return new HfstInputStream(path, cache).read();
  }

  static fromBuffer(buffer, cache = true) {
    return new HfstInputStream(buffer, cache).read();
  }

  lookup(string, timeCutoff = 0.0) {
    const cutoff =
      typeof timeCutoff === 'number'
        ? timeCutoff
        : (timeCutoff?.timeCutoff ?? timeCutoff?.time_cutoff ?? 0.0);

    let result;
    if (this.cache && cutoff === 0.0) {
      if (!this.mem.has(string)) {
        this.mem.set(string, new Analyzer(this.tr, string, cutoff).analyze());
      }
      result = this.mem.get(string);
    } else {
      result = new Analyzer(this.tr, string, cutoff).analyze();
    }
    return result.map((r) => [r.getSymbols().join(''), r.getWeight()]);
  }

  lookupResults(string, timeCutoff = 0.0) {
    const cutoff =
      typeof timeCutoff === 'number'
        ? timeCutoff
        : (timeCutoff?.timeCutoff ?? timeCutoff?.time_cutoff ?? 0.0);

    if (this.cache && cutoff === 0.0) {
      if (!this.mem.has(string)) {
        this.mem.set(string, new Analyzer(this.tr, string, cutoff).analyze());
      }
      return this.mem.get(string);
    }
    return new Analyzer(this.tr, string, cutoff).analyze();
  }
}

// --- Exports ---
const pyhfst = {
  TRANSITION_TARGET_TABLE_START,
  INFINITE_WEIGHT,
  NO_SYMBOL_NUMBER,
  NO_TABLE_INDEX,
  ByteArray,
  BinaryReader,
  uint32BitsToFloat32,
  FlagDiacriticOperator,
  FlagDiacriticOperation,
  TransducerHeader,
  TransducerAlphabet,
  IndexTable,
  TransitionTable,
  Result,
  State,
  Transducer,
  Analyzer,
  HfstInputStream,
  Hfst,
  getTransducer,
  get_transducer,
};

module.exports = pyhfst;
Object.assign(module.exports, pyhfst);
`;

const outputPath = path.join(distDir, 'index.cjs');
fs.writeFileSync(outputPath, cjsContent, 'utf-8');
console.log(`Built ${outputPath} successfully (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
