/**
 * pyhfst / hfst-js - Pure JavaScript HFST optimized lookup transducer library
 * CommonJS build
 */
'use strict';

const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

// --- constants.js ---
/**
 * Constants used across HFST transducer operations and tables.
 */

/**
 * Marks transition targets that point into the transition table
 * rather than the index table (2^31).
 */
const TRANSITION_TARGET_TABLE_START = 2147483648;

/**
 * Representation of infinite weight (equivalent to static_cast<float>(UINT_MAX)).
 */
const INFINITE_WEIGHT = 4294967295.0;

/**
 * Sentinel value representing the absence of a symbol (USHRT_MAX = 65535).
 */
const NO_SYMBOL_NUMBER = 65535;

/**
 * Sentinel value representing an invalid or non-existent table index (UINT_MAX = 4294967295).
 */
const NO_TABLE_INDEX = 4294967295;


// --- byte_array.js ---
/**
 * Binary data handling classes for reading HFST files.
 */

const float32ConvBuf = new ArrayBuffer(4);
const float32ConvUint = new Uint32Array(float32ConvBuf);
const float32ConvFloat = new Float32Array(float32ConvBuf);

/**
 * Reinterprets an unsigned 32-bit integer's bit pattern as a 32-bit float.
 * @param {number} uintVal
 * @returns {number}
 */
function uint32BitsToFloat32(uintVal) {
  float32ConvUint[0] = uintVal;
  return float32ConvFloat[0];
}

/**
 * High-performance sequential binary reader over an ArrayBuffer or Uint8Array.
 */
class BinaryReader {
  /**
   * @param {Uint8Array | ArrayBuffer | Buffer} input
   */
  constructor(input) {
    if (input instanceof Uint8Array) {
      this.bytes = input;
    } else if (input instanceof ArrayBuffer) {
      this.bytes = new Uint8Array(input);
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
      this.bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
      throw new TypeError('Expected Uint8Array, Buffer, or ArrayBuffer');
    }
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.offset = 0;
  }

  get remaining() {
    return this.bytes.length - this.offset;
  }

  readBytes(n) {
    if (this.offset + n > this.bytes.length) {
      throw new RangeError(
        `Unexpected end of binary data: requested ${n} bytes at offset ${this.offset}, but only ${this.bytes.length - this.offset} bytes remain`
      );
    }
    const slice = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }

  getUByte() {
    if (this.offset >= this.bytes.length) {
      throw new RangeError(`Unexpected end of data at offset ${this.offset}`);
    }
    const val = this.bytes[this.offset];
    this.offset += 1;
    return val;
  }

