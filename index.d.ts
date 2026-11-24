/**
 * TypeScript definitions for hfst-js / pyhfst
 */

export const TRANSITION_TARGET_TABLE_START: number;
export const INFINITE_WEIGHT: number;
export const NO_SYMBOL_NUMBER: number;
export const NO_TABLE_INDEX: number;

export function uint32BitsToFloat32(uintVal: number): number;

export enum FlagDiacriticOperator {
  P = 0,
  N = 1,
  R = 2,
  D = 3,
  C = 4,
  U = 5,
}

export class FlagDiacriticOperation {
  op: FlagDiacriticOperator;
  feature: number;
  value: number;

  constructor(operation?: FlagDiacriticOperator | null, feat?: number | null, val?: number | null);

  isFlag(): boolean;
  is_flag(): boolean;
}

export class BinaryReader {
  bytes: Uint8Array;
  view: DataView;
  offset: number;

  constructor(input: Uint8Array | ArrayBuffer | Buffer);

  get remaining(): number;
  readBytes(n: number): Uint8Array;
  getUByte(): number;
  getUShort(): number;
  getUInt(): number;
  getBool(): boolean;
  getFloat(): number;
}

export class ByteArray {
  bytes: Uint8Array;
  size: number;
  index: number;
  view: DataView;

  constructor(s?: number | Uint8Array | ArrayBuffer | ByteArray, another?: ByteArray | null);

  getSize(): number;
  get_size(): number;
  get(i: number): number;
  getBytes(): Uint8Array;
  get_bytes(): Uint8Array;
  getUByte(): number;
  get_ubyte(): number;
  getUShort(): number;
  get_ushort(): number;
  getUInt(): number;
  get_uint(): number;
  getBool(): boolean;
  get_bool(): boolean;
  getFloat(): number;
  get_float(): number;
}

export class TransducerHeader {
  numberOfInputSymbols: number;
  numberOfSymbols: number;
  sizeOfTransitionIndexTable: number;
  sizeOfTransitionTargetTable: number;
  numberOfStates: number;
  numberOfTransitions: number;
  weighted: boolean;
  deterministic: boolean;
  inputDeterministic: boolean;
  minimized: boolean;
  cyclic: boolean;
  hasEpsilonEpsilonTransitions: boolean;
  hasInputEpsilonTransitions: boolean;
  hasInputEpsilonCycles: boolean;
  hasUnweightedInputEpsilonCycles: boolean;
  hfst3?: boolean;

  // Snake_case aliases
  number_of_input_symbols: number;
  number_of_symbols: number;
  size_of_transition_index_table: number;
  size_of_transition_target_table: number;
  number_of_states: number;
  number_of_transitions: number;
  input_deterministic: boolean;
  has_epsilon_epsilon_transitions: boolean;
  has_input_epsilon_transitions: boolean;
  has_input_epsilon_cycles: boolean;
  has_unweighted_input_epsilon_cycles: boolean;

  constructor(reader: BinaryReader);

  beginsHfst3Header(bytes: Uint8Array): boolean;
  begins_hfst3_header(bytes: Uint8Array): boolean;
  getInputSymbolCount(): number;
  get_input_symbol_count(): number;
  getSymbolCount(): number;
  get_symbol_count(): number;
  getIndexTableSize(): number;
  get_index_table_size(): number;
  getTargetTableSize(): number;
  get_target_table_size(): number;
  isWeighted(): boolean;
  is_weighted(): boolean;
  hasHfst3Header(): boolean;
  has_hfst3_header(): boolean;
}

export class TransducerAlphabet {
  keyTable: string[];
  operations: Record<number, FlagDiacriticOperation>;
  features: number;

  constructor(reader: BinaryReader, numberOfSymbols: number);
}

export class IndexTable {
  tiInputSymbols: Uint16Array;
  tiTargets: Uint32Array;
  ti_input_symbols: Uint16Array;
  ti_targets: Uint32Array;

  constructor(reader: BinaryReader, indicesCount: number);

  getInput(i: number): number;
  get_input(i: number): number;
  getTarget(i: number): number;
  get_target(i: number): number;
  isFinal(i: number): boolean;
  is_final(i: number): boolean;
  getFinalWeight(i: number): number;
  get_final_weight(i: number): number;
  size(): number;
}

export class TransitionTable {
  isWeighted: boolean;
  is_weighted: boolean;
  tiInputSymbols: Uint16Array;
  tiOutputSymbols: Uint16Array;
  tiTargets: Uint32Array;
  tiWeights: Float32Array | null;
  ti_input_symbols: Uint16Array;
  ti_output_symbols: Uint16Array;
  ti_targets: Uint32Array;
  ti_weights: Float32Array | null;

  constructor(reader: BinaryReader, transitionCount: number, isWeighted?: boolean);

  getInput(pos: number): number;
  get_input(pos: number): number;
  getOutput(pos: number): number;
  get_output(pos: number): number;
  getTarget(pos: number): number;
  get_target(pos: number): number;
  getWeight(pos: number): number;
  get_weight(pos: number): number;
  isFinal(pos: number): boolean;
  is_final(pos: number): boolean;
  size(): number;
}

export class Result {
  symbols: string[];
  weight: number;

  constructor(symbols: string[], weight: number);

  getSymbols(): string[];
  get_symbols(): string[];
  getWeight(): number;
  get_weight(): number;
  toString(): string;
  __str__(): string;
}

