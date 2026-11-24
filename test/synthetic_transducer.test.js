import { test } from 'node:test';
import assert from 'node:assert';
import {
  TRANSITION_TARGET_TABLE_START,
  NO_SYMBOL_NUMBER,
  NO_TABLE_INDEX,
} from '../src/constants.js';
import { getTransducer, Hfst, HfstInputStream } from '../src/hfst.js';

/**
 * Builds a minimal valid HFST binary transducer buffer that maps:
 * "cat" -> "dog" (weight 1.5 if weighted, 0.0 if unweighted)
 */
function buildSyntheticCatDogTransducer(isWeighted = true) {
  // Alphabet:
  // 0: "" (epsilon)
  // 1: "c"
  // 2: "a"
  // 3: "t"
  // 4: "dog"
  const alphabetStrings = ['', 'c', 'a', 't', 'dog'];
  const alphabetBytes = [];
  const encoder = new TextEncoder();
  for (const s of alphabetStrings) {
    const b = encoder.encode(s);
    for (let i = 0; i < b.length; i++) alphabetBytes.push(b[i]);
    alphabetBytes.push(0); // null terminator
  }

  const indexCount = 10;
  const transCount = 10;

  // Header:
  // HFST\0 (5 bytes) + remaining (2 bytes) + skipped (1 byte) + 56 bytes payload
  const headerBuf = new ArrayBuffer(5 + 2 + 1 + 56);
  const headerView = new DataView(headerBuf);
  const headerBytes = new Uint8Array(headerBuf);

  // "HFST\0"
  headerBytes[0] = 0x48;
  headerBytes[1] = 0x46;
  headerBytes[2] = 0x53;
  headerBytes[3] = 0x54;
  headerBytes[4] = 0x00;
  // remaining = 0
  headerView.setUint16(5, 0, true);
  // skipped 1 byte
  headerBytes[7] = 0x00;

  // 56-byte header payload starting at offset 8
  const hOff = 8;
  headerView.setUint16(hOff + 0, 4, true); // numberOfInputSymbols = 4 (0, 1, 2, 3)
  headerView.setUint16(hOff + 2, 5, true); // numberOfSymbols = 5
  headerView.setUint32(hOff + 4, indexCount, true); // sizeOfTransitionIndexTable
  headerView.setUint32(hOff + 8, transCount, true); // sizeOfTransitionTargetTable
  headerView.setUint32(hOff + 12, 4, true); // numberOfStates
  headerView.setUint32(hOff + 16, 4, true); // numberOfTransitions
  headerView.setUint32(hOff + 20, isWeighted ? 1 : 0, true); // weighted
  headerView.setUint32(hOff + 24, 1, true); // deterministic
  headerView.setUint32(hOff + 28, 1, true); // inputDeterministic
  headerView.setUint32(hOff + 32, 1, true); // minimized
  headerView.setUint32(hOff + 36, 0, true); // cyclic
  headerView.setUint32(hOff + 40, 0, true); // hasEpsilonEpsilonTransitions
  headerView.setUint32(hOff + 44, 0, true); // hasInputEpsilonTransitions
  headerView.setUint32(hOff + 48, 0, true); // hasInputEpsilonCycles
  headerView.setUint32(hOff + 52, 0, true); // hasUnweightedInputEpsilonCycles

  // Index table: indexCount * 6 bytes
  const indexBuf = new ArrayBuffer(indexCount * 6);
  const indexView = new DataView(indexBuf);
  for (let i = 0; i < indexCount; i++) {
    indexView.setUint16(i * 6, NO_SYMBOL_NUMBER, true);
    indexView.setUint32(i * 6 + 2, NO_TABLE_INDEX, true);
  }

  // State 0:
  // findIndex(0 + 1 = 1): checks index 1 + input_sym.
  // When input is 'c' (sym 1), checks index 1 + 1 = 2:
  indexView.setUint16(2 * 6, 1, true); // input sym 'c'
  indexView.setUint32(2 * 6 + 2, TRANSITION_TARGET_TABLE_START + 0, true); // points to transition 0

  // Transition table: transCount * (isWeighted ? 12 : 8) bytes
  const transBlockSize = isWeighted ? 12 : 8;
  const transBuf = new ArrayBuffer(transCount * transBlockSize);
  const transView = new DataView(transBuf);
  for (let i = 0; i < transCount; i++) {
    transView.setUint16(i * transBlockSize, NO_SYMBOL_NUMBER, true);
    transView.setUint16(i * transBlockSize + 2, NO_SYMBOL_NUMBER, true);
    transView.setUint32(i * transBlockSize + 4, NO_TABLE_INDEX, true);
    if (isWeighted) {
      transView.setFloat32(i * transBlockSize + 8, 0.0, true);
    }
  }

  // Transition 0: input 'c' (1), output 0 (epsilon), target -> State 1 (at index 1)
  transView.setUint16(0 * transBlockSize, 1, true);
  transView.setUint16(0 * transBlockSize + 2, 0, true);
  transView.setUint32(0 * transBlockSize + 4, TRANSITION_TARGET_TABLE_START + 1, true);
  if (isWeighted) transView.setFloat32(0 * transBlockSize + 8, 0.5, true);

  // State 1: at index 1:
  // At index 1: isFinal = false (input=NO_SYMBOL_NUMBER, target=NO_TABLE_INDEX)
  // At index 1 + 1 = 2: transition for 'a' (2), output 0 (epsilon), target -> State 2 (at index 3)
  transView.setUint16(2 * transBlockSize, 2, true);
  transView.setUint16(2 * transBlockSize + 2, 0, true);
  transView.setUint32(2 * transBlockSize + 4, TRANSITION_TARGET_TABLE_START + 3, true);
  if (isWeighted) transView.setFloat32(2 * transBlockSize + 8, 0.0, true);

  // State 2: at index 3:
  // At index 3: isFinal = false
  // At index 3 + 1 = 4: transition for 't' (3), output 4 ('dog'), target -> State 3 (at index 5)
  transView.setUint16(4 * transBlockSize, 3, true);
  transView.setUint16(4 * transBlockSize + 2, 4, true);
  transView.setUint32(4 * transBlockSize + 4, TRANSITION_TARGET_TABLE_START + 5, true);
  if (isWeighted) transView.setFloat32(4 * transBlockSize + 8, 1.0, true);

  // State 3: at index 5:
  // At index 5: isFinal = true! (input=NO_SYMBOL_NUMBER, output=NO_SYMBOL_NUMBER, target=1)
  transView.setUint16(5 * transBlockSize, NO_SYMBOL_NUMBER, true);
  transView.setUint16(5 * transBlockSize + 2, NO_SYMBOL_NUMBER, true);
  transView.setUint32(5 * transBlockSize + 4, 1, true); // target == 1 means isFinal
  if (isWeighted) transView.setFloat32(5 * transBlockSize + 8, 0.0, true);

  // Combine into single Uint8Array
  const totalLength =
    headerBytes.length +
    alphabetBytes.length +
    indexBuf.byteLength +
    transBuf.byteLength;
  const result = new Uint8Array(totalLength);
  let off = 0;
  result.set(headerBytes, off);
  off += headerBytes.length;
  result.set(alphabetBytes, off);
  off += alphabetBytes.length;
  result.set(new Uint8Array(indexBuf), off);
  off += indexBuf.byteLength;
  result.set(new Uint8Array(transBuf), off);

  return result;
}