  getUShort() {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  getUInt() {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  getBool() {
    return this.getUInt() !== 0;
  }

  getFloat() {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }
}

/**
 * A class for handling byte arrays with various read operations,
 * matching pyhfst.byte_array.ByteArray.
 */
class ByteArray {
  /**
   * @param {number | Uint8Array | ArrayBuffer | ByteArray} [s] - Size or buffer
   * @param {ByteArray | null} [another] - Optional another ByteArray to clone from
   */
  constructor(s = 0, another = null) {
    if (another != null) {
      const neededSize = Math.max(
        typeof s === 'number' ? s : (s?.getSize?.() ?? 0),
        another.getSize()
      );
      this.bytes = new Uint8Array(neededSize);
      const src = another.getBytes();
      this.bytes.set(src.subarray(0, neededSize));
      this.size = neededSize;
    } else if (typeof s === 'number') {
      this.bytes = new Uint8Array(s);
      this.size = s;
    } else if (s instanceof ByteArray) {
      this.bytes = new Uint8Array(s.bytes);
      this.size = s.size;
    } else if (s instanceof Uint8Array) {
      this.bytes = s;
      this.size = s.length;
    } else if (s instanceof ArrayBuffer) {
      this.bytes = new Uint8Array(s);
      this.size = this.bytes.length;
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(s)) {
      this.bytes = new Uint8Array(s.buffer, s.byteOffset, s.byteLength);
      this.size = this.bytes.length;
    } else {
      this.bytes = new Uint8Array(0);
      this.size = 0;
    }

    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.index = 0;
  }

  getSize() {
    return this.size;
  }

  get_size() {
    return this.getSize();
  }

  get(i) {
    return this.bytes[i];
  }

  getBytes() {
    return this.bytes;
  }

  get_bytes() {
    return this.getBytes();
  }

  getUByte() {
    const result = this.bytes[this.index];
    this.index += 1;
    return result;
  }

  get_ubyte() {
    return this.getUByte();
  }

  getUShort() {
    const result = this.view.getUint16(this.index, true);
    this.index += 2;
    return result;
  }

  get_ushort() {
    return this.getUShort();
  }

  getUInt() {
    const result = this.view.getUint32(this.index, true);
    this.index += 4;
    return result;
  }

  get_uint() {
    return this.getUInt();
  }

  getBool() {
    return this.getUInt() !== 0;
  }

  get_bool() {
    return this.getBool();
  }

  getFloat() {
    const result = this.view.getFloat32(this.index, true);
    this.index += 4;
    return result;
  }

  get_float() {
    return this.getFloat();
  }
}


// --- flag_diacritic_operation.js ---

/**
 * Enum representing flag diacritic operators in HFST.
 * Supports both name-to-value and value-to-name mappings.
 */
const FlagDiacriticOperator = Object.freeze({
  P: 0, // Positive set
  N: 1, // Negative set
  R: 2, // Require
  D: 3, // Disallow
  C: 4, // Clear
  U: 5, // Unification
  0: 'P',
  1: 'N',
  2: 'R',
  3: 'D',
  4: 'C',
  5: 'U',
});

/**
 * Class representing a flag diacritic operation.
 */
class FlagDiacriticOperation {
  /**
   * @param {number | null} [operation] - Flag diacritic operator (from FlagDiacriticOperator)
   * @param {number | null} [feat] - Feature index
   * @param {number | null} [val] - Value index
   */
  constructor(operation = null, feat = null, val = null) {
    if (operation !== null) {
      this.op = operation;
      this.feature = feat;
      this.value = val;
    } else {
      this.op = FlagDiacriticOperator.P;
      this.feature = NO_SYMBOL_NUMBER;
      this.value = 0;
    }
  }

  /**
   * Checks if the operation is a flag diacritic operation.
   * @returns {boolean}
   */
  isFlag() {
    return this.feature !== NO_SYMBOL_NUMBER;
  }

  is_flag() {
    return this.isFlag();
  }
}


// --- transducer_header.js ---

/**
 * Class representing the header of an HFST optimized lookup transducer.
 */
class TransducerHeader {
  /**
   * @param {BinaryReader} reader
   */
  constructor(reader) {
    let readBytes = reader.readBytes(5);
    if (this.beginsHfst3Header(readBytes)) {
      this.hfst3 = true;
      const remaining = reader.getUShort();
      // Skip remaining + 1 bytes (to match standard HFST format)
      reader.readBytes(remaining + 1);
      readBytes = reader.readBytes(56);
    } else {
      const rest = reader.readBytes(56 - 5);
      const combined = new Uint8Array(56);
      combined.set(readBytes);
      combined.set(rest, 5);
      readBytes = combined;
      this.hfst3 = false;
    }

    const subReader = new BinaryReader(readBytes);
    this.numberOfInputSymbols = subReader.getUShort();
    this.numberOfSymbols = subReader.getUShort();
    this.sizeOfTransitionIndexTable = subReader.getUInt();
    this.sizeOfTransitionTargetTable = subReader.getUInt();
    this.numberOfStates = subReader.getUInt();
    this.numberOfTransitions = subReader.getUInt();
    this.weighted = subReader.getBool();
    this.deterministic = subReader.getBool();
    this.inputDeterministic = subReader.getBool();
    this.minimized = subReader.getBool();
    this.cyclic = subReader.getBool();
    this.hasEpsilonEpsilonTransitions = subReader.getBool();
    this.hasInputEpsilonTransitions = subReader.getBool();
    this.hasInputEpsilonCycles = subReader.getBool();
    this.hasUnweightedInputEpsilonCycles = subReader.getBool();

    // Snake_case aliases matching pyhfst
    this.number_of_input_symbols = this.numberOfInputSymbols;
    this.number_of_symbols = this.numberOfSymbols;
    this.size_of_transition_index_table = this.sizeOfTransitionIndexTable;
    this.size_of_transition_target_table = this.sizeOfTransitionTargetTable;
    this.number_of_states = this.numberOfStates;
    this.number_of_transitions = this.numberOfTransitions;
    this.input_deterministic = this.inputDeterministic;
    this.has_epsilon_epsilon_transitions = this.hasEpsilonEpsilonTransitions;
    this.has_input_epsilon_transitions = this.hasInputEpsilonTransitions;
    this.has_input_epsilon_cycles = this.hasInputEpsilonCycles;
    this.has_unweighted_input_epsilon_cycles = this.hasUnweightedInputEpsilonCycles;
  }

  /**
   * Checks if the given bytes begin with the HFST3 header ("HFST\0").
   * @param {Uint8Array} bytes
   * @returns {boolean}
   */
  beginsHfst3Header(bytes) {
    return (
      bytes.length >= 5 &&
      bytes[0] === 0x48 && // 'H'
      bytes[1] === 0x46 && // 'F'
      bytes[2] === 0x53 && // 'S'
      bytes[3] === 0x54 && // 'T'
      bytes[4] === 0x00
    );
  }

  begins_hfst3_header(bytes) {
    return this.beginsHfst3Header(bytes);
  }

  getInputSymbolCount() {
    return this.numberOfInputSymbols;
  }

  get_input_symbol_count() {
    return this.numberOfInputSymbols;
  }

  getSymbolCount() {
    return this.numberOfSymbols;
  }

  get_symbol_count() {
    return this.numberOfSymbols;
  }

  getIndexTableSize() {
    return this.sizeOfTransitionIndexTable;
  }

  get_index_table_size() {
    return this.sizeOfTransitionIndexTable;
  }

  getTargetTableSize() {
    return this.sizeOfTransitionTargetTable;
  }

  get_target_table_size() {
    return this.sizeOfTransitionTargetTable;
  }

  isWeighted() {
    return this.weighted;
  }

  is_weighted() {
    return this.weighted;
  }

  hasHfst3Header() {
    return Boolean(this.hfst3);
  }

  has_hfst3_header() {
    return this.hasHfst3Header();
  }
}


// --- transducer_alphabet.js ---

/**
 * Class representing the alphabet of the transducer, including flag diacritics.
 */
class TransducerAlphabet {
  /**
   * @param {import('./byte_array.js').BinaryReader} reader
   * @param {number} numberOfSymbols
   */
  constructor(reader, numberOfSymbols) {
    /** @type {string[]} */
    this.keyTable = [];
    /** @type {Record<number, FlagDiacriticOperation>} */
    this.operations = {};
    /** @type {Record<string, number>} */
    const featureBucket = {};
    /** @type {Record<string, number>} */
    const valueBucket = { '': 0 }; // neutral value is 0
    this.features = 0;
    let values = 1;

    const utf8Decoder = new TextDecoder('utf-8');
    const bytes = reader.bytes;

    for (let s = 0; s < numberOfSymbols; s++) {
      const startOffset = reader.offset;
      while (reader.offset < bytes.length && bytes[reader.offset] !== 0) {
        reader.offset++;
      }
      const ustring = utf8Decoder.decode(bytes.subarray(startOffset, reader.offset));
      if (reader.offset < bytes.length && bytes[reader.offset] === 0) {
        reader.offset++; // skip null terminator byte
      }

      if (
        ustring.length > 5 &&
        ustring.startsWith('@') &&
        ustring.endsWith('@') &&
        ustring[2] === '.'
      ) {
        // Flag diacritic identified
        const parts = ustring.slice(1, -1).split('.');
        if (parts.length < 2) {
          this.keyTable.push('');
          continue;
        }

        const ops = parts[0];
        const feats = parts[1];
        const vals = parts.length > 2 ? parts[2] : '';

        const op = FlagDiacriticOperator[ops];
        if (op === undefined || typeof op !== 'number') {
          // Not a valid operator, ignore the operation
          this.keyTable.push('');
          continue;
        }

        if (!(vals in valueBucket)) {
          valueBucket[vals] = values;
          values++;
        }
        if (!(feats in featureBucket)) {
          featureBucket[feats] = this.features;
          this.features++;
        }

        this.operations[this.keyTable.length] = new FlagDiacriticOperation(
          op,
          featureBucket[feats],
          valueBucket[vals]
        );
        this.keyTable.push('');
        continue;
      }

      this.keyTable.push(ustring);
    }

    this.keyTable[0] = ''; // epsilon is zero
  }
}


// --- tables.js ---

/**
 * A table to store input symbols and their corresponding target indices.
 */
class IndexTable {
  /**
   * @param {import('./byte_array.js').BinaryReader} reader
   * @param {number} indicesCount
   */
  constructor(reader, indicesCount) {
    this.tiInputSymbols = new Uint16Array(indicesCount);
    this.tiTargets = new Uint32Array(indicesCount);

    const view = reader.view;
    let offset = reader.offset;
    for (let i = 0; i < indicesCount; i++) {
      this.tiInputSymbols[i] = view.getUint16(offset, true);
      this.tiTargets[i] = view.getUint32(offset + 2, true);
      offset += 6;
    }
    reader.offset = offset;

    // Snake_case aliases matching pyhfst
    this.ti_input_symbols = this.tiInputSymbols;
    this.ti_targets = this.tiTargets;
  }

  /**
   * Returns the input symbol at the given index.
   * @param {number} i
   * @returns {number}
   */
  getInput(i) {
    if (i < 0 || i >= this.tiInputSymbols.length) return NO_SYMBOL_NUMBER;
    return this.tiInputSymbols[i];
  }

  get_input(i) {
    return this.getInput(i);
  }

  /**
   * Returns the target index at the given index.
   * @param {number} i
   * @returns {number}
   */
  getTarget(i) {
    if (i < 0 || i >= this.tiTargets.length) return NO_TABLE_INDEX;
    return this.tiTargets[i];
  }

  get_target(i) {
    return this.getTarget(i);
  }

  /**
   * Checks if the given index is a final state.
   * @param {number} i
   * @returns {boolean}
   */
  isFinal(i) {
    if (i < 0 || i >= this.tiInputSymbols.length) return false;
    return (
      this.tiInputSymbols[i] === NO_SYMBOL_NUMBER &&
      this.tiTargets[i] !== NO_TABLE_INDEX
    );
  }

  is_final(i) {
    return this.isFinal(i);
  }

  /**
   * Returns the final weight for the given index.
   * In HFST index tables, the target uint32 bit pattern of a final state encodes a float32 weight.
   * @param {number} i
   * @returns {number}
   */
  getFinalWeight(i) {
    return uint32BitsToFloat32(this.tiTargets[i]);
  }

  get_final_weight(i) {
    return this.getFinalWeight(i);
  }

  /**
   * Returns the size of the index table.
   * @returns {number}
   */
  size() {
    return this.tiTargets.length;
  }
}

/**
 * A table to store transitions between states.
 */
class TransitionTable {
  /**
   * @param {import('./byte_array.js').BinaryReader} reader
   * @param {number} transitionCount
   * @param {boolean} [isWeighted=true]
   */
  constructor(reader, transitionCount, isWeighted = true) {
    this.isWeighted = isWeighted;
    this.is_weighted = isWeighted;
    this.tiInputSymbols = new Uint16Array(transitionCount);
    this.tiOutputSymbols = new Uint16Array(transitionCount);
    this.tiTargets = new Uint32Array(transitionCount);
    this.tiWeights = isWeighted ? new Float32Array(transitionCount) : null;

    const view = reader.view;
    let offset = reader.offset;

    if (isWeighted) {
      for (let i = 0; i < transitionCount; i++) {
        this.tiInputSymbols[i] = view.getUint16(offset, true);
        this.tiOutputSymbols[i] = view.getUint16(offset + 2, true);
        this.tiTargets[i] = view.getUint32(offset + 4, true);
        this.tiWeights[i] = view.getFloat32(offset + 8, true);
        offset += 12;
      }
    } else {
      for (let i = 0; i < transitionCount; i++) {
        this.tiInputSymbols[i] = view.getUint16(offset, true);
        this.tiOutputSymbols[i] = view.getUint16(offset + 2, true);
        this.tiTargets[i] = view.getUint32(offset + 4, true);
        offset += 8;
      }
    }
    reader.offset = offset;

    // Snake_case aliases matching pyhfst
    this.ti_input_symbols = this.tiInputSymbols;
    this.ti_output_symbols = this.tiOutputSymbols;
    this.ti_targets = this.tiTargets;
    this.ti_weights = this.tiWeights;
  }

  /**
   * Returns the input symbol at the given position.
   * @param {number} pos
   * @returns {number}
   */
  getInput(pos) {
    if (pos < 0 || pos >= this.tiInputSymbols.length) return NO_SYMBOL_NUMBER;
    return this.tiInputSymbols[pos];
  }

  get_input(pos) {
    return this.getInput(pos);
  }

  /**
   * Returns the output symbol at the given position.
   * @param {number} pos
   * @returns {number}
   */
  getOutput(pos) {
    if (pos < 0 || pos >= this.tiOutputSymbols.length) return NO_SYMBOL_NUMBER;
    return this.tiOutputSymbols[pos];
  }

  get_output(pos) {
    return this.getOutput(pos);
  }

  /**
   * Returns the target index at the given position.
   * @param {number} pos
   * @returns {number}
   */
  getTarget(pos) {
    if (pos < 0 || pos >= this.tiTargets.length) return NO_TABLE_INDEX;
    return this.tiTargets[pos];
  }

  get_target(pos) {
    return this.getTarget(pos);
  }

  /**
   * Returns the weight at the given position.
   * @param {number} pos
   * @returns {number}
   */
  getWeight(pos) {
    if (!this.isWeighted) {
      throw new Error('Getting weights of unweighted FST.');
    }
    if (pos < 0 || pos >= this.tiWeights.length) return 0.0;
    return this.tiWeights[pos];
  }

  get_weight(pos) {
    return this.getWeight(pos);
  }

  /**
   * Checks if the given position is a final state.
   * @param {number} pos
   * @returns {boolean}
   */
  isFinal(pos) {
    if (pos < 0 || pos >= this.tiInputSymbols.length) return false;
    return (
      this.tiInputSymbols[pos] === NO_SYMBOL_NUMBER &&
      this.tiOutputSymbols[pos] === NO_SYMBOL_NUMBER &&
      this.tiTargets[pos] === 1
    );
  }

  is_final(pos) {
    return this.isFinal(pos);
  }

  /**
   * Returns the size of the transition table.
   * @returns {number}
   */
  size() {
    return this.tiTargets.length;
  }
}


// --- result.js ---
/**
 * Class representing an analysis result with symbols and weight.
 */
class Result {
  /**
   * @param {string[]} symbols - List of symbols in the result.
   * @param {number} weight - Weight associated with the result.
   */
  constructor(symbols, weight) {
    this.symbols = symbols;
    this.weight = weight;
  }

  /**
   * Returns the list of symbols in the result.
   * @returns {string[]}
   */
  getSymbols() {
    return this.symbols;
  }

  get_symbols() {
    return this.symbols;
  }

  /**
   * Returns the weight associated with the result.
   * @returns {number}
   */
  getWeight() {
    return this.weight;
  }

  get_weight() {
    return this.weight;
  }

  /**
   * Returns a string representation of the result in the format "(text: weight)".
   * @returns {string}
   */
  toString() {
    return this.symbols.join('') + ': ' + this.weight;
  }

  __str__() {
    return this.toString();
  }
}


// --- state.js ---

/**
 * Class representing the state during FST traversal and analysis.
 */
class State {
  /**
   * @param {string} input - The input string to be analyzed.
   * @param {import('./transducer.js').Transducer} parent - The parent transducer.
   */
  constructor(input, parent) {
    this.parent = parent;
    this.state_stack = [];
    const neutral = new Array(parent.alphabet.features).fill(0);
    this.state_stack.push(neutral);
    this.output_string = new Array(1000).fill(NO_SYMBOL_NUMBER);
    this.input_string = Array.from(this.findKey(input));
    this.output_pointer = 0;
    this.input_pointer = 0;
    this.current_weight = 0.0;
    /** @type {import('./result.js').Result[]} */
    this.display_vector = [];
  }

  get stateStack() {
    return this.state_stack;
  }
  set stateStack(val) {
    this.state_stack = val;
  }

  get outputString() {
    return this.output_string;
  }
  set outputString(val) {
    this.output_string = val;
  }

  get inputString() {
    return this.input_string;
  }
  set inputString(val) {
    this.input_string = val;
  }

  get outputPointer() {
    return this.output_pointer;
  }
  set outputPointer(val) {
    this.output_pointer = val;
  }

  get inputPointer() {
    return this.input_pointer;
  }
  set inputPointer(val) {
    this.input_pointer = val;
  }

  get currentWeight() {
    return this.current_weight;
  }
  set currentWeight(val) {
    this.current_weight = val;
  }

  get displayVector() {
    return this.display_vector;
  }
  set displayVector(val) {
    this.display_vector = val;
  }

  /**
   * Tokenizes the index string into symbol IDs matching the transducer symbol map.
   * Uses longest-prefix matching, identical to pyhfst.
   * @param {string} indexString
   * @returns {Generator<number, void, unknown>}
   */
  *findKey(indexString) {
    let i = 0;
    while (i < indexString.length) {
      let matchFound = false;
      for (let length = indexString.length - i; length > 0; length--) {
        const substr = indexString.slice(i, i + length);
        let mapPointer = this.parent.symbol_map;
        let fullMatch = true;
        for (let k = 0; k < substr.length; k++) {
          const char = substr[k];
          if (mapPointer && char in mapPointer) {
            mapPointer = mapPointer[char];
          } else {
            fullMatch = false;
            break;
          }
        }
        if (fullMatch) {
          if (mapPointer && null in mapPointer) {
            yield mapPointer[null];
            i += length - 1;
            matchFound = true;
          }
          break;
        }
      }
      if (!matchFound) {
        yield NO_SYMBOL_NUMBER;
      }
      i++;
    }
    yield NO_SYMBOL_NUMBER;
  }

  find_key(indexString) {
    return this.findKey(indexString);
  }
}


// --- transducer.js ---

/**
 * Class representing a finite state transducer for morphological analysis/generation.
 */
class Transducer {
  /**
   * @param {BinaryReader | Uint8Array | ArrayBuffer | Buffer} file - Transducer data reader or buffer
   * @param {import('./transducer_header.js').TransducerHeader} h - Transducer header
   * @param {import('./transducer_alphabet.js').TransducerAlphabet} a - Transducer alphabet
   * @param {boolean} [isWeighted=true] - Whether the transducer is weighted
   */
  constructor(file, h, a, isWeighted = true) {
    const reader = file instanceof BinaryReader ? file : new BinaryReader(file);
    this.header = h;
    this.alphabet = a;
    this.is_weighted = isWeighted;
    this.isWeighted = isWeighted;
    this.operations = this.alphabet.operations;

    this.symbol_map = {};
    this.constructSymbolMap();

    this.index_table = new IndexTable(reader, h.getIndexTableSize());
    this.indexTable = this.index_table;

    this.transition_table = new TransitionTable(
      reader,
      h.getTargetTableSize(),
      this.is_weighted
    );
    this.transitionTable = this.transition_table;
  }

  get symbolMap() {
    return this.symbol_map;
  }
  set symbolMap(val) {
    this.symbol_map = val;
  }

  /**
   * Constructs the prefix trie / symbol map from the transducer alphabet.
   */
  constructSymbolMap() {
    for (let i = 0; i < this.header.getInputSymbolCount(); i++) {
      const w = this.alphabet.keyTable[i];
      if (w.length <= 1) {
        if (!(w in this.symbol_map)) {
          this.symbol_map[w] = { [null]: i };
        } else {
          this.symbol_map[w][null] = i;
        }
      } else {
        if (!(w[0] in this.symbol_map)) {
          this.symbol_map[w[0]] = {};
        }
        let o = this.symbol_map[w[0]];
        for (let j = 1; j < w.length; j++) {
          const c = w[j];
          if (!(c in o)) {
            o[c] = {};
          }
          o = o[c];
        }
        if (null in o) {
          throw new Error('Duplicate symbol in symbol map');
        }
        o[null] = i;
      }
    }
  }

  construct_symbol_map() {
    this.constructSymbolMap();
  }
}


// --- analyzer.js ---

/**
 * Returns current timestamp in seconds.
 * Uses performance.now if available, otherwise Date.now.
 * @returns {number}
 */
function getNowSeconds() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now() / 1000;
  }
  return Date.now() / 1000;
}

