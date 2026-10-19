import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

const source = readFileSync(new URL('../app/(tabs)/bestiary.tsx', import.meta.url), 'utf8');
const optionsSource = readFileSync(new URL('../components/CampaignOptionsModal.tsx', import.meta.url), 'utf8');

test('custom NPC editor retains AC-only protection and restores it on edit', () => {
  assert.match(source, /const naturalAC = naturalProtection\.armorClass \?\? 0/);
  assert.match(source, /const hasNaturalProtection = naturalAC > 0 \|\| NP_TYPES\.some/);
  assert.match(source, /naturalProtection: hasNaturalProtection \? naturalProtection : undefined/);
  assert.match(source, /setNaturalProtection\(t\.naturalProtection \? \{ \.\.\.t\.naturalProtection \}/);
  assert.match(source, /const derivedAC = special\.agility \+ naturalAC \+/);
  assert.match(source, /armorClass: derivedAC, usesDerivedArmorClass/);
  assert.match(source, /ARMOR CLASS POLICY/);
  assert.match(source, /testID=\{`custom-npc-ac-\$\{option\.label\.toLowerCase\(\)\}`\}/);
  assert.match(source, /setUsesDerivedArmorClass\(t\.usesDerivedArmorClass !== false\)/);
});

test('protection tab provides labeled natural AC controls and a total', () => {
  const protectionTab = source.slice(source.indexOf("{tab === 'protect'"));
  assert.match(protectionTab, /accessibilityLabel="Decrease natural AC bonus"/);
  assert.match(protectionTab, /Math\.max\(0, \(np\.armorClass \?\? 0\) - 1\)/);
  assert.match(protectionTab, /accessibilityLabel="Increase natural AC bonus"/);
  assert.match(protectionTab, /armorClass: \(np\.armorClass \?\? 0\) \+ 1/);
  assert.match(protectionTab, /Total AC: \{derivedAC\}/);
});

test('bestiary summary cards open full details and no longer expose a spawn button', () => {
  const card = source.slice(source.indexOf('function BestiaryCard'), source.indexOf('// ─── Main Bestiary Screen'));
  assert.match(card, /accessibilityRole="button"/);
  assert.match(card, /accessibilityLabel=\{`Open \$\{template\.name\} details`\}/);
  assert.match(card, /\['HP', template\.maxHp\]/);
  assert.match(card, /\['AC', template\.armorClass\]/);
  assert.match(card, /\['AP', template\.maxAP\]/);
  assert.match(card, /\['SEQ', template\.sequence\]/);
  assert.match(card, /\['XP', template\.xpValue \?\? '—'\]/);
  assert.doesNotMatch(card, /criticalChance|template\.radiationResistance|template\.gasResistance|Damage Protection|Top skills/);
  assert.doesNotMatch(card, />SPAWN</);

  const detail = source.slice(source.indexOf('function BestiaryDetailModal'), source.indexOf('// ─── Custom NPC Form Modal'));
  assert.match(detail, /RESISTANCES/);
  assert.match(detail, /DAMAGE PROTECTION/);
  assert.match(detail, /SKILLS/);
  assert.match(detail, /SPAWN TO CHARACTERS/);
});

test('pre-made NPC edit and removal actions warn and can be restored from campaign options', () => {
  assert.match(source, /resolveBestiaryTemplates\(/);
  assert.match(source, /'Edit built-in NPC\?'[\s\S]*'Editing this built-in NPC will override its default data\./);
  assert.match(source, /'Remove built-in NPC\?'[\s\S]*'This hides the NPC from the Bestiary\./);
  assert.match(source, /testID=\{`bestiary-edit-\$\{template\.id\}`\}/);
  assert.match(source, /testID=\{`bestiary-remove-\$\{template\.id\}`\}/);
  assert.match(optionsSource, /testID="restore-default-bestiary"/);
  assert.match(optionsSource, /restoreBuiltInBestiaryDefaults\(\)/);
  assert.match(optionsSource, /'This restores the current built-in NPC roster/);
});