export class State {
  parent: Transducer;
  state_stack: number[][];
  stateStack: number[][];
  output_string: number[];
  outputString: number[];
  input_string: number[];
  inputString: number[];
  output_pointer: number;
  outputPointer: number;
  input_pointer: number;
  inputPointer: number;
  current_weight: number;
  currentWeight: number;
  display_vector: Result[];
  displayVector: Result[];

  constructor(input: string, parent: Transducer);

  findKey(indexString: string): Generator<number, void, unknown>;
  find_key(indexString: string): Generator<number, void, unknown>;
}

export class Transducer {
  header: TransducerHeader;
  alphabet: TransducerAlphabet;
  isWeighted: boolean;
  is_weighted: boolean;
  operations: Record<number, FlagDiacriticOperation>;
  symbol_map: Record<string, any>;
  symbolMap: Record<string, any>;
  indexTable: IndexTable;
  index_table: IndexTable;
  transitionTable: TransitionTable;
  transition_table: TransitionTable;

  constructor(
    file: BinaryReader | Uint8Array | ArrayBuffer | Buffer,
    h: TransducerHeader,
    a: TransducerAlphabet,
    isWeighted?: boolean
  );

  constructSymbolMap(): void;
  construct_symbol_map(): void;
}

export class Analyzer {
  transducer: Transducer;
  inputStr: string;
  input_str: string;
  state: State;
  timeCutoff: number;
  time_cutoff: number;
  startTime: number;
  start_time: number;

  constructor(transducer: Transducer, inputStr: string, timeCutoff?: number);

  pivot(i: number): number;
  isTimeExceeded(): boolean;
  is_time_exceeded(): boolean;
  tryEpsilonIndices(index: number): void;
  try_epsilon_indices(index: number): void;
  tryEpsilonTransitions(index: number): void;
  try_epsilon_transitions(index: number): void;
  findIndex(index: number): void;
  find_index(index: number): void;
  handleEpsilonTransition(index: number): void;
  handle_epsilon_transition(index: number): void;
  findTransitions(index: number): void;
  find_transitions(index: number): void;
  getAnalyses(idx: number): void;
  get_analyses(idx: number): void;
  updateOutputString(outputSymbol: number): void;
  update_output_string(outputSymbol: number): void;
  handleEndOfInputString(index: number, isTransition: boolean): void;
  handle_end_of_input_string(index: number, isTransition: boolean): void;
  resetOutputPointer(): void;
  reset_output_pointer(): void;
  getFinalAndWeight(index: number, isTransition: boolean): [boolean, number];
  get_final_and_weight(index: number, isTransition: boolean): [boolean, number];
  updateAndNoteAnalysis(weight: number): void;
  update_and_note_analysis(weight: number): void;
  getSymbols(): string[];
  get_symbols(): string[];
  noteAnalysis(): void;
  note_analysis(): void;
  getAlphabet(): string[];
  get_alphabet(): string[];
  analyze(): Result[];
  pushState(flag: FlagDiacriticOperation): boolean;
  push_state(flag: FlagDiacriticOperation): boolean;
}

export interface LookupOptions {
  timeCutoff?: number;
  time_cutoff?: number;
}

export class Hfst {
  tr: Transducer;
  cache: boolean;
  mem: Map<string, Result[]>;

  constructor(tr: Transducer, cache?: boolean);

  lookup(string: string, timeCutoff?: number | LookupOptions): Array<[string, number]>;
  lookupResults(string: string, timeCutoff?: number | LookupOptions): Result[];
}

export class HfstInputStream {
  path: string | Buffer | Uint8Array | ArrayBuffer;
  cache: boolean;

  constructor(
    pathOrBuffer: string | Buffer | Uint8Array | ArrayBuffer,
    cache?: boolean | { cache?: boolean }
  );

  read(): Hfst;

  static fromUrl(
    url: string | URL,
    options?: { cache?: boolean; fetchOptions?: RequestInit }
  ): Promise<Hfst>;

  static fromFileAsync(filePath: string, cache?: boolean): Promise<Hfst>;

  static fromBuffer(buffer: Buffer | Uint8Array | ArrayBuffer, cache?: boolean): Hfst;
}

export function getTransducer(
  input: string | Buffer | Uint8Array | ArrayBuffer
): Transducer;

export const get_transducer: typeof getTransducer;

export default interface PyHfst {
  TRANSITION_TARGET_TABLE_START: typeof TRANSITION_TARGET_TABLE_START;
  INFINITE_WEIGHT: typeof INFINITE_WEIGHT;
  NO_SYMBOL_NUMBER: typeof NO_SYMBOL_NUMBER;
  NO_TABLE_INDEX: typeof NO_TABLE_INDEX;
  ByteArray: typeof ByteArray;
  BinaryReader: typeof BinaryReader;
  uint32BitsToFloat32: typeof uint32BitsToFloat32;
  FlagDiacriticOperator: typeof FlagDiacriticOperator;
  FlagDiacriticOperation: typeof FlagDiacriticOperation;
  TransducerHeader: typeof TransducerHeader;
  TransducerAlphabet: typeof TransducerAlphabet;
  IndexTable: typeof IndexTable;
  TransitionTable: typeof TransitionTable;
  Result: typeof Result;
  State: typeof State;
  Transducer: typeof Transducer;
  Analyzer: typeof Analyzer;
  HfstInputStream: typeof HfstInputStream;
  Hfst: typeof Hfst;
  getTransducer: typeof getTransducer;
  get_transducer: typeof get_transducer;
}