/**
 * Core traversal analyzer for HFST transducers.
 */
class Analyzer {
  /**
   * @param {import('./transducer.js').Transducer} transducer
   * @param {string} inputStr
   * @param {number} [timeCutoff=0.0] - Maximum time in seconds for the lookup operation (0.0 = no limit)
   */
  constructor(transducer, inputStr, timeCutoff = 0.0) {
    this.transducer = transducer;
    this.input_str = inputStr;
    this.inputStr = inputStr;
    this.state = new State(inputStr, this.transducer);
    this.time_cutoff = timeCutoff;
    this.timeCutoff = timeCutoff;
    this.start_time = timeCutoff > 0.0 ? getNowSeconds() : 0.0;
    this.startTime = this.start_time;
  }

  /**
   * Computes the pivot for the given index.
   * If i >= TRANSITION_TARGET_TABLE_START (2^31), shifts it to point into the transition table.
   * @param {number} i
   * @returns {number}
   */
  pivot(i) {
    if (i >= TRANSITION_TARGET_TABLE_START) {
      return i - TRANSITION_TARGET_TABLE_START;
    }
    return i;
  }

  /**
   * Checks if the time cutoff has been exceeded.
   * @returns {boolean}
   */
  isTimeExceeded() {
    if (this.timeCutoff > 0.0) {
      const elapsed = getNowSeconds() - this.startTime;
      return elapsed > this.timeCutoff;
    }
    return false;
  }

