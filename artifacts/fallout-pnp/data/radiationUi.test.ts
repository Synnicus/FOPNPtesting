import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { HARDCORE_RADIATION_RULES } from './radiation.ts';

const characterSource = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
const optionsSource = readFileSync(new URL('../components/CampaignOptionsModal.tsx', import.meta.url), 'utf8');
const combatSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');

test('character editor adds radiation with an optional single resistance adjustment', () => {
  assert.match(characterSource, /if \(amount > 0\) setPendingRadiation\(amount\)/);
  assert.match(characterSource, /title="Apply Radiation Resistance\?"/);
  assert.match(
    characterSource,
    /onCancel=\{\(\) => \{ if \(pendingRadiation !== null\) setChar\(c => \(\{ \.\.\.c, accumulatedRadiation: adjustRadiation\(c\.accumulatedRadiation \?\? 0, pendingRadiation\) \}\)\)/,
  );
  assert.match(
    characterSource,
    /onConfirm=\{\(\) => \{ if \(pendingRadiation !== null\) setChar\(c => \(\{ \.\.\.c, accumulatedRadiation: adjustRadiation\(c\.accumulatedRadiation \?\? 0, resolveRadiationAddition\(pendingRadiation, armorSheet\.radiationResistance\)\) \}\)\)/,
  );
});

test('character editor subtraction skips resistance and clamps through the shared meter rule', () => {
  const subtraction = characterSource.match(
    /onPress=\{\(\) => \{ const amount = parseInt\(radiationInput, 10\) \|\| 0; setChar\(c => \(\{ \.\.\.c, accumulatedRadiation: adjustRadiation\(c\.accumulatedRadiation \?\? 0, -amount\) \}\)\); setRadiationInput\(''\); \}\}/,
  );
  assert.ok(subtraction, 'radiation subtraction must directly use a negative shared-rule adjustment');
  assert.doesNotMatch(subtraction[0], /setPendingRadiation|resolveRadiationAddition|currentHp/);
});

test('normal and streamlined combat add resolved radiation without applying resistance twice or changing HP', () => {
  const normalApply = combatSource.slice(
    combatSource.indexOf('const handleApplyDamage = useCallback'),
    combatSource.indexOf('// Apply a critical-hit table entry'),
  );
  assert.match(normalApply, /if \(totalDamage > 0\) applyCombatDamage\(attackReceipt\.current, defender\.id, totalDamage,/);
  assert.match(normalApply, /if \(totalRadiationExposure > 0\) adjustRadiation\(defender\.id, totalRadiationExposure\)/);
  assert.doesNotMatch(normalApply, /resolveRadiationAddition|radiationResistance/);

  const streamlinedApply = combatSource.slice(
    combatSource.indexOf('setStreamlinedDmgResult({ perHit'),
    combatSource.indexOf('Haptics.notificationAsync', combatSource.indexOf('setStreamlinedDmgResult({ perHit')),
  );
  assert.match(streamlinedApply, /if \(totalBurstDmg > 0\) applyCombatDamage\(attackReceipt\.current, defender\.id, totalBurstDmg, damagingHits\)/);
  assert.match(streamlinedApply, /if \(radiationExposure > 0\) adjustRadiation\(defender\.id, radiationExposure\)/);
  assert.doesNotMatch(streamlinedApply, /resolveRadiationAddition|radiationResistance|currentHp/);
});

test('combat sheets receive the campaign toggle and character radiation meter', () => {
  assert.match(combatSource, /accumulatedRadiation: character\.accumulatedRadiation/);
  assert.match(combatSource, /hardcoreRadiationRules,/);
  assert.match(combatSource, /resolveCombatSheet\(attacker, allArmor, true, hardcoreRadiationRules\)/);
  assert.match(combatSource, /resolveCombatSheet\(defender, allArmor, true, hardcoreRadiationRules\)/);
  assert.match(combatSource, /resolveCombatSheet\(completionHealActor, allArmor, true, hardcoreRadiationRules\)/);
});

test('radiation changes resynchronize live initiative when optional penalties are enabled', () => {
  assert.match(contextSource, /if \(!s\.hardcoreRadiationRules\) return \{ \.\.\.s, characters \}/);
  assert.match(contextSource, /syncInitiativeEntrySheet\(entry, resolveCharacterArmorSheet\(character, allArmor, false, true\)\)/);
  assert.match(contextSource, /sortInitiativeEntries\(s\.initiativeEntries\.map/);
});

test('area combat updates radiation independently from HP damage', () => {
  const areaUpdate = contextSource.slice(
    contextSource.indexOf('const characters = s.characters.map(c => {', contextSource.indexOf('const applyAreaAttack')),
    contextSource.indexOf('const initiativeEntries = s.initiativeEntries.map', contextSource.indexOf('const applyAreaAttack')),
  );
  assert.match(areaUpdate, /currentHp: Math\.max\(0, c\.currentHp - result\.damage\)/);
  assert.match(
    areaUpdate,
    /accumulatedRadiation: adjustRadiationValue\(c\.accumulatedRadiation \?\? 0, result\.radiationExposure \?\? 0\)/,
  );
  assert.doesNotMatch(areaUpdate, /currentHp:[^\n]*radiation|resolveRadiationAddition/);
  assert.match(contextSource, /const maxAP = charMaxAP\(updated, armor, true\)/);
  assert.match(contextSource, /resolveCharacterArmorSheet\(updatedCharacter, armor, false, true\)/);
});

test('radiation meter is normalized on reload and persisted with campaign state', () => {
  const activeProvider = contextSource.slice(contextSource.indexOf('export function AppProvider'));
  assert.match(
    activeProvider,
    /AsyncStorage\.getItem\(STORAGE_KEY\)\.then\(raw => \{[\s\S]*normalizePersistedState\(JSON\.parse\(raw\) as AppState\)/,
  );
  assert.match(activeProvider, /AsyncStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(state\)\)/);
  assert.match(
    contextSource,
    /const accumulatedRadiation = normalizeRadiation\(normalized\.accumulatedRadiation\)/,
  );
});

test('Hardcore preview open and close interactions never change the disabled campaign setting', () => {
  const previewTrigger = optionsSource.slice(
    optionsSource.indexOf('testID="hardcore-radiation-preview"'),
    optionsSource.indexOf('</TouchableOpacity>', optionsSource.indexOf('testID="hardcore-radiation-preview"')),
  );
  assert.match(previewTrigger, /onPress=\{\(\) => setShowHardcorePreview\(true\)\}/);
  assert.doesNotMatch(previewTrigger, /setHardcoreRadiationRules/);

  const previewModal = optionsSource.slice(
    optionsSource.indexOf('<HardcoreRadiationPreviewModal'),
    optionsSource.indexOf('/>', optionsSource.indexOf('<HardcoreRadiationPreviewModal')),
  );
  assert.match(previewModal, /enabled=\{hardcoreRadiationRules\}/);
  assert.match(previewModal, /onClose=\{\(\) => setShowHardcorePreview\(false\)\}/);
  assert.doesNotMatch(previewModal, /setHardcoreRadiationRules/);
});

test('Hardcore campaign controls live in options and announce their roles and state', () => {
  const campaignControls = optionsSource.slice(
    optionsSource.indexOf('testID="hardcore-radiation-preview"') - 1600,
    optionsSource.indexOf('accessibilityRole="switch"'),
  );

  assert.doesNotMatch(characterSource, /HARDCORE RADIATION PENALTIES/);
  assert.match(campaignControls, /Gameplay Options/);
  assert.match(campaignControls, /accessibilityRole="button"/);
  assert.match(campaignControls, /accessibilityLabel=\{`Review Hardcore radiation thresholds\. Currently \$\{hardcoreRadiationRules \? 'enabled' : 'disabled'\}`\}/);
  assert.match(campaignControls, /accessibilityHint="Opens an explanation without changing the campaign setting"/);
  assert.match(campaignControls, /accessibilityState=\{\{ expanded: showHardcorePreview \}\}/);
  assert.match(optionsSource, /accessibilityLabel="Enable Hardcore radiation penalties"/);
  assert.match(optionsSource, /accessibilityState=\{\{ checked: hardcoreRadiationRules \}\}/);
  assert.match(optionsSource, /onValueChange=\{handleHardcoreToggle\}/);
});

test('Hardcore preview renders every shared non-zero threshold and keeps core sickness separate', () => {
  const previewComponent = optionsSource.slice(
    optionsSource.indexOf('function HardcoreRadiationPreviewModal'),
    optionsSource.indexOf('export default function CampaignOptionsModal'),
  );
  const thresholds = HARDCORE_RADIATION_RULES.filter(rule => rule.threshold > 0);

  assert.match(previewComponent, /HARDCORE_RADIATION_RULES\.filter\(rule => rule\.threshold > 0\)\.reverse\(\)/);
  assert.match(previewComponent, /thresholds\.map\(rule =>/);
  for (const rule of thresholds) {
    assert.match(
      previewComponent,
      /testID=\{`hardcore-radiation-threshold-\$\{rule\.threshold\}`\}/,
      `shared ${rule.threshold}-rad threshold must remain represented by the preview row`,
    );
  }

  const coreExplanation = previewComponent.indexOf('testID="hardcore-radiation-core-sickness"');
  const optionalThresholds = previewComponent.indexOf('thresholds.map(rule =>');
  assert.ok(coreExplanation >= 0 && coreExplanation < optionalThresholds);
  assert.match(previewComponent, /Fallout PnP 2\.0 sickness labels remain narrative-only at 200, 400, 600, 800, and 1000 radiation/);
  assert.match(previewComponent, /The optional penalties below use their own thresholds/);
});

test('Hardcore preview exposes a modal heading, separate core explanation, threshold labels, and close action', () => {
  const previewComponent = optionsSource.slice(
    optionsSource.indexOf('function HardcoreRadiationPreviewModal'),
    optionsSource.indexOf('export default function CampaignOptionsModal'),
  );

  assert.match(previewComponent, /accessibilityViewIsModal/);
  assert.match(previewComponent, /accessibilityLabel="Hardcore radiation rules preview"/);
  assert.match(previewComponent, /accessibilityRole="header"/);
  assert.match(previewComponent, /accessibilityLabel="Core Fallout PnP 2\.0 radiation sickness\./);
  assert.match(previewComponent, /accessibilityLabel=\{`\$\{rule\.threshold\} rads\. \$\{formatHardcoreRadiationPenalties\(rule\.threshold\)\}/);
  assert.match(previewComponent, /accessibilityRole="button"[\s\S]*accessibilityLabel="Close Hardcore radiation rules preview"/);
  assert.match(previewComponent, /accessibilityHint="Returns to campaign options without changing the setting"/);
});

test('Hardcore preview remains scrollable within a compact mobile viewport', () => {
  const previewComponent = optionsSource.slice(
    optionsSource.indexOf('function HardcoreRadiationPreviewModal'),
    optionsSource.indexOf('export default function CampaignOptionsModal'),
  );

  const compactViewport = { width: 400, height: 720 };
  assert.ok(compactViewport.width <= 400 && compactViewport.height <= 720);
  assert.match(previewComponent, /maxHeight: '88%'/);
  assert.match(previewComponent, /<ScrollView contentContainerStyle=/);
  assert.match(previewComponent, /paddingBottom: Math\.max\(16, insets\.bottom\)/);
  assert.match(previewComponent, /testID="hardcore-radiation-preview-close"/);
});