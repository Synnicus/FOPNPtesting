import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adjustRadiation,
  hardcoreRadiationRule,
  formatHardcoreRadiationPenalties,
  normalizeRadiation,
  radiationSicknessLabel,
  radiationSicknessEffect,
  resolveRadiationAddition,
} from './radiation.ts';

test('radiation normalizes legacy and invalid values without affecting another stat', () => {
  assert.equal(normalizeRadiation(undefined), 0);
  assert.equal(normalizeRadiation(-5), 0);
  assert.equal(normalizeRadiation(1001), 1000);
  const hp = 27;
  assert.equal(adjustRadiation(100, 50), 150);
  assert.equal(hp, 27);
});

test('radiation sickness labels change at the documented 200-rad boundaries', () => {
  assert.equal(radiationSicknessLabel(199), 'No Radiation Sickness');
  assert.equal(radiationSicknessLabel(200), 'Minor Radiation Sickness');
  assert.equal(radiationSicknessLabel(400), 'Advanced Radiation Sickness');
  assert.equal(radiationSicknessLabel(600), 'Critical Radiation Sickness');
  assert.equal(radiationSicknessLabel(800), 'Deadly Radiation Sickness');
  assert.equal(radiationSicknessLabel(1000), 'Fatal Radiation Sickness');
});

test('radiation sickness is a single derived effect that upgrades, downgrades, and clears with the meter', () => {
  assert.equal(radiationSicknessEffect(199), null);
  assert.deepEqual(radiationSicknessEffect(200), {
    id: 'radiation-sickness',
    name: 'Minor Radiation Sickness',
    threshold: 200,
    description: 'Automatically active at 200 radiation. Lower radiation below 200 to downgrade or clear this effect.',
  });
  assert.equal(radiationSicknessEffect(425)?.name, 'Advanced Radiation Sickness');
  assert.equal(radiationSicknessEffect(800)?.name, 'Deadly Radiation Sickness');
  assert.equal(radiationSicknessEffect(1000)?.name, 'Fatal Radiation Sickness');
  assert.equal(radiationSicknessEffect(adjustRadiation(200, -1)), null);
});

test('manual resistance uses effective percentage and rounds the applied amount', () => {
  assert.equal(resolveRadiationAddition(5, 25), 4);
  assert.equal(resolveRadiationAddition(5, 50), 3);
  assert.equal(resolveRadiationAddition(100, 100), 0);
});

test('radiation subtraction and addition clamp to the meter bounds', () => {
  assert.equal(adjustRadiation(10, -25), 0);
  assert.equal(adjustRadiation(990, 25), 1000);
});

test('optional Hardcore rules use their own exact thresholds and never change HP', () => {
  assert.deepEqual(hardcoreRadiationRule(149), { threshold: 0, statMods: {}, fatal: false });
  assert.deepEqual(hardcoreRadiationRule(150), { threshold: 150, statMods: { strength: -1 }, fatal: false });
  assert.deepEqual(hardcoreRadiationRule(300).statMods, { strength: -1, agility: -1 });
  assert.deepEqual(hardcoreRadiationRule(500).statMods, { strength: -2, agility: -2, endurance: -1 });
  assert.deepEqual(hardcoreRadiationRule(750).statMods, { strength: -3, agility: -3, endurance: -3, charisma: -2 });
  assert.equal(hardcoreRadiationRule(999).fatal, false);
  assert.equal(hardcoreRadiationRule(1000).fatal, true);
  assert.equal(formatHardcoreRadiationPenalties(750), 'STR -3 · AGI -3 · END -3 · CHA -2');
  const hp = 27;
  hardcoreRadiationRule(1000);
  assert.equal(hp, 27);
});