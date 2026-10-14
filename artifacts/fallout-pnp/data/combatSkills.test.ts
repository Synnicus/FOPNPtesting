import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HEAL_FALLEN_AP_COST,
  advanceCombatSkillTurn,
  applyHealFallenOutcome,
  advanceKnockoutTimer,
  cancelPendingActionsForRemovedCharacters,
  armorOnlyArmorClass,
  canUseHealFallenSkill,
  getHealFallenSkillOptions,
  getHealFallenAPCost,
  isHealFallenTarget,
  isRevivedAPRestricted,
  planTimedSkillAP,
  resolveCombatSkillOutcome,
  type TimedCombatSkillAction,
  type CombatSkillCombatant,
} from './combatSkills.ts';

test('Heal Fallen uses Stat! ownership, not unrelated or unowned perks', () => {
  assert.equal(getHealFallenAPCost({ perks: [] }), 10);
  assert.equal(getHealFallenAPCost({ perks: [{ perkId: 'medic', rank: 1 }] }), 10);
  assert.equal(getHealFallenAPCost({ perks: [{ perkId: 'stat', rank: 0 }] }), 10);
  assert.equal(getHealFallenAPCost({ perks: [{ perkId: 'stat', rank: 1 }] }), 5);
});

for (const hasStat of [false, true]) {
  const apCost = getHealFallenAPCost({ perks: hasStat ? [{ perkId: 'stat', rank: 1 }] : [] });
  test(`Heal Fallen ${hasStat ? 'Stat!' : 'ordinary'} healer pays ${apCost} AP immediately when funded`, () => {
    for (const availableAP of [apCost, apCost + 2]) {
      assert.deepEqual(planTimedSkillAP({ availableAP, apCost, durationRounds: 1 }), {
        valid: true, spentAP: apCost, underfunded: false, completionRoundOffset: 0, armorOnlyAC: false,
      });
    }
  });
  test(`Heal Fallen ${hasStat ? 'Stat!' : 'ordinary'} healer must confirm below ${apCost} AP`, () => {
    for (let availableAP = 1; availableAP < apCost; availableAP++) {
      const rejected = planTimedSkillAP({ availableAP, apCost, durationRounds: 1 });
      assert.equal(rejected.valid, false);
      assert.equal(rejected.spentAP, 0);
      assert.match(rejected.reason!, new RegExp(`needs ${apCost} AP`));
      assert.deepEqual(planTimedSkillAP({ availableAP, apCost, durationRounds: 1, confirmSpendAllRemaining: true }), {
        valid: true, spentAP: availableAP, underfunded: true, completionRoundOffset: 1, armorOnlyAC: true,
      });
    }
    assert.equal(planTimedSkillAP({ availableAP: 0, apCost, durationRounds: 1, confirmSpendAllRemaining: true }).valid, false);
  });
}

test('Heal Fallen gates targets and medical skills by living versus robot type', () => {
  const living = { race: 'human' as const, isKnockedOut: true };
  const robot = { race: 'robot' as const, isKnockedOut: true };
  assert.equal(isHealFallenTarget(living), true);
  assert.equal(isHealFallenTarget({ ...living, isKnockedOut: false }), false);
  assert.equal(canUseHealFallenSkill(living, 'firstAid'), true);
  assert.equal(canUseHealFallenSkill(living, 'repair'), false);
  assert.equal(canUseHealFallenSkill(robot, 'firstAid'), false);
  assert.equal(canUseHealFallenSkill(robot, 'science'), true);
  assert.deepEqual(getHealFallenSkillOptions(robot).filter(option => option.allowed).map(option => option.skill), ['science', 'repair']);
});

test('Heal Fallen AP planning covers funded and confirmed underfunded branches', () => {
  assert.equal(HEAL_FALLEN_AP_COST, 10);
  assert.deepEqual(planTimedSkillAP({ availableAP: 10, apCost: 10, durationRounds: 1 }), {
    valid: true, spentAP: 10, underfunded: false, completionRoundOffset: 0, armorOnlyAC: false,
  });
  const needsConfirmation = planTimedSkillAP({ availableAP: 6, apCost: 10, durationRounds: 1 });
  assert.equal(needsConfirmation.valid, false);
  assert.equal(needsConfirmation.underfunded, true);
  const confirmed = planTimedSkillAP({ availableAP: 6, apCost: 10, durationRounds: 1, confirmSpendAllRemaining: true });
  assert.equal(confirmed.valid, true);
  assert.equal(confirmed.spentAP, 6);
  assert.equal(confirmed.completionRoundOffset, 1);
  assert.equal(confirmed.armorOnlyAC, true);
});

