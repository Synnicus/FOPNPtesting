import type { AreaEffectKind, DamageType, TimedAreaEffect } from '../context/types.ts';

export type AreaAttackKind =
  | 'explosion' | 'fragmentation' | 'concussion'
  | 'flamethrower' | 'gasInhaled' | 'gasContact'
  | 'electricity' | 'acid';

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
  kind: AreaAttackKind;
  rawDamage: number;
  /** Legacy input ignored: manual fire and acid persist until explicitly removed. */
  ongoingRounds?: number;
  /** Required for a missed flamethrower shot after the GM chooses its landing hex. */
  gmAdjudicatedLanding?: boolean;
}

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
  const notes: string[] = [];
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
      resisted, resistanceRoll, unconsciousRounds: 0, notes,
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
    resisted, resistanceRoll, enduranceRoll, unconsciousRounds, ongoing, notes,
  };
}

export function formatAreaResolution(result: AreaResolution): string {
  const parts = [`${result.targetName}: ${result.damage} damage`];
  if (result.resisted) parts.push('resisted');
  if (result.unconsciousRounds > 0) parts.push(`unconscious ${result.unconsciousRounds} rounds`);
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