  is_time_exceeded() {
    return this.isTimeExceeded();
  }

  /**
   * Tries epsilon indices for the given index.
   * @param {number} index
   */
  tryEpsilonIndices(index) {
    if (this.transducer.index_table.getInput(index) === 0) {
      this.tryEpsilonTransitions(
        this.pivot(this.transducer.index_table.getTarget(index))
      );
    }
  }

  try_epsilon_indices(index) {
    this.tryEpsilonIndices(index);
  }

  /**
   * Tries epsilon transitions for the given index.
   * @param {number} index
   */
  tryEpsilonTransitions(index) {
    while (true) {
      const inputSymbol = this.transducer.transition_table.getInput(index);

      if (this.transducer.operations[inputSymbol]) {
        if (!this.pushState(this.transducer.operations[inputSymbol])) {
          index++;
          continue;
        }
        this.handleEpsilonTransition(index);
        index++;
        this.state.state_stack.pop();
        continue;
      } else if (inputSymbol === 0) {
        this.handleEpsilonTransition(index);
        index++;
        continue;
      } else {
        break;
      }
    }
  }

  try_epsilon_transitions(index) {
    this.tryEpsilonTransitions(index);
  }

  /**
   * Finds the index in the transducer for the given index.
   * @param {number} index
   */
  findIndex(index) {
    const prevSym = this.state.input_string[this.state.input_pointer - 1];
    if (this.transducer.index_table.getInput(index + prevSym) === prevSym) {
      this.findTransitions(
        this.pivot(this.transducer.index_table.getTarget(index + prevSym))
      );
    }
  }

