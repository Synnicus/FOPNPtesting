import type {
  Armor,
  Character,
  CharacterInventoryCategory,
  CharacterInventoryItem,
  CustomConsumable,
  Weapon,
} from '../context/types.ts';
import type { AmmoType } from './ammo.ts';
import { resolveEquippedAmmoTypeId } from './ammo.ts';
import { getWeaponAttackModes } from './weapons.ts';
import type { ToolProfile } from './tools.ts';

export function setInventoryItemQuantity(
  items: readonly CharacterInventoryItem[] | undefined,
  category: CharacterInventoryCategory,
  itemId: string,
  quantity: number,
  patch: Partial<CharacterInventoryItem> = {},
): CharacterInventoryItem[] {
  const current = items ?? [];
  const existing = current.find(item => item.category === category && item.itemId === itemId);
  const rest = current.filter(item => item.category !== category || item.itemId !== itemId);
  if (!Number.isFinite(quantity) || quantity <= 0) return rest;
  const normalizedQuantity = Math.min(1_000_000, Math.floor(quantity));
  return [...rest, {
    ...existing,
    ...patch,
    category,
    itemId,
    quantity: normalizedQuantity,
  }];
}

export function getInventoryItemQuantity(
  items: readonly CharacterInventoryItem[] | undefined,
  category: CharacterInventoryCategory,
  itemId: string,
): number {
  return items?.find(item => item.category === category && item.itemId === itemId)?.quantity ?? 0;
}

/** Returns the remaining stack after consuming items, or null when the stack is insufficient. */
export function consumeInventoryItem(
  items: readonly CharacterInventoryItem[] | undefined,
  category: CharacterInventoryCategory,
  itemId: string,
  quantity = 1,
): CharacterInventoryItem[] | null {
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  const available = getInventoryItemQuantity(items, category, itemId);
  if (available < quantity) return null;
  return setInventoryItemQuantity(items, category, itemId, available - quantity);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalizeInventoryItems(
  value: unknown,
  equipment: Pick<Character, 'equippedBodyArmorId' | 'equippedHelmetId' | 'wearingGasMask'> = {},
): CharacterInventoryItem[] {
  const byKey = new Map<string, CharacterInventoryItem>();
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<CharacterInventoryItem>;
      if (!['armor', 'ammo', 'tool', 'consumable'].includes(item.category ?? '')
        || typeof item.itemId !== 'string' || !item.itemId.trim()
        || !Number.isFinite(item.quantity) || !Number.isInteger(item.quantity)
        || (item.quantity ?? 0) <= 0) continue;
      const normalized: CharacterInventoryItem = {
        category: item.category!,
        itemId: item.itemId.trim(),
        quantity: Math.min(1_000_000, item.quantity!),
        ...(isFiniteNonNegative(item.weightPerUnit) ? { weightPerUnit: item.weightPerUnit } : {}),
        ...(item.ammoWeightMode === 'round' || item.ammoWeightMode === 'box'
          ? { ammoWeightMode: item.ammoWeightMode }
          : {}),
        ...(isFiniteNonNegative(item.weightPerBox) ? { weightPerBox: item.weightPerBox } : {}),
        ...(Number.isInteger(item.unitsPerBox) && (item.unitsPerBox ?? 0) > 0
          ? { unitsPerBox: Math.min(1_000_000, item.unitsPerBox!) }
          : {}),
      };
      const key = `${normalized.category}:${normalized.itemId}`;
      const previous = byKey.get(key);
      byKey.set(key, previous
        ? { ...previous, quantity: Math.min(1_000_000, previous.quantity + normalized.quantity) }
        : normalized);
    }
  }

  for (const armorId of [equipment.equippedBodyArmorId, equipment.equippedHelmetId]) {
    if (armorId) byKey.set(`armor:${armorId}`, {
      ...byKey.get(`armor:${armorId}`),
      category: 'armor',
      itemId: armorId,
      quantity: Math.max(1, byKey.get(`armor:${armorId}`)?.quantity ?? 0),
    });
  }
  // Older characters could toggle the gas-mask bonus without an inventory item.
  // Migrate that worn mask into inventory rather than silently removing its effect.
  if (equipment.wearingGasMask) {
    byKey.set('tool:gas_mask', {
      ...byKey.get('tool:gas_mask'),
      category: 'tool',
      itemId: 'gas_mask',
      quantity: Math.max(1, byKey.get('tool:gas_mask')?.quantity ?? 0),
    });
  }
  return [...byKey.values()];
}

export function normalizeCharacterInventory(character: Character): Character {
  const weaponIds = [...new Set([
    ...(character.inventoryWeaponIds ?? []),
    character.leftHandWeaponId,
    character.rightHandWeaponId,
    character.equippedWeaponId,
  ].filter((id): id is string => typeof id === 'string' && !!id))];
  const rawCounts = character.inventoryWeaponCounts ?? {};
  const weaponCounts = Object.fromEntries(weaponIds.map(id => {
    const count = rawCounts[id];
    return [id, Number.isInteger(count) && count > 0 ? Math.min(1_000_000, count) : 1];
  }));
  return {
    ...character,
    inventoryWeaponIds: weaponIds,
    inventoryWeaponCounts: weaponCounts,
    inventoryItems: normalizeInventoryItems(character.inventoryItems, character),
    npcAmmoProvisionedWeaponIds: [...new Set(
      (character.npcAmmoProvisionedWeaponIds ?? []).filter(id => typeof id === 'string' && !!id),
    )],
  };
}

