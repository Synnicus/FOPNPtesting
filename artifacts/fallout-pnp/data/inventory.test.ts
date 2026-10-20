import assert from 'node:assert/strict';
import test from 'node:test';
import type { Armor, Character, Weapon } from '../context/types.ts';
import type { AmmoType } from './ammo.ts';
import {
  calculateInventoryWeight,
  consumeInventoryItem,
  useCarriedInventoryItem,
  getInventoryItemQuantity,
  normalizeCharacterInventory,
  provisionNpcAmmo,
} from './inventory.ts';
import { BUILT_IN_TOOLS } from './tools.ts';

const ammo = { id: 'test-round', name: 'Test Round' } as AmmoType;

test("Doctor's Bags remain carried after repeated use, but medical kits are consumed", () => {
  const items = [
    { category: 'tool', itemId: 'doctors_bag', quantity: 1 },
    { category: 'tool', itemId: 'medical_kit', quantity: 2 },
  ] as const;
  const first = useCarriedInventoryItem(items, 'tool', 'doctors_bag');
  const second = useCarriedInventoryItem(first ?? undefined, 'tool', 'doctors_bag');
  assert.equal(getInventoryItemQuantity(second ?? undefined, 'tool', 'doctors_bag'), 1);
  assert.equal(useCarriedInventoryItem([], 'tool', 'doctors_bag'), null);
  const usedKit = useCarriedInventoryItem(second ?? undefined, 'tool', 'medical_kit');
  assert.equal(getInventoryItemQuantity(usedKit ?? undefined, 'tool', 'medical_kit'), 1);
  assert.equal(getInventoryItemQuantity(items, 'tool', 'medical_kit'), 2);
});
const rifle = {
  id: 'test-rifle',
  name: 'Test Rifle',
  weight: 4,
  magazineSize: 30,
  compatibleAmmo: [ammo.id],
  attackModes: { single: true, targeted: true, burst: true },
  apSingle: 5,
  apTargeted: 6,
  apBurst: 5,
  burstLimit: 6,
  isDoubleShot: false,
} as unknown as Weapon;

test('normalizes equipped armor, gas masks, and repeated weapon copies into inventory', () => {
  const normalized = normalizeCharacterInventory({
    inventoryWeaponIds: ['test-rifle'],
    inventoryWeaponCounts: { 'test-rifle': 10 },
    equippedBodyArmorId: 'body-armor',
    wearingGasMask: true,
  } as unknown as Character);

  assert.equal(normalized.inventoryWeaponIds?.length, 1);
  assert.equal(normalized.inventoryWeaponCounts?.['test-rifle'], 10);
  assert.equal(getInventoryItemQuantity(normalized.inventoryItems, 'armor', 'body-armor'), 1);
  assert.equal(getInventoryItemQuantity(normalized.inventoryItems, 'tool', 'gas_mask'), 1);
});

test('calculates weapon copies and ammunition in individual rounds using box weight', () => {
  const character = {
    inventoryWeaponIds: [rifle.id],
    inventoryWeaponCounts: { [rifle.id]: 10 },
    inventoryItems: [
      { category: 'ammo', itemId: ammo.id, quantity: 30, ammoWeightMode: 'box', weightPerBox: 6, unitsPerBox: 20 },
      { category: 'tool', itemId: 'gas_mask', quantity: 1 },
      { category: 'armor', itemId: 'body-armor', quantity: 1 },
    ],
  } as Character;
  const armor = [{ id: 'body-armor', weight: 10 }] as Armor[];
  const summary = calculateInventoryWeight(character, {
    weapons: [rifle],
    armor,
    ammo: [ammo],
    tools: BUILT_IN_TOOLS,
  });

  assert.equal(summary.totalWeight, 62);
  assert.equal(summary.unknownWeightCount, 0);
});

test('uses round weights directly and reports unknown weights without inventing them', () => {
  const character = {
    inventoryItems: [
      { category: 'ammo', itemId: ammo.id, quantity: 12, ammoWeightMode: 'round', weightPerUnit: 0.1 },
      { category: 'tool', itemId: 'dynamite', quantity: 1 },
    ],
  } as Character;
  const summary = calculateInventoryWeight(character, {
    weapons: [],
    armor: [],
    ammo: [ammo],
    tools: BUILT_IN_TOOLS,
  });

  assert.ok(Math.abs(summary.totalWeight - 1.2) < 1e-9);
  assert.equal(summary.unknownWeightCount, 1);
});

test('provisions NPCs for ten turns at their strongest legal fire mode only once', () => {
  const npc = {
    type: 'npc',
    inventoryWeaponIds: [rifle.id],
    inventoryWeaponCounts: { [rifle.id]: 1 },
    weaponAmmoStates: [{ weaponId: rifle.id, currentAmmo: 7, conditionBoxes: 0, ammoTypeId: ammo.id }],
  } as unknown as Character;

  const first = provisionNpcAmmo(npc, [rifle], [ammo]);
  const second = provisionNpcAmmo(first, [rifle], [ammo]);

  assert.equal(getInventoryItemQuantity(first.inventoryItems, 'ammo', ammo.id), 60);
  assert.equal(getInventoryItemQuantity(second.inventoryItems, 'ammo', ammo.id), 60);
  assert.equal(first.weaponAmmoStates?.[0]?.currentAmmo, 7);
  assert.deepEqual(first.npcAmmoProvisionedWeaponIds, [rifle.id]);
});

test('does not grant reserve ammunition to player characters', () => {
  const player = {
    type: 'pc',
    inventoryWeaponIds: [rifle.id],
  } as Character;
  const result = provisionNpcAmmo(player, [rifle], [ammo]);
  assert.equal(result, player);
});

test('consumes exactly the requested carried quantity without allowing negative stacks', () => {
  const items = [
    { category: 'consumable', itemId: 'healing-powder', quantity: 2 },
    { category: 'tool', itemId: 'medical_kit', quantity: 1 },
  ] as const;
  const once = consumeInventoryItem(items, 'consumable', 'healing-powder');
  assert.equal(getInventoryItemQuantity(once ?? undefined, 'consumable', 'healing-powder'), 1);
  const twice = consumeInventoryItem(once ?? undefined, 'consumable', 'healing-powder');
  assert.equal(getInventoryItemQuantity(twice ?? undefined, 'consumable', 'healing-powder'), 0);
  assert.equal(consumeInventoryItem(twice ?? undefined, 'consumable', 'healing-powder'), null);
  assert.equal(consumeInventoryItem(items, 'consumable', 'healing-powder', 0), null);
  assert.equal(getInventoryItemQuantity(items, 'tool', 'medical_kit'), 1);
});