  find_index(index) {
    this.findIndex(index);
  }

  /**
   * Handles epsilon transitions for the given index.
   * @param {number} index
   */
  handleEpsilonTransition(index) {
    this.updateOutputString(this.transducer.transition_table.getOutput(index));
    this.state.output_pointer++;

    if (this.transducer.is_weighted) {
      this.state.current_weight += this.transducer.transition_table.getWeight(index);
    }

    this.getAnalyses(this.transducer.transition_table.getTarget(index));

    if (this.transducer.is_weighted) {
      this.state.current_weight -= this.transducer.transition_table.getWeight(index);
    }

    this.state.output_pointer--;
  }

  handle_epsilon_transition(index) {
    this.handleEpsilonTransition(index);
  }

  /**
   * Finds transitions in the transducer for the given index.
   * @param {number} index
   */
  findTransitions(index) {
    const tableSize = this.transducer.transition_table.size();
    const prevSym = this.state.input_string[this.state.input_pointer - 1];

    for (let idx = index; idx < tableSize; idx++) {
      const inputSymbol = this.transducer.transition_table.getInput(idx);

      if (inputSymbol === NO_SYMBOL_NUMBER) {
        break;
      }

      if (inputSymbol === prevSym) {
        this.updateOutputString(this.transducer.transition_table.getOutput(idx));
        this.state.output_pointer++;

        if (this.transducer.is_weighted) {
          this.state.current_weight += this.transducer.transition_table.getWeight(idx);
        }

        this.getAnalyses(this.transducer.transition_table.getTarget(idx));

        if (this.transducer.is_weighted) {
          this.state.current_weight -= this.transducer.transition_table.getWeight(idx);
        }

        this.state.output_pointer--;
      } else {
        break;
      }
    }
  }

