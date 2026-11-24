import { test } from 'node:test';
import assert from 'node:assert';
import { ByteArray, BinaryReader, uint32BitsToFloat32 } from '../src/byte_array.js';

test('ByteArray - basic operations', () => {
  const ba = new ByteArray(16);
  assert.strictEqual(ba.getSize(), 16);
  assert.strictEqual(ba.get_size(), 16);

  // Write some data manually
  const buf = ba.getBytes();
  assert.strictEqual(buf.length, 16);
  buf[0] = 0x42;
  assert.strictEqual(ba.get(0), 0x42);
  assert.strictEqual(ba.getUByte(), 0x42);
  assert.strictEqual(ba.get_ubyte(), 0);
});

test('ByteArray - reading numbers (ushort, uint, bool, float)', () => {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint16(0, 1234, true);
  view.setUint32(2, 567890, true);
  view.setUint32(6, 1, true); // bool = true
  view.setFloat32(10, 3.14159, true);

  const ba = new ByteArray(new Uint8Array(buffer));
  assert.strictEqual(ba.getUShort(), 1234);
  assert.strictEqual(ba.getUInt(), 567890);
  assert.strictEqual(ba.getBool(), true);
  assert.ok(Math.abs(ba.getFloat() - 3.14159) < 0.0001);
});

test('ByteArray - clone constructor', () => {
  const ba1 = new ByteArray(4);
  ba1.bytes[0] = 10;
  ba1.bytes[1] = 20;

  const ba2 = new ByteArray(4, ba1);
  assert.strictEqual(ba2.getSize(), 4);
  assert.strictEqual(ba2.get(0), 10);
  assert.strictEqual(ba2.get(1), 20);
});

test('BinaryReader - sequential reads', () => {
  const buf = new Uint8Array([
    0x01, 0x02, // ushort: 0x0201 = 513
    0x04, 0x03, 0x02, 0x01, // uint: 0x01020304 = 16909060
    0x00, 0x00, 0x00, 0x00, // bool: false
    0x00, 0x00, 0x80, 0x3f, // float32: 1.0
  ]);
  const reader = new BinaryReader(buf);

  assert.strictEqual(reader.getUShort(), 513);
  assert.strictEqual(reader.getUInt(), 16909060);
  assert.strictEqual(reader.getBool(), false);
  assert.strictEqual(reader.getFloat(), 1.0);
  assert.strictEqual(reader.remaining, 0);
});

test('uint32BitsToFloat32 - IEEE 754 bit reinterpret', () => {
  // 0x3f800000 is 1.0f
  assert.strictEqual(uint32BitsToFloat32(0x3f800000), 1.0);
  // 0x00000000 is 0.0f
  assert.strictEqual(uint32BitsToFloat32(0), 0.0);
});