test('Synthetic Transducer - weighted lookup', () => {
  const binaryData = buildSyntheticCatDogTransducer(true);
  const tr = getTransducer(binaryData);
  assert.strictEqual(tr.isWeighted, true);
  assert.strictEqual(tr.header.getSymbolCount(), 5);

  const hfst = new Hfst(tr);
  const results = hfst.lookup('cat');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0][0], 'dog');
  assert.strictEqual(results[0][1], 1.5); // 0.5 + 1.0 = 1.5

  // Non-matching input
  assert.deepStrictEqual(hfst.lookup('dog'), []);
  assert.deepStrictEqual(hfst.lookup('ca'), []);
  assert.deepStrictEqual(hfst.lookup(''), []);
});

test('Synthetic Transducer - unweighted lookup', () => {
  const binaryData = buildSyntheticCatDogTransducer(false);
  const tr = getTransducer(binaryData);
  assert.strictEqual(tr.isWeighted, false);

  const hfst = new Hfst(tr);
  const results = hfst.lookup('cat');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0][0], 'dog');
  assert.strictEqual(results[0][1], 0.0); // unweighted is 0.0
});

test('Synthetic Transducer - HfstInputStream.fromBuffer', () => {
  const binaryData = buildSyntheticCatDogTransducer(true);
  const inputStream = HfstInputStream.fromBuffer(binaryData);
  const hfst = inputStream.read();
  const results = hfst.lookup('cat');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0][0], 'dog');
});
