import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPECIAL_UNARMED_ATTACKS,
  effectiveUnarmedSkill,
  evaluateEligibility,
  getSpecialUnarmedAttack,
} from './specialUnarmedAttacks.ts';

test('registry contains all 12 manual techniques in four groups', () => {
  assert.equal(SPECIAL_UNARMED_ATTACKS.length, 12);
  assert.deepEqual(
    Object.fromEntries(
      ['primaryPunch', 'secondaryPunch', 'primaryKick', 'secondaryKick'].map(group => [
        group,
        SPECIAL_UNARMED_ATTACKS.filter(attack => attack.group === group).length,
      ]),
    ),
    { primaryPunch: 3, secondaryPunch: 3, primaryKick: 3, secondaryKick: 3 },
  );
});

test('manual AP, damage, critical, and armor-class-piercing values are exact', () => {
  const expected = {
    strong_punch: [3, 3, 0, false],
    hammer_punch: [3, 5, 5, false],
    haymaker: [3, 7, 15, false],
    jab: [3, 3, 10, false],
    palm_strike: [6, 7, 20, true],
    piercing_strike: [8, 10, 40, true],
    strong_kick: [4, 5, 0, false],
    snap_kick: [4, 7, 0, false],
    power_kick: [4, 9, 5, false],
    hip_kick: [7, 7, 0, false],
    hook_kick: [7, 9, 10, true],
    piercing_kick: [9, 12, 50, true],
  } as const;

  for (const attack of SPECIAL_UNARMED_ATTACKS) {
    assert.deepEqual(
      [attack.ap, attack.damageBonus, attack.critBonus, attack.armorClassPiercing],
      expected[attack.id as keyof typeof expected],
      attack.name,
    );
  }
});

test('tagged Unarmed contributes its free +20% to requirements', () => {
  assert.equal(effectiveUnarmedSkill({ unarmed: 95 }, []), 95);
  assert.equal(effectiveUnarmedSkill({ unarmed: 95 }, ['unarmed']), 115);

  const palmStrike = getSpecialUnarmedAttack('palm_strike');
  assert.ok(palmStrike);
  const eligibility = evaluateEligibility(
    palmStrike,
    12,
    { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 7, luck: 5 },
    { unarmed: 95 },
    ['unarmed'],
  );
  assert.equal(eligibility.eligible, true);
});

test('Strong Kick has only the printed U40 and AGI6 gates', () => {
  const strongKick = getSpecialUnarmedAttack('strong_kick');
  assert.ok(strongKick);
  assert.deepEqual(strongKick.requirements, {
    unarmedSkill: 40,
    agility: 6,
    strength: 1,
    level: 1,
  });
  assert.equal(
    evaluateEligibility(
      strongKick,
      1,
      { strength: 1, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 6, luck: 5 },
      { unarmed: 40 },
      [],
    ).eligible,
    true,
  );
});

test('eligibility exposes each unmet manual requirement', () => {
  const piercingKick = getSpecialUnarmedAttack('piercing_kick');
  assert.ok(piercingKick);
  const eligibility = evaluateEligibility(
    piercingKick,
    14,
    { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 7, luck: 5 },
    { unarmed: 100 },
    [],
  );
  assert.equal(eligibility.eligible, false);
  assert.deepEqual(
    eligibility.checks.filter(check => !check.met).map(check => check.label),
    ['Unarmed%', 'AGI', 'STR', 'Level'],
  );
});