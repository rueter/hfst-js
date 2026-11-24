import {
  TRANSITION_TARGET_TABLE_START,
  INFINITE_WEIGHT,
  NO_SYMBOL_NUMBER,
  NO_TABLE_INDEX,
} from './constants.js';
import { ByteArray, BinaryReader, uint32BitsToFloat32 } from './byte_array.js';
import { FlagDiacriticOperator, FlagDiacriticOperation } from './flag_diacritic_operation.js';
import { TransducerHeader } from './transducer_header.js';
import { TransducerAlphabet } from './transducer_alphabet.js';
import { IndexTable, TransitionTable } from './tables.js';
import { Result } from './result.js';
import { State } from './state.js';
import { Transducer } from './transducer.js';
import { Analyzer } from './analyzer.js';
import { HfstInputStream, Hfst, getTransducer, get_transducer } from './hfst.js';

export {
  // Constants
  TRANSITION_TARGET_TABLE_START,
  INFINITE_WEIGHT,
  NO_SYMBOL_NUMBER,
  NO_TABLE_INDEX,
  // Binary
  ByteArray,
  BinaryReader,
  uint32BitsToFloat32,
  // Flag Diacritics
  FlagDiacriticOperator,
  FlagDiacriticOperation,
  // Transducer Components
  TransducerHeader,
  TransducerAlphabet,
  IndexTable,
  TransitionTable,
  Result,
  State,
  Transducer,
  Analyzer,
  // Top-level API
  HfstInputStream,
  Hfst,
  getTransducer,
  get_transducer,
};

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

export default pyhfst;
