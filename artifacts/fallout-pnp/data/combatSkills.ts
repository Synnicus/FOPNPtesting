import type { Character, PositionType, RaceType, SkillType } from '../context/types.ts';

/** The manual cost for helping an unconscious combatant (physical p. 27). */
export const HEAL_FALLEN_AP_COST = 10;

/** Stat! reduces Heal Fallen to 5 AP (printed manual p. 57). */
export function getHealFallenAPCost(actor: Pick<Character, 'perks'>): number {
  return actor.perks?.some(perk => perk.perkId === 'stat' && perk.rank > 0)
    ? 5
    : HEAL_FALLEN_AP_COST;
}

export type CombatSkillResolutionMethod = 'roll' | 'automaticSuccess' | 'automaticFailure';
export interface CombatSkillResolutionInput {
  method: CombatSkillResolutionMethod;
  /** Required for a d100 resolution. Supplying it keeps shared-state updates replay-safe. */
  roll?: number;
}

export interface CombatSkillResolution {
  method: CombatSkillResolutionMethod;
  roll?: number;
  success: boolean;
}

export type HealFallenSkill = 'firstAid' | 'doctor' | 'science' | 'repair';
export interface HealFallenSkillOption {
  skill: HealFallenSkill;
  allowed: boolean;
  reminder?: string;
}

export interface TimedSkillAPPlan {
  valid: boolean;
  reason?: string;
  spentAP: number;
  underfunded: boolean;
  /** Number of combat rounds after the current one in which this action completes. */
  completionRoundOffset: number;
  armorOnlyAC: boolean;
}

export interface TimedSkillActionRequest {
  actorId: string;
  /** GM-facing label, such as "Hack the door". */
  label: string;
  /** Total AP selected by the GM for this action. */
  apCost: number;
  /** Total combat rounds selected by the GM, including the current round. */
  durationRounds: number;
  /** Required only when the selected AP exceeds the actor's remaining AP. */
  confirmSpendAllRemaining?: boolean;
}

export interface HealFallenRequest {
  actorId: string;
  targetId: string;
  skill: HealFallenSkill;
  /** Required for a fully funded action. Underfunded actions resolve next turn. */
  resolution?: CombatSkillResolutionInput;
  /** Required when fewer than the perk-aware AP cost remain; all remaining AP are then spent. */
  confirmSpendAllRemaining?: boolean;
}
export interface CompleteHealFallenRequest {
  actionId: string;
  resolution: CombatSkillResolutionInput;
}

export interface TimedCombatSkillAction {
  id: string;
  kind: 'general' | 'healFallen';
  actorId: string;
  label: string;
  startedRound: number;
  /** The action resolves at the start of the actor's own turn in this round. */
  completesOnRound: number;
  apCost: number;
  spentAP: number;
  armorOnlyAC: boolean;
  targetId?: string;
  skill?: HealFallenSkill;
  resolution?: CombatSkillResolution;
  /** An underfunded Heal Fallen action has reached the healer's next own turn
   * and awaits the GM's Roll/Automatic outcome. It spends no more AP. */
  readyToResolve?: boolean;
  /** Filled only in the transient completion result; it is never persisted. */
  completionSuccess?: boolean;
  completionReason?: string;
}

export interface CombatSkillReceipt {
  requestId: string;
  kind: TimedCombatSkillAction['kind'];
  status: 'rejected' | 'pending' | 'completed';
  actorId: string;
  targetId?: string;
  spentAP: number;
  completesOnRound?: number;
  success?: boolean;
  reason?: string;
}

type HealTarget = Pick<Character, 'race' | 'isKnockedOut'>;

export function isRobot(target: Pick<Character, 'race'>): boolean {
  return target.race === 'robot';
}

export function getHealFallenSkillOptions(target: Pick<Character, 'race'>): HealFallenSkillOption[] {
  const robot = isRobot(target);
  return [
    { skill: 'firstAid', allowed: !robot, reminder: 'First Aid can be used 3 times per day.' },
    { skill: 'doctor', allowed: !robot, reminder: 'Doctor can be used 2 times per day.' },
    { skill: 'science', allowed: robot },
    { skill: 'repair', allowed: robot },
  ];
}

export function canUseHealFallenSkill(target: Pick<Character, 'race'>, skill: HealFallenSkill): boolean {
  return getHealFallenSkillOptions(target).some(option => option.skill === skill && option.allowed);
}

export function isHealFallenTarget(target: HealTarget | undefined): boolean {
  return Boolean(target?.isKnockedOut);
}