export interface InventoryCatalog {
  weapons: readonly Weapon[];
  armor: readonly Armor[];
  ammo: readonly AmmoType[];
  tools: readonly ToolProfile[];
  consumables?: readonly { id: string; weight?: number }[];
}

export interface InventoryWeightSummary {
  totalWeight: number;
  unknownWeightCount: number;
}

export function getAmmoRoundWeight(item: CharacterInventoryItem): number | undefined {
  if (item.category !== 'ammo') return undefined;
  if (item.ammoWeightMode === 'round') {
    return isFiniteNonNegative(item.weightPerUnit) ? item.weightPerUnit : undefined;
  }
  if (item.ammoWeightMode === 'box') {
    return isFiniteNonNegative(item.weightPerBox)
      && Number.isInteger(item.unitsPerBox)
      && (item.unitsPerBox ?? 0) > 0
      ? item.weightPerBox! / item.unitsPerBox!
      : undefined;
  }
  if (isFiniteNonNegative(item.weightPerUnit)) return item.weightPerUnit;
  if (isFiniteNonNegative(item.weightPerBox)
    && Number.isInteger(item.unitsPerBox)
    && (item.unitsPerBox ?? 0) > 0) {
    return item.weightPerBox! / item.unitsPerBox!;
  }
  return undefined;
}

export function calculateInventoryWeight(
  character: Character,
  catalog: InventoryCatalog,
): InventoryWeightSummary {
  const weaponCounts = character.inventoryWeaponCounts ?? {};
  const weaponIds = new Set(character.inventoryWeaponIds ?? []);
  let totalWeight = 0;
  let unknownWeightCount = 0;

  for (const weaponId of weaponIds) {
    const weapon = catalog.weapons.find(item => item.id === weaponId);
    const count = Math.max(1, weaponCounts[weaponId] ?? 1);
    if (!weapon || !Number.isFinite(weapon.weight) || weapon.weight < 0) {
      unknownWeightCount += count;
      continue;
    }
    totalWeight += weapon.weight * count;
  }

  for (const item of character.inventoryItems ?? []) {
    let unitWeight: number | undefined = item.weightPerUnit;
    if (item.category === 'ammo') {
      unitWeight = getAmmoRoundWeight(item);
    } else if (!Number.isFinite(unitWeight)) {
      if (item.category === 'armor') unitWeight = catalog.armor.find(entry => entry.id === item.itemId)?.weight;
      if (item.category === 'tool') unitWeight = catalog.tools.find(entry => entry.id === item.itemId)?.weight;
      if (item.category === 'consumable') unitWeight = catalog.consumables?.find(entry => entry.id === item.itemId)?.weight;
    }
    if (!Number.isFinite(unitWeight) || (unitWeight ?? -1) < 0) {
      unknownWeightCount += 1;
      continue;
    }
    totalWeight += (unitWeight ?? 0) * item.quantity;
  }

  return { totalWeight, unknownWeightCount };
}

export function provisionNpcAmmo(
  character: Character,
  weapons: readonly Weapon[],
  ammo: readonly AmmoType[],
): Character {
  if (character.type !== 'npc' || character.vehicle) return character;
  const provisioned = new Set(character.npcAmmoProvisionedWeaponIds ?? []);
  const weaponIds = [...new Set([
    ...(character.inventoryWeaponIds ?? []),
    character.leftHandWeaponId,
    character.rightHandWeaponId,
    character.equippedWeaponId,
  ].filter((id): id is string => !!id))];
  let inventoryItems = character.inventoryItems ?? [];
  let didChange = false;

  for (const weaponId of weaponIds) {
    if (provisioned.has(weaponId)) continue;
    const weapon = weapons.find(item => item.id === weaponId);
    if (!weapon || weapon.magazineSize <= 0) continue;
    const currentState = character.weaponAmmoStates?.find(state => state.weaponId === weaponId);
    const ammoId = resolveEquippedAmmoTypeId(weapon, currentState?.ammoTypeId, ammo);
    if (!ammoId) continue;
    const modes = getWeaponAttackModes(weapon);
    const shotsPerTurn = modes.burst
      ? Math.max(1, weapon.burstLimit)
      : modes.single && weapon.isDoubleShot ? 2 : 1;
    const targetRounds = shotsPerTurn * 10;
    const currentRounds = getInventoryItemQuantity(inventoryItems, 'ammo', ammoId);
    inventoryItems = setInventoryItemQuantity(
      inventoryItems,
      'ammo',
      ammoId,
      currentRounds + targetRounds,
      { ammoWeightMode: inventoryItems.find(item => item.category === 'ammo' && item.itemId === ammoId)?.ammoWeightMode ?? 'box' },
    );
    provisioned.add(weaponId);
    didChange = true;
  }

  return didChange
    ? { ...character, inventoryItems, npcAmmoProvisionedWeaponIds: [...provisioned] }
    : character;
}
