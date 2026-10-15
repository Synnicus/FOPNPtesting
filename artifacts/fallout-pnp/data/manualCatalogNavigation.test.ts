import assert from 'node:assert/strict';
import test from 'node:test';
import { getManualCatalogDestinations } from './manualCatalogNavigation.ts';

test('manual weapon references open weapons and ammunition catalogs', () => {
  assert.deepEqual(
    getManualCatalogDestinations('equipment-weapons-rules'),
    [
      { screen: 'equipment', label: 'Weapons', tab: 'weapons', category: 'all' },
      { screen: 'equipment', label: 'Ammunition', tab: 'ammo' },
    ],
  );
});

test('manual armor and hazards references open their matching equipment categories', () => {
  assert.deepEqual(
    getManualCatalogDestinations('equipment-armor-rules'),
    [{ screen: 'equipment', label: 'Armor & helmets', tab: 'armor' }],
  );
  assert.deepEqual(
    getManualCatalogDestinations('equipment-hazards'),
    [{ screen: 'equipment', label: 'Mines & traps', tab: 'weapons', category: 'minesTraps' }],
  );
});

test('creature references can open all Bestiary entries or search a named creature', () => {
  assert.deepEqual(
    getManualCatalogDestinations('bestiary-catalog-link'),
    [{ screen: 'bestiary', label: 'All creatures', allEntries: true }],
  );
  const raceLinks = getManualCatalogDestinations('race-overview');
  assert.deepEqual(
    raceLinks.map(destination => [
      destination.label,
      'search' in destination ? destination.search : undefined,
    ]),
    [
      ['Deathclaw', 'Deathclaw'],
      ['Dog', 'Dog'],
      ['Super Mutant', 'Super Mutant'],
    ],
  );
});

test('manual references without a matching app catalog do not show a dead link', () => {
  assert.deepEqual(getManualCatalogDestinations('equipment-vehicles-rules'), []);
  assert.deepEqual(getManualCatalogDestinations('unknown-rule'), []);
});
