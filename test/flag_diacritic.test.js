import { test } from 'node:test';
import assert from 'node:assert';
import { FlagDiacriticOperator, FlagDiacriticOperation } from '../src/flag_diacritic_operation.js';
import { Analyzer } from '../src/analyzer.js';

function createMockAnalyzer() {
  const dummyTransducer = {
    alphabet: { features: 3, keyTable: ['', 'a', 'b'], operations: {} },
    index_table: { getInput: () => 65535, getTarget: () => 4294967295 },
    transition_table: { getInput: () => 65535, size: () => 0 },
    symbol_map: {},
    is_weighted: false,
    operations: {},
  };
  return new Analyzer(dummyTransducer, 'a');
}

test('FlagDiacriticOperation - P (Positive Set)', () => {
  const analyzer = createMockAnalyzer();
  const flagP = new FlagDiacriticOperation(FlagDiacriticOperator.P, 0, 5);
  assert.strictEqual(analyzer.pushState(flagP), true);
  assert.strictEqual(analyzer.state.stateStack.length, 2);
  assert.strictEqual(analyzer.state.stateStack[1][0], 5);
});

test('FlagDiacriticOperation - N (Negative Set)', () => {
  const analyzer = createMockAnalyzer();
  const flagN = new FlagDiacriticOperation(FlagDiacriticOperator.N, 1, 3);
  assert.strictEqual(analyzer.pushState(flagN), true);
  assert.strictEqual(analyzer.state.stateStack[1][1], -3);
});

test('FlagDiacriticOperation - R (Require)', () => {
  const analyzer = createMockAnalyzer();
  const flagRequireVal = new FlagDiacriticOperation(FlagDiacriticOperator.R, 0, 5);

  // Initially feature 0 is neutral (0), so requiring 5 should fail
  assert.strictEqual(analyzer.pushState(flagRequireVal), false);

  // Set feature 0 to 5
  analyzer.pushState(new FlagDiacriticOperation(FlagDiacriticOperator.P, 0, 5));
  // Now requiring 5 should succeed
  assert.strictEqual(analyzer.pushState(flagRequireVal), true);

  // Empty require (val = 0): requires feature to be non-zero
  const flagRequireNonEmpty = new FlagDiacriticOperation(FlagDiacriticOperator.R, 0, 0);
  assert.strictEqual(analyzer.pushState(flagRequireNonEmpty), true);

  // Reset to neutral and try empty require
  const analyzer2 = createMockAnalyzer();
  assert.strictEqual(analyzer2.pushState(flagRequireNonEmpty), false);
});

test('FlagDiacriticOperation - D (Disallow)', () => {
  const analyzer = createMockAnalyzer();
  const flagDisallowVal = new FlagDiacriticOperation(FlagDiacriticOperator.D, 0, 5);

  // Initially feature 0 is 0, so disallowing 5 succeeds
  assert.strictEqual(analyzer.pushState(flagDisallowVal), true);

  // If feature 0 is 5, disallowing 5 fails
  analyzer.pushState(new FlagDiacriticOperation(FlagDiacriticOperator.P, 0, 5));
  assert.strictEqual(analyzer.pushState(flagDisallowVal), false);

  // Empty disallow (val = 0): requires feature to be 0
  const flagDisallowNonZero = new FlagDiacriticOperation(FlagDiacriticOperator.D, 0, 0);
  assert.strictEqual(analyzer.pushState(flagDisallowNonZero), false); // feature is 5, so disallowed!

  const analyzer2 = createMockAnalyzer();
  assert.strictEqual(analyzer2.pushState(flagDisallowNonZero), true); // feature is 0, so allowed!
});

test('FlagDiacriticOperation - C (Clear)', () => {
  const analyzer = createMockAnalyzer();
  analyzer.pushState(new FlagDiacriticOperation(FlagDiacriticOperator.P, 0, 5));
  assert.strictEqual(analyzer.state.stateStack[1][0], 5);

  analyzer.pushState(new FlagDiacriticOperation(FlagDiacriticOperator.C, 0, 0));
  const top = analyzer.state.stateStack[analyzer.state.stateStack.length - 1];
  assert.strictEqual(top[0], 0);
});

test('FlagDiacriticOperation - U (Unification)', () => {
  const analyzer = createMockAnalyzer();
  const flagU = new FlagDiacriticOperation(FlagDiacriticOperator.U, 0, 7);

  // Feature is currently 0: unification succeeds and sets feature to 7
  assert.strictEqual(analyzer.pushState(flagU), true);
  let top = analyzer.state.stateStack[analyzer.state.stateStack.length - 1];
  assert.strictEqual(top[0], 7);

  // Feature is already 7: unification with 7 succeeds
  assert.strictEqual(analyzer.pushState(flagU), true);

  // Unification with a different positive value (8) should fail
  const flagU2 = new FlagDiacriticOperation(FlagDiacriticOperator.U, 0, 8);
  assert.strictEqual(analyzer.pushState(flagU2), false);

  // Negative value unification: if feature is negative and not equal to val, unification succeeds
  const analyzer2 = createMockAnalyzer();
  analyzer2.pushState(new FlagDiacriticOperation(FlagDiacriticOperator.N, 0, 4)); // feature = -4
  assert.strictEqual(analyzer2.pushState(new FlagDiacriticOperation(FlagDiacriticOperator.U, 0, 5)), true);
});
