import type {
  AreaAttackKind,
  AreaRangeUnit,
  CustomAreaDamageType,
  CustomAreaEffect,
} from '../context/types.ts';

export const AREA_ATTACK_KINDS: readonly AreaAttackKind[] = [
  'explosion',
  'fragmentation',
  'concussion',
  'flamethrower',
  'gasInhaled',
  'gasContact',
  'electricity',
  'acid',
];

export const AREA_DAMAGE_TYPES: readonly CustomAreaDamageType[] = [
  'normal',
  'laser',
  'fire',
  'plasma',
  'explosion',
  'radiation',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function validateCustomAreaEffects(value: unknown, rangeUnit: unknown): string[] {
  if (rangeUnit !== 'hex' && rangeUnit !== 'm') return ['Area range unit must be hexes or meters.'];
  if (!Array.isArray(value)) return ['Area effects must be a list.'];
  if (value.length > 8) return ['A profile can contain at most eight area effects.'];

  const errors: string[] = [];
  const ids = new Set<string>();
  const validIds = new Set(value.filter(isRecord).map(effect => effect.id).filter((id): id is string => typeof id === 'string'));
  value.forEach((rawEffect, index) => {
    if (!isRecord(rawEffect)) {
      errors.push(`Area effect ${index + 1} must be an object.`);
      return;
    }
    const id = typeof rawEffect.id === 'string' ? rawEffect.id.trim() : '';
    if (!id || ids.has(id)) errors.push('Area effect ids must be present and unique.');
    if (id) ids.add(id);
    if (typeof rawEffect.label !== 'string' || !rawEffect.label.trim()) errors.push('Every area effect needs a label.');
    if (!AREA_ATTACK_KINDS.includes(rawEffect.kind as AreaAttackKind)) errors.push('Every area effect needs a supported effect kind.');
    if (!AREA_DAMAGE_TYPES.includes(rawEffect.damageType as CustomAreaDamageType)) errors.push('Every area effect needs a supported damage type.');

    const integer = (field: unknown, min: number, max: number) =>
      typeof field === 'number' && Number.isInteger(field) && field >= min && field <= max;
    if (!integer(rawEffect.damageDieCount, 0, 100)) errors.push('Area dice count must be between 0 and 100.');
    if (!integer(rawEffect.damageDie, 0, 1000)) errors.push('Area die sides must be between 0 and 1000.');
    if (!integer(rawEffect.damageBonus, -100000, 100000)) errors.push('Area damage or exposure bonus must be a whole number.');
    if ((rawEffect.damageDieCount === 0) !== (rawEffect.damageDie === 0)) {
      errors.push('Area dice count and die sides must either both be zero or both be positive.');
    }
    if (rawEffect.radius !== undefined && !integer(rawEffect.radius, 0, 100000)) {
      errors.push('Area radius must be a non-negative whole number.');
    }
    if (rawEffect.minDistance !== undefined && !integer(rawEffect.minDistance, 0, 100000)) {
      errors.push('Area minimum distance must be a non-negative whole number.');
    }
    if (
      typeof rawEffect.radius === 'number'
      && typeof rawEffect.minDistance === 'number'
      && rawEffect.minDistance > rawEffect.radius
    ) {
      errors.push('Area minimum distance cannot exceed its maximum radius.');
    }
    if (rawEffect.damageSourceEffectId !== undefined) {
      if (
        typeof rawEffect.damageSourceEffectId !== 'string'
        || !validIds.has(rawEffect.damageSourceEffectId)
        || rawEffect.damageSourceEffectId === id
      ) errors.push('Derived area damage must reference a different effect in this profile.');
      if (
        typeof rawEffect.damageMultiplier !== 'number'
        || !Number.isFinite(rawEffect.damageMultiplier)
        || rawEffect.damageMultiplier <= 0
        || rawEffect.damageMultiplier > 10
      ) errors.push('A derived damage multiplier must be greater than 0 and no more than 10.');
    } else if (rawEffect.damageMultiplier !== undefined) {
      errors.push('A damage multiplier requires a source effect.');
    }
  });
  return [...new Set(errors)];
}

export function sanitizeCustomAreaEffects(value: unknown): CustomAreaEffect[] {
  if (!Array.isArray(value) || value.length > 8) return [];
  const safe = value.filter(isRecord).map(effect => ({
    id: effect.id,
    label: effect.label,
    kind: effect.kind,
    damageType: effect.damageType,
    damageDieCount: effect.damageDieCount,
    damageDie: effect.damageDie,
    damageBonus: effect.damageBonus,
    ...(effect.radius === undefined ? {} : { radius: effect.radius }),
    ...(effect.minDistance === undefined ? {} : { minDistance: effect.minDistance }),
    ...(effect.damageSourceEffectId === undefined ? {} : { damageSourceEffectId: effect.damageSourceEffectId }),
    ...(effect.damageMultiplier === undefined ? {} : { damageMultiplier: effect.damageMultiplier }),
  })) as CustomAreaEffect[];
  const rangeUnit: AreaRangeUnit = 'hex';
  return validateCustomAreaEffects(safe, rangeUnit).length === 0 ? safe : [];
}