test('GM multi-round actions restore AC next own turn even before completion', () => {
  const action: TimedCombatSkillAction = {
    id: 'task', kind: 'general', actorId: 'healer', label: 'Bypass lock',
    startedRound: 1, completesOnRound: 2, apCost: 5, spentAP: 5, armorOnlyAC: true,
  };
  const combatants = [{ id: 'healer', currentHp: 12, currentAP: 0, position: 'standing' as const, isKnockedOut: false, knockOutRoundsLeft: 0, combatDefenseSuppressed: true }];
  assert.equal(advanceCombatSkillTurn(combatants, [action], 'healer', 1).pendingActions.length, 1);
  const advanced = advanceCombatSkillTurn(combatants, [action], 'healer', 2);
  assert.equal(advanced.pendingActions.length, 0);
  assert.equal(advanced.combatants[0].combatDefenseSuppressed, false);
  const longAction = { ...action, completesOnRound: 4 };
  const nextOwnTurn = advanceCombatSkillTurn(combatants, [longAction], 'healer', 2);
  assert.equal(nextOwnTurn.pendingActions.length, 1);
  assert.equal(nextOwnTurn.combatants[0].combatDefenseSuppressed, false);
  assert.equal(advanceCombatSkillTurn(combatants, [longAction], 'other', 2).combatants[0].combatDefenseSuppressed, true);
  assert.equal(armorOnlyArmorClass([12, 3]), 15);
});

test('roll and manual outcomes resolve deterministically', () => {
  assert.deepEqual(resolveCombatSkillOutcome({ method: 'roll', roll: 42 }, 42), { method: 'roll', roll: 42, success: true });
  assert.equal(resolveCombatSkillOutcome({ method: 'roll', roll: 43 }, 42)?.success, false);
  assert.equal(resolveCombatSkillOutcome({ method: 'roll' }, 42), null);
  assert.equal(resolveCombatSkillOutcome({ method: 'automaticSuccess' }, 0)?.success, true);
  assert.equal(resolveCombatSkillOutcome({ method: 'automaticFailure' }, 100)?.success, false);
});

test('underfunded Heal Fallen becomes ready on the healer’s next turn without changing target state', () => {
  const action: TimedCombatSkillAction = {
    id: 'heal', kind: 'healFallen', actorId: 'medic', targetId: 'fallen', skill: 'doctor',
    label: 'Heal Fallen', startedRound: 1, completesOnRound: 2, apCost: 10, spentAP: 6,
    armorOnlyAC: true,
  };
  const state: CombatSkillCombatant[] = [
    { id: 'medic', currentHp: 10, currentAP: 0, position: 'standing' as const, isKnockedOut: false, knockOutRoundsLeft: 0, combatDefenseSuppressed: true },
    { id: 'fallen', currentHp: 0, currentAP: 5, position: 'prone' as const, isKnockedOut: true, knockOutRoundsLeft: 3 },
  ];
  const result = advanceCombatSkillTurn(state, [action], 'medic', 2);
  const fallen = result.combatants[1];
  assert.deepEqual(
    { hp: fallen.currentHp, ap: fallen.currentAP, position: fallen.position, knockedOut: fallen.isKnockedOut },
    { hp: 0, ap: 5, position: 'prone', knockedOut: true },
  );
  assert.equal(result.pendingActions[0].readyToResolve, true);
  assert.equal(result.completed.length, 0);
  assert.equal(isRevivedAPRestricted(fallen, 2), false);
});

test('delayed Heal Fallen defers a selected outcome and keeps the target unchanged until completion', () => {
  const action: TimedCombatSkillAction = {
    id: 'failed-heal', kind: 'healFallen', actorId: 'medic', targetId: 'fallen', skill: 'firstAid',
    label: 'Heal Fallen', startedRound: 1, completesOnRound: 2, apCost: 10, spentAP: 4,
    armorOnlyAC: true, resolution: { method: 'automaticFailure', success: false },
  };
  const state: CombatSkillCombatant[] = [
    { id: 'medic', currentHp: 10, currentAP: 0, position: 'standing' as const, isKnockedOut: false, knockOutRoundsLeft: 0, combatDefenseSuppressed: true },
    { id: 'fallen', currentHp: 0, currentAP: 0, position: 'prone' as const, isKnockedOut: true, knockOutRoundsLeft: 2 },
  ];
  const result = advanceCombatSkillTurn(state, [action], 'medic', 2);
  assert.deepEqual(result.combatants[1], state[1]);
});