  find_transitions(index) {
    this.findTransitions(index);
  }

  /**
   * Gets analyses for the given index.
   * @param {number} idx
   */
  getAnalyses(idx) {
    if (this.isTimeExceeded()) {
      return;
    }

    const index = this.pivot(idx);
    const isTransition = idx >= TRANSITION_TARGET_TABLE_START;

    if (isTransition) {
      const nextV = this.transducer.is_weighted ? this.pivot(index) : index;
      this.tryEpsilonTransitions(nextV + 1);
    } else {
      this.tryEpsilonIndices(index + 1);
    }

    if (this.state.input_string[this.state.input_pointer] === NO_SYMBOL_NUMBER) {
      this.handleEndOfInputString(index, isTransition);
      return;
    }

    this.state.input_pointer++;

    if (isTransition) {
      this.findTransitions(index + 1);
    } else {
      this.findIndex(index + 1);
    }

    this.state.input_pointer--;
    this.resetOutputPointer();
  }

  get_analyses(idx) {
    this.getAnalyses(idx);
  }

  /**
   * Updates the output string in the state based on the output symbol.
   * @param {number} outputSymbol
   */
  updateOutputString(outputSymbol) {
    if (this.state.output_pointer === this.state.output_string.length) {
      this.state.output_string.push(outputSymbol);
    } else {
      this.state.output_string[this.state.output_pointer] = outputSymbol;
    }
  }

