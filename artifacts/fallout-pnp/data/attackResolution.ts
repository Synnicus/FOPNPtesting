import type { Character, DamageType } from '../context/types.ts';
import type { AmmoDamageComponent } from './ammo.ts';

export type AmmoDieRoller = (sides: number) => number;

export interface AmmoComponentProtection {
  damageThreshold: number;
  damageResistance: number;
}

export interface AmmoComponentResolution {
  component: AmmoDamageComponent;
  rolls: number[];
  rawDamage: number;
  protection?: AmmoComponentProtection;
  finalHp?: number;
  finalRadiation?: number;
}

export interface AmmoComponentsResolutionInput {
  components: readonly AmmoDamageComponent[];
  rollDie: AmmoDieRoller;
  /** Returns protection for the requested damage type. */
  resolveProtection: (damageType: DamageType, component: AmmoDamageComponent) => AmmoComponentProtection;
  radiationResistance?: number;
  /** Applied to HP components before DT/DR, matching legacy ammunition. */
  criticalMultiplier?: number;
  /** Applied to HP components after DT/DR, matching attack trait effects. */
  postProtectionMultiplier?: number;
}

export interface AmmoComponentsResolution {
  components: AmmoComponentResolution[];
  totalHpDamage: number;
  totalRadiation: number;
}

/**
 * Resolves custom ammunition one component at a time. In particular, a
 * concussion rider is explosive damage (for DR), but has no DT; radiation is
 * a separate rider and never becomes HP damage.
 */
export function resolveAmmoDamageComponents(input: AmmoComponentsResolutionInput): AmmoComponentsResolution {
  if (!Array.isArray(input.components) || input.components.length < 1 || input.components.length > 3) {
    throw new RangeError('Custom ammunition requires one to three components.');
  }
  if (typeof input.rollDie !== 'function' || typeof input.resolveProtection !== 'function') {
    throw new TypeError('Custom ammunition requires a die roller and protection resolver.');
  }

  const resolved: AmmoComponentResolution[] = [];
  let totalHpDamage = 0;
  let totalRadiation = 0;
  for (const component of input.components) {
    const rolls: number[] = [];
    for (let i = 0; i < component.dmgDieCount; i += 1) {
      const roll = input.rollDie(component.dmgDie);
      if (!Number.isFinite(roll)) throw new RangeError('The die roller must return finite numbers.');
      rolls.push(roll);
    }
    const rawDamage = rolls.reduce((sum, roll) => sum + roll, component.dmgBonus);
    if (component.type === 'radiation') {
      const resistance = Math.max(0, Math.min(100, input.radiationResistance ?? 0));
      const finalRadiation = Math.max(0, Math.round(rawDamage * (1 - resistance / 100)));
      resolved.push({ component, rolls, rawDamage, finalRadiation });
      totalRadiation += finalRadiation;
      continue;
    }

    const damageType: DamageType = component.type === 'concussion' ? 'explosion' : component.type;
    const suppliedProtection = input.resolveProtection(damageType, component);
    const protection = component.type === 'concussion'
      ? { damageThreshold: 0, damageResistance: suppliedProtection.damageResistance }
      : suppliedProtection;
    const resolvedHp = resolveDamagePipeline({
      initialDiceDamage: rawDamage,
      flatDamageBonus: 0,
      criticalMultiplier: Number.isFinite(input.criticalMultiplier) ? Math.max(0, input.criticalMultiplier ?? 1) : 1,
      damageThreshold: protection.damageThreshold,
      damageResistance: protection.damageResistance,
      // The caller already resolves the applicable cap. Preserve printed/manual
      // 100% DR instead of applying the normal pipeline's default 90% cap again.
      damageResistanceCap: 100,
    }).finalDamage;
    const postProtectionMultiplier = Number.isFinite(input.postProtectionMultiplier)
      ? Math.max(0, input.postProtectionMultiplier ?? 1)
      : 1;
    const finalHp = Math.max(0, Math.round(resolvedHp * postProtectionMultiplier));
    resolved.push({ component, rolls, rawDamage, protection, finalHp });
    totalHpDamage += finalHp;
  }
  return { components: resolved, totalHpDamage, totalRadiation };
}

/** Short alias for callers that refer to the resolver as custom ammo damage. */
export const resolveCustomAmmoDamage = resolveAmmoDamageComponents;

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

export interface DamageProtectionBreakdownInput {
  baseDT: number;
  baseDR: number;
  ammoIgnoresDT?: boolean;
  ammoDRModifier?: number;
  ignoredDT?: number;
  defenderDRModifier?: number;
  damageResistanceCap?: number;
  bypassesArmor?: boolean;
}

export interface DamageProtectionBreakdown {
  baseDT: number;
  baseDR: number;
  ammoIgnoresDT: boolean;
  ammoDRModifier: number;
  ignoredDT: number;
  defenderDRModifier: number;
  effectiveDT: number;
  effectiveDR: number;
  bypassesArmor: boolean;
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

/**
 * Keeps the printed/equipped protection separate from attack-specific changes
 * so combat results can explain why the effective DT/DR differs.
 */
export function resolveDamageProtection(
  input: DamageProtectionBreakdownInput,
): DamageProtectionBreakdown {
  const baseDT = Math.max(0, input.baseDT);
  const baseDR = Math.max(0, input.baseDR);
  const ammoIgnoresDT = !!input.ammoIgnoresDT;
  const ammoDRModifier = input.ammoDRModifier ?? 0;
  const ignoredDT = Math.max(0, input.ignoredDT ?? 0);
  const defenderDRModifier = input.defenderDRModifier ?? 0;
  const bypassesArmor = !!input.bypassesArmor;
  const damageResistanceCap = input.damageResistanceCap ?? 90;

  return {
    baseDT,
    baseDR,
    ammoIgnoresDT,
    ammoDRModifier,
    ignoredDT,
    defenderDRModifier,
    effectiveDT: bypassesArmor || ammoIgnoresDT ? 0 : Math.max(0, baseDT - ignoredDT),
    effectiveDR: bypassesArmor
      ? 0
      : Math.max(0, Math.min(damageResistanceCap, baseDR + ammoDRModifier + defenderDRModifier)),
    bypassesArmor,
  };
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