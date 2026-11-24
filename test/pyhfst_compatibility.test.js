import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import pyhfst, { HfstInputStream, getTransducer } from '../src/index.js';

function findModel(...candidates) {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const finAnalyserPath = findModel(
  'models/fin_analyser.hfstol',
  'models/analyser.hfstol',
  '/tmp/pyhfst_repo/analyser'
);

const finGeneratorPath = findModel(
  'models/fin_generator.hfstol',
  'models/generator.hfstol',
  '/tmp/pyhfst_repo/generator-norm'
);

const myvAnalyserPath = findModel('models/myv_analyser.hfstol');
const myvGeneratorPath = findModel('models/myv_generator.hfstol');

test('pyhfst compatibility - Finnish analyser lookup', { skip: !finAnalyserPath }, () => {
  const inputStream = new HfstInputStream(finAnalyserPath);
  const tr = inputStream.read();

  // "voi"
  const resVoi = tr.lookup('voi');
  assert.ok(Array.isArray(resVoi));
  assert.strictEqual(resVoi.length, 8);
  const voiAnalyses = resVoi.map(r => r[0]);
  assert.ok(voiAnalyses.includes('voida+V+Act+Ind+Prs+Sg3'));
  assert.ok(voiAnalyses.includes('voida+V+Act+Ind+Prs+ConNeg'));
  assert.ok(voiAnalyses.includes('voida+V+Act+Ind+Prt+Sg3'));
  assert.ok(voiAnalyses.includes('voida+V+Act+Imprt+Prs+ConNeg+Sg2'));
  assert.ok(voiAnalyses.includes('voida+V+Act+Imprt+Sg2'));
  assert.ok(voiAnalyses.includes('voi+N+Sg+Nom'));
  assert.ok(voiAnalyses.includes('voi+Pcle'));
  assert.ok(voiAnalyses.includes('voi+Interj'));
  for (const r of resVoi) {
    assert.strictEqual(r[1], 0.0);
  }

  // "ihmettelen"
  const resIhmettelen = tr.lookup('ihmettelen');
  assert.deepStrictEqual(resIhmettelen, [['ihmetellä+V+Act+Ind+Prs+Sg1', 0.0]]);

  // "kissa"
  const resKissa = tr.lookup('kissa');
  assert.deepStrictEqual(resKissa, [['kissa+N+Sg+Nom', 0.0]]);

  // "koira"
  const resKoira = tr.lookup('koira');
  assert.deepStrictEqual(resKoira, [['koira+N+Sg+Nom', 0.0]]);

  // "koirani"
  const resKoirani = tr.lookup('koirani');
  assert.deepStrictEqual(resKoirani, [
    ['koi+N+Sg+Nom+Cmp#rani+N+Sg+Nom', 0.0],
    ['koira+N+Sg+Nom+PxSg1', 0.0],
    ['koira+N+Sg+Gen+PxSg1', 0.0],
    ['koira+N+Pl+Nom+PxSg1', 0.0],
  ]);

  // "luutapiiri"
  const resLuutapiiri = tr.lookup('luutapiiri');
  assert.deepStrictEqual(resLuutapiiri, [
    ['luu+N+Sg+Nom+Cmp#tapiiri+N+Sg+Nom', 0.0],
    ['luuta+N+Sg+Nom+Cmp#piiri+N+Sg+Nom', 0.0],
  ]);

  // "luutapiirissanikin"
  const resLuutapiirissanikin = tr.lookup('luutapiirissanikin');
  assert.deepStrictEqual(resLuutapiirissanikin, [
    ['luu+N+Sg+Nom+Cmp#tapiiri+N+Sg+Ine+PxSg1+Foc/kin', 0.0],
    ['luuta+N+Sg+Nom+Cmp#pii+N+Sg+Nom+Cmp#rissa+N+Sg+Nom+PxSg1+Foc/kin', 0.0],
    ['luuta+N+Sg+Nom+Cmp#pii+N+Sg+Nom+Cmp#rissa+N+Sg+Gen+PxSg1+Foc/kin', 0.0],
    ['luuta+N+Sg+Nom+Cmp#pii+N+Sg+Nom+Cmp#rissa+N+Pl+Nom+PxSg1+Foc/kin', 0.0],
  ]);
});

test('pyhfst compatibility - Finnish generator lookup', { skip: !finGeneratorPath }, () => {
  const inputStream = new HfstInputStream(finGeneratorPath);
  const tr = inputStream.read();

  const res = tr.lookup('koira+N+Pl+Nom');
  assert.deepStrictEqual(res, [['koirat', 0.0]]);
});

test('pyhfst compatibility - Erzya (myv) analyser lookup', { skip: !myvAnalyserPath }, () => {
  const inputStream = new HfstInputStream(myvAnalyserPath);
  const tr = inputStream.read();

  const resKudo = tr.lookup('кудо');
  assert.deepStrictEqual(resKudo, [['кудо+N+Sg+Nom+Indef', 0.0]]);

  const resKudoso = tr.lookup('кудосо');
  assert.deepStrictEqual(resKudoso, [['кудо+N+SP+Ine+Indef', 0.0]]);

  const resMoro = tr.lookup('моро');
  assert.deepStrictEqual(resMoro, [['моро+N+Sg+Nom+Indef', 0.0]]);
});

test('pyhfst compatibility - Erzya (myv) generator lookup', { skip: !myvGeneratorPath }, () => {
  const inputStream = new HfstInputStream(myvGeneratorPath);
  const tr = inputStream.read();

  const resKudo = tr.lookup('кудо+N+Sg+Nom+Indef');
  assert.deepStrictEqual(resKudo, [['кудо', 0.0]]);

  const resKudoso = tr.lookup('кудо+N+SP+Ine+Indef');
  assert.deepStrictEqual(resKudoso, [['кудосо', 0.0]]);
});

test('pyhfst compatibility - edge cases (empty, unknown, time cutoff)', { skip: !finAnalyserPath }, () => {
  const inputStream = new HfstInputStream(finAnalyserPath);
  const tr = inputStream.read();

  // Empty string
  assert.deepStrictEqual(tr.lookup(''), []);

  // Unknown string
  assert.deepStrictEqual(tr.lookup('nonexistentword12345'), []);

  // Time cutoff
  const resCutoff = tr.lookup('voi', 0.00000000001);
  assert.deepStrictEqual(resCutoff, []);
});

test('pyhfst compatibility - default export object', () => {
  assert.strictEqual(typeof pyhfst.HfstInputStream, 'function');
  assert.strictEqual(typeof pyhfst.getTransducer, 'function');
  assert.strictEqual(typeof pyhfst.get_transducer, 'function');
  assert.strictEqual(typeof pyhfst.Analyzer, 'function');
  assert.strictEqual(typeof pyhfst.Transducer, 'function');
});
