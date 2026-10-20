import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const optionsSource = readFileSync(new URL('../components/CampaignOptionsModal.tsx', import.meta.url), 'utf8');

test('campaign option toggles use the selected theme accent instead of the browser switch color', () => {
  assert.match(optionsSource, /function ThemeSwitch\(/);
  assert.match(optionsSource, /accessibilityRole="switch"/);
  assert.match(optionsSource, /backgroundColor: value \? activeColor : inactiveColor/);
  assert.match(optionsSource, /activeColor=\{palette\.primary\}/);
  assert.doesNotMatch(optionsSource, /<Switch\b|trackColor=/);
});
