export interface DamagePipelineInput {
  initialDiceDamage: number;
  flatDamageBonus: number;
  criticalMultiplier: number;
  damageThreshold: number;
  damageResistance: number;
  /** Defaults to the normal 90% cap; manual creatures can print up to 100%. */
  damageResistanceCap?: number;
}

export interface DamagePipelineResult {
  baseDamage: number;
  afterDamageThreshold: number;
  finalDamage: number;
}

export function resolveAttackWeapon<T extends { id: string }>(
  activeWeapon: T | null,
  attackWeaponId: string | null,
  heldWeapons: Array<T | null | undefined>,
): T | null {
  if (!attackWeaponId) return activeWeapon;
  return heldWeapons.find(weapon => weapon?.id === attackWeaponId) ?? activeWeapon;
}

export function resolveDamagePipeline(input: DamagePipelineInput): DamagePipelineResult {
  const baseDamage = Math.max(
    0,
    Math.round((input.initialDiceDamage + input.flatDamageBonus) * input.criticalMultiplier),
  );
  const damageThreshold = Math.max(0, input.damageThreshold);
  const damageResistance = Math.max(
    0,
    Math.min(input.damageResistanceCap ?? 90, input.damageResistance),
  );
  const afterDamageThreshold = Math.max(0, baseDamage - damageThreshold);
  const finalDamage = Math.max(
    0,
    Math.round(afterDamageThreshold * (1 - damageResistance / 100)),
  );
  return { baseDamage, afterDamageThreshold, finalDamage };
}