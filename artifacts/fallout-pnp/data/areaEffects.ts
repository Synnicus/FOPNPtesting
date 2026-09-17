import type { AreaEffectKind, DamageType, TimedAreaEffect } from '../context/types.ts';

export type AreaAttackKind =
  | 'explosion' | 'fragmentation' | 'concussion'
  | 'flamethrower' | 'gasInhaled' | 'gasContact'
  | 'electricity' | 'acid';

export type AreaAttackStatus =
  | 'alarm' | 'silentAlarm' | 'gasExposure' | 'poison'
  | 'spikes' | 'explosive';

/**
 * A component of a non-conventional attack.  The existing resolver accepts a
 * rolled `rawDamage`; these dice fields preserve the manual's source profile
 * so a weapon attack and its area outcome can use the same roll.
 */
export interface AreaAttackComponent {
  kind: AreaAttackKind;
  damageDieCount: number;
  damageDie: number;
  damageBonus: number;
  damageType: DamageType;
  radius?: number;
  diameter?: number;
  notes?: readonly string[];
}

export interface AreaTarget {
  id: string;
  name: string;
  endurance: number;
  gasInhaledResistance: number;
  gasContactResistance: number;
  electricityResistance: number;
  dt: number;
  dr: number;
}

export interface AreaAttack {
  /** Unspecified gas canisters require the GM to select exposure before resolution. */
  requiresGasChoice?: boolean;
  kind: AreaAttackKind;
  rawDamage: number;
  /** Source dice for attacks whose damage is rolled by the caller. */
  damageDieCount?: number;
  damageDie?: number;
  damageBonus?: number;
  damageType?: DamageType;
  /** Radius/diameter metadata is retained for callers that select hexes. */
  radius?: number;
  diameter?: number;
  fragmentation?: AreaAttackComponent;
  concussion?: AreaAttackComponent;
  /** Non-damage outcomes remain explicit and are left for GM adjudication. */
  statuses?: readonly AreaAttackStatus[];
  notes?: readonly string[];
  /** Legacy input ignored: manual fire and acid persist until explicitly removed. */
  ongoingRounds?: number;
  /** Required for a missed flamethrower shot after the GM chooses its landing hex. */
  gmAdjudicatedLanding?: boolean;
}

/**
 * Manual mines and traps share the same area attack shape used by the AoE
 * resolver.  `rawDamage` is intentionally zero until the caller rolls the
 * source dice; this avoids replacing a printed 1d20/3d20 profile with an
 * approximation.  The source dice remain on the profile for weapon/AoE
 * parity and for callers that roll attacks centrally.
 *
 * The T45 manual entry specifies that targets within four hexes suffer
 * concussion, but does not print a concussion die; that component therefore
 * carries zero damage and an explicit note rather than inventing a value.
 */
export const MINE_TRAP_PROFILES: Readonly<Record<string, AreaAttack>> = {
  t13_antipersonnel_mine: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 1,
    damageDie: 20,
    damageBonus: 20,
    damageType: 'explosion',
    radius: 0,
    fragmentation: {
      kind: 'fragmentation',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'normal',
      radius: 1,
    },
    concussion: {
      kind: 'concussion',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'explosion',
      radius: 3,
    },
    statuses: ['explosive'],
    notes: ['Adjacent hexes take 1d6 fragmentation damage', 'Within 3 hexes take 1d6 concussion damage'],
  },
  t45_se_antivehicle_mine: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 3,
    damageDie: 20,
    damageBonus: 20,
    damageType: 'explosion',
    radius: 0,
    fragmentation: {
      kind: 'fragmentation',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'normal',
      radius: 2,
    },
    concussion: {
      kind: 'concussion',
      damageDieCount: 0,
      damageDie: 0,
      damageBonus: 0,
      damageType: 'explosion',
      radius: 4,
      notes: ['Manual specifies concussion within 4 hexes but does not print its damage die'],
    },
    statuses: ['explosive'],
    notes: ['Within 2 hexes take 1d6 fragmentation damage', 'Within 4 hexes take concussion damage'],
  },
  bullhorn_trap: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['alarm'],
    notes: ['Alarm sounds when the trigger is sprung; hearing range is GM-adjudicated'],
  },
  silent_alarm: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['silentAlarm'],
    notes: ['Alerts another room or area when triggered; recipient and awareness are GM-adjudicated'],
  },
  gas_trap: {
    requiresGasChoice: true,
    kind: 'gasInhaled',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    diameter: 5,
    statuses: ['gasExposure'],
    notes: ['Gas contents and resulting harm are determined by the GM'],
  },
  poison_needle: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['poison'],
    notes: ['Needle delivers poison; poison type, resistance, and duration are GM-adjudicated'],
  },
  pit_of_spikes: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 3,
    damageDie: 10,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['spikes'],
    notes: ['Victim takes 3d10 damage; the manual does not specify an area beyond the pit'],
  },
  explosive_trap: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'explosion',
    radius: 0,
    statuses: ['explosive'],
    notes: ['Bomb and any chained traps are GM-adjudicated; the manual specifies no damage profile'],
  },
  claymore_trap: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'explosion',
    radius: 0,
    statuses: ['alarm', 'explosive'],
    notes: ['Combines an explosive trap with a bullhorn alarm; alerts everyone within 200 meters. Blast damage is GM-adjudicated.'],
  },
} as const;