/** Resolve the selected UI outcome without generating entropy inside state updates. */
export function resolveCombatSkillOutcome(
  input: CombatSkillResolutionInput,
  effectiveSkill: number,
): CombatSkillResolution | null {
  if (input.method === 'automaticSuccess') return { method: input.method, success: true };
  if (input.method === 'automaticFailure') return { method: input.method, success: false };
  if (!Number.isInteger(input.roll) || (input.roll ?? 0) < 1 || (input.roll ?? 0) > 100) return null;
  return {
    method: 'roll',
    roll: input.roll,
    success: input.roll! <= Math.max(0, Math.min(100, effectiveSkill)),
  };
}

/**
 * Plans the AP branch shared by GM-timed skills and Heal Fallen. An underfunded
 * action spends all remaining AP now and finishes on the actor's next own turn.
 * The requested combat workflow uses an explicit spend-all exception, not AP
 * debt: completion does not charge a shortfall against the following turn.
 * Likewise, the requested defense penalty ends on the next own turn, separately
 * from the GM-selected completion round for longer actions.
 */
export function planTimedSkillAP(input: {
  availableAP: number;
  apCost: number;
  durationRounds: number;
  confirmSpendAllRemaining?: boolean;
}): TimedSkillAPPlan {
  const availableAP = Math.max(0, Math.floor(input.availableAP));
  const apCost = Math.floor(input.apCost);
  const durationRounds = Math.floor(input.durationRounds);
  if (!Number.isFinite(input.apCost) || apCost < 0) {
    return { valid: false, reason: 'AP cost must be a non-negative whole number.', spentAP: 0, underfunded: false, completionRoundOffset: 0, armorOnlyAC: false };
  }
  if (!Number.isFinite(input.durationRounds) || durationRounds < 1) {
    return { valid: false, reason: 'Duration must be at least one round.', spentAP: 0, underfunded: false, completionRoundOffset: 0, armorOnlyAC: false };
  }
  const underfunded = availableAP < apCost;
  if (underfunded && availableAP === 0) {
    return { valid: false, reason: 'No AP remain to begin this action.', spentAP: 0, underfunded, completionRoundOffset: 0, armorOnlyAC: false };
  }
  if (underfunded && !input.confirmSpendAllRemaining) {
    return { valid: false, reason: `This action needs ${apCost} AP; confirm spending all ${availableAP} remaining AP.`, spentAP: 0, underfunded, completionRoundOffset: 0, armorOnlyAC: true };
  }
  return {
    valid: true,
    spentAP: Math.min(availableAP, apCost),
    underfunded,
    completionRoundOffset: Math.max(durationRounds - 1, underfunded ? 1 : 0),
    armorOnlyAC: underfunded || durationRounds > 1,
  };
}

export interface CombatSkillCombatant {
  id: string;
  currentHp: number;
  currentAP: number;
  position: PositionType;
  isKnockedOut: boolean;
  knockOutRoundsLeft: number;
  combatDefenseSuppressed?: boolean;
  revivedNoAPUntilRound?: number;
}

/** A zero-HP combatant never wakes merely because a KO countdown expires. */
export function advanceKnockoutTimer<T extends {
  currentHp: number;
  isKnockedOut: boolean;
  knockOutRoundsLeft: number;
}>(combatant: T): T {
  if (!combatant.isKnockedOut) return combatant;
  const knockOutRoundsLeft = Math.max(0, (combatant.knockOutRoundsLeft ?? 0) - 1);
  return {
    ...combatant,
    knockOutRoundsLeft,
    isKnockedOut: combatant.currentHp <= 0 || knockOutRoundsLeft > 0,
  };
}

export interface CombatSkillTurnAdvance<T extends CombatSkillCombatant> {
  combatants: T[];
  pendingActions: TimedCombatSkillAction[];
  completed: TimedCombatSkillAction[];
}

/** Shared by active character and initiative removal callbacks. Any action
 * involving a removed combatant is abandoned without refunding its spent AP. */
export function cancelPendingActionsForRemovedCharacters<T extends {
  id: string;
  combatDefenseSuppressed?: boolean;
  tempAC?: number;
}>(
  combatants: readonly T[],
  pendingActions: readonly TimedCombatSkillAction[],
  removedCharacterIds: ReadonlySet<string>,
): { combatants: T[]; pendingActions: TimedCombatSkillAction[] } {
  const canceled = pendingActions.filter(action =>
    removedCharacterIds.has(action.actorId) || (!!action.targetId && removedCharacterIds.has(action.targetId)),
  );
  if (canceled.length === 0) return { combatants: [...combatants], pendingActions: [...pendingActions] };
  const pending = pendingActions.filter(action => !canceled.includes(action));
  const impactedActors = new Set(canceled.map(action => action.actorId));
  return {
    pendingActions: pending,
    combatants: combatants.map(combatant => impactedActors.has(combatant.id)
      && !pending.some(action => action.actorId === combatant.id && action.armorOnlyAC && !action.readyToResolve)
      ? { ...combatant, combatDefenseSuppressed: false, ...(combatant.tempAC !== undefined ? { tempAC: 0 } : {}) }
      : combatant) as T[],
  };
}