test('delayed Heal Fallen cannot revive a conscious/missing target or be finished by an unconscious healer', () => {
  const action: TimedCombatSkillAction = {
    id: 'interrupted', kind: 'healFallen', actorId: 'medic', targetId: 'fallen', skill: 'doctor',
    label: 'Heal Fallen', startedRound: 1, completesOnRound: 2, apCost: 10, spentAP: 5,
    armorOnlyAC: true, resolution: { method: 'automaticSuccess', success: true },
  };
  const consciousTarget: CombatSkillCombatant[] = [
    { id: 'medic', currentHp: 10, currentAP: 0, position: 'standing', isKnockedOut: false, knockOutRoundsLeft: 0 },
    { id: 'fallen', currentHp: 2, currentAP: 0, position: 'prone', isKnockedOut: false, knockOutRoundsLeft: 0 },
  ];
  const consciousResult = advanceCombatSkillTurn(consciousTarget, [action], 'medic', 2);
  assert.equal(consciousResult.combatants[1].currentHp, 2);
  assert.equal(consciousResult.completed[0].completionSuccess, false);
  assert.match(consciousResult.completed[0].completionReason ?? '', /already conscious/);

  const knockedOutHealer = [{ ...consciousTarget[0], isKnockedOut: true }, { ...consciousTarget[1], isKnockedOut: true }];
  const healerResult = advanceCombatSkillTurn(knockedOutHealer, [action], 'medic', 2);
  assert.equal(healerResult.combatants[1].currentHp, 2);
  assert.match(healerResult.completed[0].completionReason ?? '', /unconscious healer/);

  const missingResult = advanceCombatSkillTurn([consciousTarget[0]], [action], 'medic', 2);
  assert.equal(missingResult.completed[0].completionSuccess, false);
  assert.match(missingResult.completed[0].completionReason ?? '', /no longer in combat/);
});

test('a completed successful outcome revives exactly once and AP-locks only a still-unconscious target', () => {
  const unconscious: CombatSkillCombatant[] = [
    { id: 'fallen', currentHp: 0, currentAP: 4, position: 'prone', isKnockedOut: true, knockOutRoundsLeft: 2 },
  ];
  const success = applyHealFallenOutcome(unconscious, 'fallen', true, 4);
  assert.equal(success.applied, true);
  assert.deepEqual(success.combatants[0], {
    id: 'fallen', currentHp: 1, currentAP: 0, position: 'prone', isKnockedOut: false,
    knockOutRoundsLeft: 0, revivedNoAPUntilRound: 4,
  });
  assert.equal(isRevivedAPRestricted(success.combatants[0], 4), true);
  assert.equal(applyHealFallenOutcome(success.combatants, 'fallen', true, 4).applied, false);
});

test('a zero-HP target remains unconscious when its KO countdown elapses', () => {
  assert.deepEqual(
    advanceKnockoutTimer({ currentHp: 0, isKnockedOut: true, knockOutRoundsLeft: 1 }),
    { currentHp: 0, isKnockedOut: true, knockOutRoundsLeft: 0 },
  );
  assert.deepEqual(
    advanceKnockoutTimer({ currentHp: 2, isKnockedOut: true, knockOutRoundsLeft: 1 }),
    { currentHp: 2, isKnockedOut: false, knockOutRoundsLeft: 0 },
  );
});

test('active removal cleanup abandons involved actions and releases the surviving actor defense', () => {
  const pending: TimedCombatSkillAction[] = [{
    id: 'heal', kind: 'healFallen', actorId: 'medic', targetId: 'fallen', skill: 'doctor',
    label: 'Heal Fallen', startedRound: 1, completesOnRound: 2, apCost: 10, spentAP: 5, armorOnlyAC: true,
  }];
  // This is the exact cleanup invoked by the active `deleteCharacter` callback
  // after it removes the target from the character list.
  const targetDeleted = cancelPendingActionsForRemovedCharacters(
    [{ id: 'medic', combatDefenseSuppressed: true, tempAC: 4 }],
    pending,
    new Set(['fallen']),
  );
  assert.deepEqual(targetDeleted.pendingActions, []);
  assert.deepEqual(targetDeleted.combatants, [{ id: 'medic', combatDefenseSuppressed: false, tempAC: 0 }]);

  // `removeInitiativeEntry` retains character records but supplies the removed
  // linked character ID, so actor removal has the same cancellation behavior.
  const actorEntryDeleted = cancelPendingActionsForRemovedCharacters(
    [{ id: 'medic', combatDefenseSuppressed: true, tempAC: 3 }, { id: 'fallen', combatDefenseSuppressed: false, tempAC: 0 }],
    pending,
    new Set(['medic']),
  );
  assert.deepEqual(actorEntryDeleted.pendingActions, []);
  assert.equal(actorEntryDeleted.combatants[0].combatDefenseSuppressed, false);
  assert.equal(actorEntryDeleted.combatants[0].tempAC, 0);
});