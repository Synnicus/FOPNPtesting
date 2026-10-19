import type { CustomConsumable, ConsumableCategory } from '../context/types.ts';
import { ALCOHOL_CONSUMABLES, CHEMS } from './chems.ts';

export const CONSUMABLE_CATEGORIES: readonly ConsumableCategory[] = [
  'chem',
  'medical',
  'food',
  'drink',
  'other',
];

const categorySet = new Set<string>(CONSUMABLE_CATEGORIES);

export function isCustomConsumableRecord(value: unknown): value is CustomConsumable {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && record.id.trim().length > 0
    && record.id.length <= 128
    && typeof record.name === 'string'
    && record.name.trim().length > 0
    && record.name.trim().length <= 120
    && typeof record.category === 'string'
    && categorySet.has(record.category)
    && typeof record.value === 'number'
    && Number.isInteger(record.value)
    && record.value >= 0
    && record.value <= 1_000_000
    && typeof record.description === 'string'
    && record.description.length <= 4000
    && typeof record.effectText === 'string'
    && record.effectText.length <= 4000
    && (record.isCustom === undefined || record.isCustom === true);
}

export function validateCustomConsumable(
  value: unknown,
  catalog: readonly CustomConsumable[] = [],
): string[] {
  if (!isCustomConsumableRecord(value)) {
    return ['Enter a valid name, category, caps value, description, and effect notes.'];
  }
  const errors: string[] = [];
  const normalizedName = value.name.trim().toLocaleLowerCase();
  const builtInNames = [
    ...CHEMS.map(chem => chem.name),
    ...ALCOHOL_CONSUMABLES.map(consumable => consumable.name),
  ];
  if (builtInNames.some(name => name.trim().toLocaleLowerCase() === normalizedName)) {
    errors.push('A built-in consumable already uses this name.');
  }
  if (catalog.some(item =>
    item.id !== value.id && item.name.trim().toLocaleLowerCase() === normalizedName)) {
    errors.push('A consumable with this name already exists.');
  }
  if (catalog.some(item => item.id === value.id)) {
    errors.push('A consumable with this id already exists.');
  }
  return errors;
}

export function sanitizeCustomConsumables(value: unknown): CustomConsumable[] {
  if (!Array.isArray(value)) return [];
  const valid: CustomConsumable[] = [];
  for (const item of value) {
    if (!isCustomConsumableRecord(item)) continue;
    const candidate: CustomConsumable = { ...item, name: item.name.trim(), isCustom: true };
    if (validateCustomConsumable(candidate, valid).length === 0) valid.push(candidate);
  }
  return valid;
}
