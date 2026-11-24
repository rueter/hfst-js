import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pyhfst = require('../dist/index.cjs');

test('CommonJS bundle - exports and basic usage', () => {
  assert.strictEqual(typeof pyhfst.HfstInputStream, 'function');
  assert.strictEqual(typeof pyhfst.getTransducer, 'function');
  assert.strictEqual(typeof pyhfst.Analyzer, 'function');
  assert.strictEqual(typeof pyhfst.ByteArray, 'function');
  assert.strictEqual(pyhfst.TRANSITION_TARGET_TABLE_START, 2147483648);
  assert.strictEqual(pyhfst.NO_SYMBOL_NUMBER, 65535);

  const ba = new pyhfst.ByteArray(8);
  assert.strictEqual(ba.getSize(), 8);
});
