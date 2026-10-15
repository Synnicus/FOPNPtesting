import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

const source = readFileSync(new URL('../app/(tabs)/bestiary.tsx', import.meta.url), 'utf8');

test('custom NPC editor retains AC-only protection and restores it on edit', () => {
  assert.match(source, /const naturalAC = naturalProtection\.armorClass \?\? 0/);
  assert.match(source, /const hasNaturalProtection = naturalAC > 0 \|\| NP_TYPES\.some/);
  assert.match(source, /naturalProtection: hasNaturalProtection \? naturalProtection : undefined/);
  assert.match(source, /setNaturalProtection\(t\.naturalProtection \? \{ \.\.\.t\.naturalProtection \}/);
  assert.match(source, /const derivedAC = special\.agility \+ naturalAC \+/);
  assert.match(source, /armorClass: derivedAC, usesDerivedArmorClass: true/);
});

test('protection tab provides labeled natural AC controls and a total', () => {
  const protectionTab = source.slice(source.indexOf("{tab === 'protect'"));
  assert.match(protectionTab, /accessibilityLabel="Decrease natural AC bonus"/);
  assert.match(protectionTab, /Math\.max\(0, \(np\.armorClass \?\? 0\) - 1\)/);
  assert.match(protectionTab, /accessibilityLabel="Increase natural AC bonus"/);
  assert.match(protectionTab, /armorClass: \(np\.armorClass \?\? 0\) \+ 1/);
  assert.match(protectionTab, /Total AC: \{derivedAC\}/);
});
