import type { Character, DamageType } from '../context/types.ts';

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

export interface DefensivePerkBonuses {
  ac: number;
  dr: number;
  notes: string[];
}

export interface DefensivePerkDefinition {
  id: string;
  name: string;
  combatEffect: {
    armorClassBonus?: number;
    damageResistBonus?: number;
    combatNote?: string;
  } | null;
}

/**
 * Resolves only situational defender AC here. Static AC perks are already
 * included by resolveArmorAwareSheet and must not be added a second time.
 */
export function computeDefensivePerkBonuses(
  char: Pick<Character, 'currentHp' | 'maxHp' | 'perks'> | null,
  dmgType?: DamageType,
  getPerk: (id: string) => DefensivePerkDefinition | undefined = () => undefined,
): DefensivePerkBonuses {
  const out: DefensivePerkBonuses = { ac: 0, dr: 0, notes: [] };
  if (!char?.perks) return out;
  const lowHp50 = char.currentHp < char.maxHp / 2;
  const lowHp20 = char.currentHp < char.maxHp * 0.2;
  for (const cp of char.perks) {
    const perk = getPerk(cp.perkId);
    const fx = perk?.combatEffect;
    if (!perk || !fx) continue;
    const rank = cp.rank;
    const conditional = /HP\s*<\s*50%/i.test(fx.combatNote ?? '');
    if (conditional && !lowHp50) continue;
    if (conditional && fx.armorClassBonus) {
      out.ac += fx.armorClassBonus * rank;
      out.notes.push(`${perk.name}: +${fx.armorClassBonus * rank} AC`);
    }
    if (fx.damageResistBonus) {
      out.dr += fx.damageResistBonus * rank;
      out.notes.push(`${perk.name}: +${fx.damageResistBonus * rank}% DR`);
    }
    if (perk.id === 'die_hard' && lowHp20) {
      out.dr += 10;
      out.notes.push('Die Hard: +10% DR (HP < 20%)');
    }
    if (perk.id === 'hide_of_scars' && dmgType !== 'fire') {
      out.dr += 15 * rank;
      out.notes.push(`Hide of Scars: +${15 * rank}% DR (not fire)`);
    }
    if (perk.id === 'tough_hide') {
      out.dr += 10 * rank;
      out.notes.push(`Tough Hide: +${10 * rank}% DR`);
    }
    if (perk.id === 'hit_the_deck' && dmgType === 'explosion') {
      out.dr += 50;
      out.notes.push('Hit the Deck!: +50% Explosive DR');
    }
  }
  return out;
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