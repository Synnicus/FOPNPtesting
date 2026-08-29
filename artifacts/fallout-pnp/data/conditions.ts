import type { Character, SPECIALStats } from '../context/types.ts';

export const CONDITION_IDS = {
  minorWithdrawal: 'minorWithdrawal',
  majorWithdrawal: 'majorWithdrawal',
  addictionRecovery: 'addictionRecovery',
  drunk: 'drunk',
} as const;

export type ConditionId = typeof CONDITION_IDS[keyof typeof CONDITION_IDS];

export interface ConditionDefinition {
  id: ConditionId;
  name: string;
  description: string;
  statMods: Partial<SPECIALStats>;
  blocksHealing: boolean;
  /** Present for conditions whose activation and removal are not automated. */
  control?: 'user-or-gm';
}

export const CONDITION_DEFINITIONS: readonly ConditionDefinition[] = [
  {
    id: CONDITION_IDS.minorWithdrawal,
    name: 'Minor Withdrawal',
    description: '−1 Agility, −1 Perception. Cannot heal while active.',
    statMods: { agility: -1, perception: -1 },
    blocksHealing: true,
  },
  {
    id: CONDITION_IDS.majorWithdrawal,
    name: 'Major Withdrawal',
    description: '−3 Agility, −3 Perception, −1 Endurance, −1 Strength. Cannot heal while active.',
    statMods: { agility: -3, perception: -3, endurance: -1, strength: -1 },
    blocksHealing: true,
  },
  {
    id: CONDITION_IDS.addictionRecovery,
    name: 'Addiction Recovery',
    description: '−1 Endurance.',
    statMods: { endurance: -1 },
    blocksHealing: false,
  },
  {
    id: CONDITION_IDS.drunk,
    name: 'Drunk',
    description:
      'Under the influence of alcohol. The manual gives no universal stat modifiers or duration; this condition is controlled explicitly by the player or GM.',
    statMods: {},
    blocksHealing: false,
    control: 'user-or-gm',
  },
] as const;

export interface ConditionModifiers {
  statMods: Partial<SPECIALStats>;
  blocksHealing: boolean;
  active: ConditionDefinition[];
}

export interface TemporaryDerivedDeltas {
  maxAP: number;
  armorClass: number;
  sequence: number;
}

/** Derived-stat change caused by moving from stored to working SPECIAL. */
export function computeTemporaryDerivedDeltas(
  stored: SPECIALStats,
  working: SPECIALStats,
): TemporaryDerivedDeltas {
  return {
    maxAP: Math.floor(working.agility / 2) - Math.floor(stored.agility / 2),
    armorClass: working.agility - stored.agility,
    sequence: (working.perception - stored.perception) * 2,
  };
}

export function applyTemporaryDerivedDeltas(
  stored: { maxAP: number; armorClass: number; sequence: number },
  deltas: TemporaryDerivedDeltas,
  explicit: Partial<TemporaryDerivedDeltas> = {},
): { maxAP: number; armorClass: number; sequence: number } {
  return {
    maxAP: Math.max(1, stored.maxAP + deltas.maxAP + (explicit.maxAP ?? 0)),
    armorClass: Math.max(0, stored.armorClass + deltas.armorClass + (explicit.armorClass ?? 0)),
    sequence: Math.max(0, stored.sequence + deltas.sequence + (explicit.sequence ?? 0)),
  };
}

export function getConditionDefinition(id: string): ConditionDefinition | undefined {
  return CONDITION_DEFINITIONS.find(condition => condition.id === id);
}

export function computeConditionModifiers(
  char: Pick<Character, 'conditions'>,
): ConditionModifiers {
  const statMods: Partial<SPECIALStats> = {};
  const active: ConditionDefinition[] = [];
  let blocksHealing = false;

  for (const id of char.conditions ?? []) {
    const condition = getConditionDefinition(id);
    if (!condition) continue;
    active.push(condition);
    blocksHealing ||= condition.blocksHealing;
    for (const [key, value] of Object.entries(condition.statMods) as [keyof SPECIALStats, number][]) {
      statMods[key] = (statMods[key] ?? 0) + value;
    }
  }

  return { statMods, blocksHealing, active };
}

export function isHealingBlocked(char: Pick<Character, 'conditions'>): boolean {
  return computeConditionModifiers(char).blocksHealing;
}

export function resolveHpChange(
  char: Pick<Character, 'conditions' | 'currentHp' | 'maxHp'>,
  amount: number,
): number {
  if (amount > 0 && isHealingBlocked(char)) return char.currentHp;
  return Math.max(0, Math.min(char.maxHp, char.currentHp + amount));
}