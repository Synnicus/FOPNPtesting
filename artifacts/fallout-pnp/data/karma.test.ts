import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyKarmaAdjustment,
  clampKarma,
  karmaGroupFor,
  karmaTitleFor,
  KARMA_TITLE_ROWS,
  normalizeKarmaFields,
  parseKarmaAdjustment,
} from './karma.ts';

test('Karma groups use Fallout 3 boundaries, including distinct Very Good and Very Evil bands', () => {
  assert.equal(karmaGroupFor(1000), 'Very Good');
  assert.equal(karmaGroupFor(750), 'Very Good');
  assert.equal(karmaGroupFor(749), 'Good');
  assert.equal(karmaGroupFor(250), 'Good');
  assert.equal(karmaGroupFor(249), 'Neutral');
  assert.equal(karmaGroupFor(0), 'Neutral');
  assert.equal(karmaGroupFor(-249), 'Neutral');
  assert.equal(karmaGroupFor(-250), 'Evil');
  assert.equal(karmaGroupFor(-749), 'Evil');
  assert.equal(karmaGroupFor(-750), 'Very Evil');
  assert.equal(karmaGroupFor(-1000), 'Very Evil');
});

test('every Fallout 3 level row maps all three Karma groups and replaces Vault titles', () => {
  assert.equal(KARMA_TITLE_ROWS.length, 30);
  for (const [index, row] of KARMA_TITLE_ROWS.entries()) {
    const level = index + 1;
    assert.equal(karmaTitleFor(level, 250), row.positive, `positive title at level ${level}`);
    assert.equal(karmaTitleFor(level, 0), row.neutral, `neutral title at level ${level}`);
    assert.equal(karmaTitleFor(level, -250), row.negative, `negative title at level ${level}`);
  }
  assert.equal(karmaTitleFor(1, 0), 'Wasteland Dweller');
  assert.equal(karmaTitleFor(13, 250), 'Wasteland Legend');
  assert.ok(KARMA_TITLE_ROWS.every(row =>
    !`${row.positive} ${row.neutral} ${row.negative}`.includes('Vault')));
});

test('levels above the Fallout 3 title table use the level-30 row', () => {
  const finalRow = KARMA_TITLE_ROWS[KARMA_TITLE_ROWS.length - 1];
  assert.equal(karmaTitleFor(31, 250), finalRow.positive);
  assert.equal(karmaTitleFor(99, 0), finalRow.neutral);
  assert.equal(karmaTitleFor(101, -250), finalRow.negative);
  assert.equal(karmaTitleFor(0, 0), KARMA_TITLE_ROWS[0].neutral);
});

test('Karma adjustment input accepts only non-zero safe whole numbers', () => {
  assert.equal(parseKarmaAdjustment('+25'), 25);
  assert.equal(parseKarmaAdjustment('-10'), -10);
  assert.equal(parseKarmaAdjustment(' 5 '), 5);
  assert.equal(parseKarmaAdjustment('0'), null);
  assert.equal(parseKarmaAdjustment('-0'), null);
  assert.equal(parseKarmaAdjustment('2.5'), null);
  assert.equal(parseKarmaAdjustment('1e2'), null);
  assert.equal(parseKarmaAdjustment('9007199254740992'), null);
  assert.equal(parseKarmaAdjustment(''), null);
});

test('Karma adjustments clamp at both limits and return the actual applied change', () => {
  assert.deepEqual(applyKarmaAdjustment(10, 25), { karma: 35, appliedChange: 25 });
  assert.deepEqual(applyKarmaAdjustment(990, 25), { karma: 1000, appliedChange: 10 });
  assert.deepEqual(applyKarmaAdjustment(-990, -25), { karma: -1000, appliedChange: -10 });
  assert.deepEqual(applyKarmaAdjustment(1000, -2000), { karma: -1000, appliedChange: -2000 });
  assert.equal(applyKarmaAdjustment(1000, 5), null);
  assert.equal(applyKarmaAdjustment(0, 0), null);
  assert.equal(clampKarma(1200), 1000);
  assert.equal(clampKarma(-1200), -1000);
});

test('legacy characters normalize to neutral Karma and new totals can be derived from history', () => {
  assert.deepEqual(normalizeKarmaFields({}), { karma: 0, karmaLog: [] });
  const history = [
    { id: 'first', change: 300, reason: 'Helped a settlement', createdAt: 1 },
    { id: 'second', change: -50, reason: 'Stole supplies', createdAt: 2 },
  ];
  assert.deepEqual(normalizeKarmaFields({ karmaLog: history }), { karma: 250, karmaLog: history });
  assert.deepEqual(normalizeKarmaFields({
    karma: 250,
    karmaLog: [...history, { id: 'bad', change: 0, reason: '', createdAt: NaN }],
  }), { karma: 250, karmaLog: history });
});
