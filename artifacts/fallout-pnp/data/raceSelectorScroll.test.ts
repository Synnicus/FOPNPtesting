import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const characterScreen = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');

test('character race choices use the shared mouse-draggable horizontal scroller', () => {
  const raceSection = characterScreen.match(/\{\/\* Race \*\/\}([\s\S]*?)\{char\.race === 'customRace' &&/);
  assert.ok(raceSection, 'race selector section should exist');
  assert.match(raceSection[1], /<ScrollableTabStrip/);
  assert.match(raceSection[1], /accessibilityLabel="Character race selection"/);
  assert.match(raceSection[1], /PLAYABLE_RACES\.map/);
  assert.doesNotMatch(raceSection[1], /<ScrollView horizontal/);
});