  update_output_string(outputSymbol) {
    this.updateOutputString(outputSymbol);
  }

  /**
   * Handles reaching the end of the input string.
   * @param {number} index
   * @param {boolean} isTransition
   */
  handleEndOfInputString(index, isTransition) {
    this.resetOutputPointer();

    const [isFinal, weight] = this.getFinalAndWeight(index, isTransition);
    if (isFinal) {
      this.updateAndNoteAnalysis(weight);
    }
  }

  handle_end_of_input_string(index, isTransition) {
    this.handleEndOfInputString(index, isTransition);
  }

  /**
   * Resets the output pointer in the state to NO_SYMBOL_NUMBER.
   */
  resetOutputPointer() {
    if (this.state.output_pointer === this.state.output_string.length) {
      this.state.output_string.push(NO_SYMBOL_NUMBER);
    } else {
      this.state.output_string[this.state.output_pointer] = NO_SYMBOL_NUMBER;
    }
  }

  reset_output_pointer() {
    this.resetOutputPointer();
  }

  /**
   * Gets the final state flag and weight based on the index and transition flag.
   * @param {number} index
   * @param {boolean} isTransition
   * @returns {[boolean, number]}
   */
  getFinalAndWeight(index, isTransition) {
    let isFinal = false;
    let weight = 0.0;

    if (isTransition) {
      if (this.transducer.transition_table.size() > index) {
        isFinal = this.transducer.transition_table.isFinal(index);
        weight = this.transducer.is_weighted
          ? this.transducer.transition_table.getWeight(index)
          : 0.0;
      } else {
        isFinal = false;
        weight = 0.0;
      }
    } else {
      isFinal = this.transducer.index_table.isFinal(index);
      if (isFinal && this.transducer.is_weighted) {
        weight = this.transducer.index_table.getFinalWeight(index);
      } else {
        weight = 0.0;
      }
    }

    return [isFinal, weight];
  }