/**
 * Applies actions that end at the beginning of an actor's own turn. It is pure
 * so the provider and rule tests use precisely the same progression rule.
 */
export function advanceCombatSkillTurn<T extends CombatSkillCombatant>(
  combatants: readonly T[],
  pendingActions: readonly TimedCombatSkillAction[],
  actorId: string,
  currentRound: number,
): CombatSkillTurnAdvance<T> {
  // Defense returns on the next own turn even when a GM action lasts longer.
  const restoredCombatants = combatants.map(combatant => combatant.id === actorId
    ? { ...combatant, combatDefenseSuppressed: false }
    : combatant) as T[];
  const dueActions = pendingActions.filter(action =>
    action.actorId === actorId && action.completesOnRound <= currentRound && !action.readyToResolve,
  );
  if (dueActions.length === 0) {
    return { combatants: restoredCombatants, pendingActions: [...pendingActions], completed: [] };
  }

  const actor = combatants.find(combatant => combatant.id === actorId);
  const completed: TimedCombatSkillAction[] = [];
  const ready: TimedCombatSkillAction[] = [];
  for (const action of dueActions) {
    if (action.kind !== 'healFallen') {
      completed.push(action);
      continue;
    }
    if (!actor) {
      completed.push({ ...action, completionSuccess: false, completionReason: 'The healer is no longer in combat.' });
      continue;
    }
    if (actor.isKnockedOut) {
      completed.push({ ...action, completionSuccess: false, completionReason: 'The unconscious healer cannot complete Heal Fallen.' });
      continue;
    }
    const target = action.targetId ? combatants.find(combatant => combatant.id === action.targetId) : undefined;
    if (!target) {
      completed.push({ ...action, completionSuccess: false, completionReason: 'The Heal Fallen target is no longer in combat.' });
      continue;
    }
    if (!target.isKnockedOut) {
      completed.push({ ...action, completionSuccess: false, completionReason: 'Heal Fallen ends because the target is already conscious.' });
      continue;
    }
    // The manual calls for the roll only after the action is complete. Keep a
    // valid target pending so the UI can collect that outcome atomically.
    ready.push({ ...action, readyToResolve: true });
  }
  const completedIds = new Set(completed.map(action => action.id));
  const readyIds = new Set(ready.map(action => action.id));
  const remainingActions = pendingActions.map(action => readyIds.has(action.id)
    ? ready.find(candidate => candidate.id === action.id)!
    : action).filter(action => !completedIds.has(action.id));
  return {
    combatants: restoredCombatants,
    pendingActions: remainingActions,
    completed,
  };
}

export function isRevivedAPRestricted(
  combatant: Pick<CombatSkillCombatant, 'revivedNoAPUntilRound'>,
  currentRound: number,
): boolean {
  return (combatant.revivedNoAPUntilRound ?? -1) >= currentRound;
}

/** Applies only a valid successful completed Heal Fallen outcome. The target is
 * rechecked here because combat state may have changed while it was pending. */
export function applyHealFallenOutcome<T extends CombatSkillCombatant>(
  combatants: readonly T[],
  targetId: string,
  success: boolean,
  currentRound: number,
  restoredHp = 1,
): { combatants: T[]; applied: boolean } {
  const target = combatants.find(combatant => combatant.id === targetId);
  if (!success || !target?.isKnockedOut || !Number.isFinite(restoredHp) || restoredHp <= 0) {
    return { combatants: [...combatants], applied: false };
  }
  return {
    combatants: combatants.map(combatant => combatant.id === targetId ? {
      ...combatant,
      currentHp: restoredHp,
      currentAP: 0,
      position: 'prone',
      isKnockedOut: false,
      knockOutRoundsLeft: 0,
      revivedNoAPUntilRound: currentRound,
    } : combatant) as T[],
    applied: true,
  };
}

/** Equipped armor's AC is deliberately all that survives a timed-skill penalty. */
export function armorOnlyArmorClass(armorBonuses: readonly number[]): number {
  return armorBonuses.reduce((total, bonus) => total + (Number.isFinite(bonus) ? bonus : 0), 0);
}

/** Kept exported for UI code which needs a strongly typed Heal Fallen skill picker. */
export const HEAL_FALLEN_SKILLS: readonly HealFallenSkill[] = ['firstAid', 'doctor', 'science', 'repair'];
export const HEAL_FALLEN_SKILL_TYPE_GUARD: readonly SkillType[] = HEAL_FALLEN_SKILLS;
export const ROBOT_RACE: RaceType = 'robot';