export interface AreaResolution {
  targetId: string;
  targetName: string;
  damage: number;
  resisted: boolean;
  resistanceRoll?: number;
  enduranceRoll?: number;
  unconsciousRounds: number;
  ongoing?: {
    kind: AreaEffectKind;
    persistent: true;
    damageDieCount: number;
    damageDie: number;
    damageBonus: number;
    damageType: DamageType;
  };
  /** Structured trap/status outcomes; omitted on legacy manually-created receipts. */
  statuses?: AreaAttackStatus[];
  notes: string[];
}

export type PercentRoller = () => number;
export type DieRoller = (sides: number) => number;

function applyProtection(rawDamage: number, dt: number, dr: number): number {
  const afterDT = Math.max(0, rawDamage - dt);
  return Math.max(0, Math.round(afterDT * (1 - dr / 100)));
}

function exposureResistance(kind: AreaAttackKind, target: AreaTarget): number {
  if (kind === 'gasInhaled') return target.gasInhaledResistance;
  if (kind === 'gasContact') return target.gasContactResistance;
  return 0;
}

export function resolveAreaTarget(
  attack: AreaAttack,
  target: AreaTarget,
  rollPercent: PercentRoller = () => Math.floor(Math.random() * 100) + 1,
  rollDie: DieRoller = sides => Math.floor(Math.random() * sides) + 1,
): AreaResolution {
  if (attack.requiresGasChoice) throw new Error('GM must select the gas payload/exposure before applying the trap.');
  const notes: string[] = [...(attack.notes ?? [])];
  const statuses = [...(attack.statuses ?? [])];
  if (statuses.length) notes.push(`Status requires GM adjudication: ${statuses.join(', ')}`);
  const resistance = Math.max(0, Math.min(100, exposureResistance(attack.kind, target)));
  let resistanceRoll: number | undefined;
  let resisted = false;
  if (resistance > 0) {
    resistanceRoll = rollPercent();
    resisted = resistanceRoll <= resistance;
    notes.push(`${attack.kind === 'electricity' ? 'Electricity' : 'Gas'} resistance ${resistance}%: rolled ${resistanceRoll} — ${resisted ? 'resisted' : 'failed'}`);
  }

  if (attack.kind === 'gasInhaled' || attack.kind === 'gasContact') {
    notes.push(attack.kind === 'gasInhaled' ? 'Inhaled exposure' : 'Contact exposure');
    return {
      targetId: target.id, targetName: target.name,
      damage: resisted ? 0 : Math.max(0, attack.rawDamage),
      resisted, resistanceRoll, unconsciousRounds: 0, statuses, notes,
    };
  }

  const protectedDamage = attack.kind === 'electricity'
    ? Math.max(0, Math.round(attack.rawDamage * (1 - Math.min(100, target.electricityResistance) / 100)))
    : applyProtection(attack.rawDamage, attack.kind === 'concussion' ? 0 : target.dt, target.dr);
  let enduranceRoll: number | undefined;
  let unconsciousRounds = 0;
  if (attack.kind === 'electricity') {
    enduranceRoll = rollDie(10);
    notes.push(`Electricity resistance ${target.electricityResistance}% reduced ${attack.rawDamage} to ${protectedDamage} damage`);
    if (enduranceRoll > target.endurance) {
      unconsciousRounds = rollDie(10);
      notes.push(`Endurance ${target.endurance}: rolled ${enduranceRoll} — unconscious ${unconsciousRounds} rounds`);
    } else {
      notes.push(`Endurance ${target.endurance}: rolled ${enduranceRoll} — remained conscious`);
    }
  }

  let ongoing: AreaResolution['ongoing'];
  if (attack.kind === 'flamethrower' || attack.kind === 'acid') {
    ongoing = {
      kind: attack.kind === 'acid' ? 'acid' : 'fire',
      persistent: true,
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'fire',
    };
    notes.push(ongoing.kind === 'fire'
      ? 'On fire: 1d6/round until a full round is spent rolling to extinguish it'
      : 'Covered in acid: 1d6/round until washed off with an appropriate material');
  }
  if (attack.kind === 'flamethrower' && attack.gmAdjudicatedLanding) {
    notes.push('Miss landing/scatter chosen by GM; target lies in the adjudicated firestream');
  }
  if (attack.kind === 'concussion') notes.push('Concussion ignores DT; DR still applies');

  return {
    targetId: target.id, targetName: target.name, damage: protectedDamage,
    resisted, resistanceRoll, enduranceRoll, unconsciousRounds, ongoing, statuses, notes,
  };
}

export function formatAreaResolution(result: AreaResolution): string {
  const parts = [`${result.targetName}: ${result.damage} damage`];
  if (result.resisted) parts.push('resisted');
  if (result.unconsciousRounds > 0) parts.push(`unconscious ${result.unconsciousRounds} rounds`);
  if (result.statuses?.length) parts.push(result.statuses.join(', '));
  if (result.ongoing) parts.push(`${result.ongoing.kind} (1d6/round until removed)`);
  if (result.notes.length) parts.push(result.notes.join('; '));
  return parts.join(' · ');
}

export function countdownStatus(roundsLeft: number, isActive: boolean): { roundsLeft: number; isActive: boolean } {
  if (!isActive) return { roundsLeft: Math.max(0, roundsLeft), isActive: false };
  const next = Math.max(0, roundsLeft - 1);
  return { roundsLeft: next, isActive: next > 0 };
}

export function advanceAreaEffect(effect: TimedAreaEffect): TimedAreaEffect | null {
  if (effect.persistent) return effect.removeAfterTick ? null : effect;
  const roundsLeft = Math.max(0, (effect.roundsLeft ?? 0) - 1);
  return roundsLeft > 0 ? { ...effect, roundsLeft } : null;
}