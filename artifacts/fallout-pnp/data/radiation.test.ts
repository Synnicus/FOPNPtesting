import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adjustRadiation,
  normalizeRadiation,
  radiationSicknessLabel,
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

test('manual resistance uses effective percentage and rounds the applied amount', () => {
  assert.equal(resolveRadiationAddition(5, 25), 4);
  assert.equal(resolveRadiationAddition(5, 50), 3);
  assert.equal(resolveRadiationAddition(100, 100), 0);
});

test('radiation subtraction and addition clamp to the meter bounds', () => {
  assert.equal(adjustRadiation(10, -25), 0);
  assert.equal(adjustRadiation(990, 25), 1000);
});