  get_final_and_weight(index, isTransition) {
    return this.getFinalAndWeight(index, isTransition);
  }

  /**
   * Updates current weight and records the completed analysis.
   * @param {number} weight
   */
  updateAndNoteAnalysis(weight) {
    if (this.transducer.is_weighted) {
      this.state.current_weight += weight;
    }
    this.noteAnalysis();
    if (this.transducer.is_weighted) {
      this.state.current_weight -= weight;
    }
  }

  update_and_note_analysis(weight) {
    this.updateAndNoteAnalysis(weight);
  }

  /**
   * Gets the symbols for the given state.
   * @returns {string[]}
   */
  getSymbols() {
    const symbols = [];
    for (let i = 0; i < this.state.output_string.length; i++) {
      const sym = this.state.output_string[i];
      if (sym !== NO_SYMBOL_NUMBER) {
        symbols.push(this.transducer.alphabet.keyTable[sym]);
      }
    }
    return symbols;
  }

  get_symbols() {
    return this.getSymbols();
  }

  /**
   * Notes the current analysis result into display_vector.
   */
  noteAnalysis() {
    this.state.display_vector.push(
      new Result(
        this.getSymbols(),
        this.transducer.is_weighted ? this.state.current_weight : 0.0
      )
    );
  }

  note_analysis() {
    this.noteAnalysis();
  }

  /**
   * Returns the alphabet of the transducer.
   * @returns {string[]}
   */
  getAlphabet() {
    return this.transducer.alphabet.keyTable;
  }

  get_alphabet() {
    return this.getAlphabet();
  }

  /**
   * Analyzes the input string using the transducer.
   * @returns {Result[]}
   */
  analyze() {
    if (this.state.input_string[0] === NO_SYMBOL_NUMBER) {
      return [];
    } else {
      this.getAnalyses(0);
      return this.state.display_vector;
    }
  }

  /**
   * Evaluates and pushes state for a flag diacritic operation.
   * @param {import('./flag_diacritic_operation.js').FlagDiacriticOperation} flag
   * @returns {boolean}
   */
  pushState(flag) {
    const stack = this.state.state_stack;
    const top = stack[stack.length - 1];

    if (flag.op === FlagDiacriticOperator.P) {
      // Positive set
      const next = top.slice();
      next[flag.feature] = flag.value;
      stack.push(next);
      return true;
    } else if (flag.op === FlagDiacriticOperator.N) {
      // Negative set
      const next = top.slice();
      next[flag.feature] = -1 * flag.value;
      stack.push(next);
      return true;
    } else if (flag.op === FlagDiacriticOperator.R) {
      // Require
      if (flag.value === 0) {
        // Empty require: feature must not be 0 (neutral)
        if (top[flag.feature] === 0) {
          return false;
        } else {
          stack.push(top.slice());
          return true;
        }
      } else if (top[flag.feature] === flag.value) {
        stack.push(top.slice());
        return true;
      }
      return false;
    } else if (flag.op === FlagDiacriticOperator.D) {
      // Disallow
      if (flag.value === 0) {
        // Empty disallow: feature must be 0 (neutral)
        if (top[flag.feature] !== 0) {
          return false;
        } else {
          stack.push(top.slice());
          return true;
        }
      } else if (top[flag.feature] === flag.value) {
        return false;
      } else {
        stack.push(top.slice());
        return true;
      }
    } else if (flag.op === FlagDiacriticOperator.C) {
      // Clear
      const next = top.slice();
      next[flag.feature] = 0;
      stack.push(next);
      return true;
    } else if (flag.op === FlagDiacriticOperator.U) {
      // Unification
      if (
        top[flag.feature] === 0 ||
        top[flag.feature] === flag.value ||
        (top[flag.feature] !== flag.value && top[flag.feature] < 0)
      ) {
        const next = top.slice();
        next[flag.feature] = flag.value;
        stack.push(next);
        return true;
      }
      return false;
    }
    return false;
  }

  push_state(flag) {
    return this.pushState(flag);
  }
}


// --- hfst.js ---
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
