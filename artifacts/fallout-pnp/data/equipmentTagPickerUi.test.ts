import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const modPanelSource = readFileSync(resolve(testDirectory, '../components/CustomRulesPanel.tsx'), 'utf8');
const equipmentSource = readFileSync(resolve(testDirectory, '../app/(tabs)/equipment.tsx'), 'utf8');
const tagMenuSource = readFileSync(resolve(testDirectory, '../components/SelectableTagMenu.tsx'), 'utf8');

test('custom weapon mods select registered and campaign weapon tags from a button menu', () => {
  assert.match(modPanelSource, /testID="custom-mod-weapon-tag-menu-toggle"/);
  assert.match(modPanelSource, /getSelectableWeaponTags\(campaignRuleTags, modAppliesToTags\)/);
  assert.match(modPanelSource, /selectedTagIds=\{modAppliesToTags\}/);
  assert.match(modPanelSource, /appliesToTags: modAppliesToTags/);
  assert.match(modPanelSource, /addCustomModWeaponTag/);
  assert.match(modPanelSource, /custom-perk-weapon-tag-menu/);
  assert.match(modPanelSource, /custom-perk-armor-tag-menu/);
  assert.match(modPanelSource, /options=\{visiblePerkWeaponTags\}/);
  assert.match(modPanelSource, /selectedTagIds=\{perkWeaponTags\}/);
  assert.match(modPanelSource, /getSelectableArmorTags\(campaignRuleTags, perkArmorTags\)/);
  assert.match(modPanelSource, /options=\{visiblePerkArmorTags\}/);
  assert.match(modPanelSource, /selectedTagIds=\{perkArmorTags\}/);
  assert.match(modPanelSource, /weaponTags, armorTags/);
  assert.doesNotMatch(modPanelSource, /ELIGIBLE WEAPON TAGS \(COMMA-SEPARATED; BLANK = ANY\)/);
});

test('selectable tag menus expose tag buttons and custom tag creation inside the expanded menu', () => {
  assert.match(tagMenuSource, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(tagMenuSource, /options\.map\(tag =>/);
  assert.match(tagMenuSource, /onPress=\{\(\) => onToggle\(tag\.id\)\}/);
  assert.match(tagMenuSource, /customTagButtonLabel/);
  assert.match(tagMenuSource, /onAddCustomTag\(customTagLabel\)/);
});

test('weapon and armor catalog filters include a final custom-only option', () => {
  assert.match(equipmentSource, /testID="custom-weapon-tag-menu"/);
  assert.match(equipmentSource, /buttonLabel="SELECT WEAPON TAGS"/);
  assert.match(equipmentSource, /\['all', \.\.\.WEAPON_CATEGORY_ORDER\.filter\(category => category !== 'minesTraps'\), 'custom'\]/);
  assert.match(equipmentSource, /key: 'traps', label: `TRAPS/);
  assert.match(equipmentSource, /categoryFilter === 'custom' \? !!w\.isCustom/);
  assert.match(equipmentSource, /\['all', 'custom'\] as const/);
  assert.match(equipmentSource, /armorFilter === 'all' \|\| !!a\.isCustom/);
});
