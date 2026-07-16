// ─── Critical Failure Table (3% chance: roll 97-100) ────────────────────────
export interface CriticalFailureResult {
  roll: number;
  name: string;
  description: string;
  effect: 'jam' | 'drop' | 'selfHarm' | 'hitAlly' | 'prone' | 'ammoGone' | 'catastrophic';
  selfDamage?: string; // dice expression
  stunRounds?: number;
}

export const CRITICAL_FAILURE_TABLE: CriticalFailureResult[] = [
  {
    roll: 1,
    name: 'Ammo Problem',
    description: 'The magazine was damaged or the ammo was bad. The weapon does not fire and the rest of the magazine must be discarded.',
    effect: 'ammoGone',
  },
  {
    roll: 2,
    name: 'Weapon Jam',
    description: 'The weapon jams. It cannot be fired again until reloaded (costs 2 AP).',
    effect: 'jam',
  },
  {
    roll: 3,
    name: 'Weapon Drop',
    description: 'You fumble and drop the weapon. It lands 1d3 squares away in a random direction.',
    effect: 'drop',
  },
  {
    roll: 4,
    name: 'Weapon Drop',
    description: 'You fumble and drop the weapon at your feet.',
    effect: 'drop',
  },
  {
    roll: 5,
    name: 'Minor Self Injury',
    description: 'Something goes terribly wrong. You deal 1d6 damage to yourself.',
    effect: 'selfHarm',
    selfDamage: '1d6',
  },
  {
    roll: 6,
    name: 'Minor Self Injury',
    description: 'The weapon recoils violently. You deal 1d6 damage to yourself and are briefly stunned.',
    effect: 'selfHarm',
    selfDamage: '1d6',
    stunRounds: 1,
  },
  {
    roll: 7,
    name: 'Major Self Injury',
    description: 'A catastrophic misfire — you deal 2d6 damage to yourself.',
    effect: 'selfHarm',
    selfDamage: '2d6',
  },
  {
    roll: 8,
    name: 'Hit Ally',
    description: 'You lose control and the shot/strike hits the nearest ally for full damage.',
    effect: 'hitAlly',
  },
  {
    roll: 9,
    name: 'Stumble and Fall',
    description: 'You lose your footing and fall prone (must spend 4 AP to stand next turn).',
    effect: 'prone',
  },
  {
    roll: 10,
    name: 'Catastrophic Failure',
    description: 'The weapon explodes or catastrophically fails. You deal 3d6 damage to yourself and all adjacent targets. Weapon is destroyed.',
    effect: 'catastrophic',
    selfDamage: '3d6',
  },
];

// ─── Critical Hit Tables ─────────────────────────────────────────────────────
export interface CriticalHitResult {
  roll: number;
  name: string;
  description: string;
  damageMultiplier: number;
  // Status effects
  knockOut?: boolean;
  knockOutRounds?: number;
  knockDown?: boolean;
  crippleLocation?: string;
  blindTarget?: boolean;
  instantKill?: boolean;
  injuryLocation?: string;
  injurySeverity?: 'crippled' | 'broken';
}

export const CRITICAL_HIT_RANGED: CriticalHitResult[] = [
  { roll: 1,  name: 'Good Hit',         description: 'Clean hit — extra damage.',      damageMultiplier: 1.5 },
  { roll: 2,  name: 'Solid Hit',        description: 'Solid shot — extra damage.',     damageMultiplier: 2.0 },
  { roll: 3,  name: 'Stunning Hit',     description: 'Target is stunned for 1 round.', damageMultiplier: 1.5, knockOut: true, knockOutRounds: 1 },
  { roll: 4,  name: 'Arm Hit',          description: 'Shot hits the arm — crippled!',  damageMultiplier: 1.5, crippleLocation: 'rightArm', injuryLocation: 'rightArm', injurySeverity: 'crippled' },
  { roll: 5,  name: 'Leg Hit',          description: 'Shot hits the leg — crippled!',  damageMultiplier: 1.5, crippleLocation: 'rightLeg', injuryLocation: 'rightLeg', injurySeverity: 'crippled' },
  { roll: 6,  name: 'Knockdown',        description: 'Target is knocked prone.',        damageMultiplier: 1.5, knockDown: true },
  { roll: 7,  name: 'Head Shot',        description: 'Shot to the head — double damage!', damageMultiplier: 2.0, injuryLocation: 'head', injurySeverity: 'crippled' },
  { roll: 8,  name: 'Eye Shot',         description: 'Blinded! Target loses −40% to all rolls until treated.', damageMultiplier: 2.0, blindTarget: true, injuryLocation: 'eyes', injurySeverity: 'broken' },
  { roll: 9,  name: 'Lethal Wound',     description: 'Triple damage — near-fatal blow.', damageMultiplier: 3.0 },
  { roll: 10, name: 'Instant Kill',     description: 'Direct kill shot to a vital area.', damageMultiplier: 3.0, instantKill: true },
];

export const CRITICAL_HIT_MELEE: CriticalHitResult[] = [
  { roll: 1,  name: 'Good Strike',      description: 'Solid strike — extra damage.',   damageMultiplier: 1.5 },
  { roll: 2,  name: 'Power Strike',     description: 'Crushing blow — extra damage.',  damageMultiplier: 2.0 },
  { roll: 3,  name: 'Stagger',          description: 'Target staggers — stunned 1 round.', damageMultiplier: 1.5, knockOut: true, knockOutRounds: 1 },
  { roll: 4,  name: 'Arm Break',        description: 'Strike shatters the arm!',        damageMultiplier: 1.5, injuryLocation: 'rightArm', injurySeverity: 'broken' },
  { roll: 5,  name: 'Leg Sweep',        description: 'Target knocked prone.',            damageMultiplier: 1.5, knockDown: true },
  { roll: 6,  name: 'Gut Strike',       description: 'Gut hit — target loses 1 AP until healed.', damageMultiplier: 2.0, injuryLocation: 'torso', injurySeverity: 'crippled' },
  { roll: 7,  name: 'Head Strike',      description: 'Head blow — double damage!',      damageMultiplier: 2.0, injuryLocation: 'head', injurySeverity: 'crippled' },
  { roll: 8,  name: 'Eye Strike',       description: 'Eye hit — target blinded!',       damageMultiplier: 2.0, blindTarget: true, injuryLocation: 'eyes', injurySeverity: 'broken' },
  { roll: 9,  name: 'Brutal Strike',    description: 'Triple damage — devastating blow.', damageMultiplier: 3.0 },
  { roll: 10, name: 'Killing Blow',     description: 'Instant kill — lethal strike.',  damageMultiplier: 3.0, instantKill: true },
];

// ─── Aimed shot crit bonuses ─────────────────────────────────────────────────
export const AIMED_SHOT_CRIT_BONUS: Record<string, number> = {
  none:   0,
  torso:  0,
  legs:   15,
  arms:   15,
  groin:  20,
  head:   30,
  eyes:   50,
};

// ─── Knockdown ───────────────────────────────────────────────────────────────
// Melee: if damage dealt >= target STR × 2, target makes END roll (END × 5%) or falls prone
// Burst: each hit on a target has a knockdown chance based on weapon's knockdownChance%
export function calcMeleeKnockdownChance(damage: number, targetStr: number): number {
  return damage >= targetStr * 2 ? 100 : 0; // trigger an endurance save
}
// Returns probability of resisting knockdown (endurance save)
export function calcEnduranceKnockdownResist(targetEnd: number): number {
  return Math.min(95, targetEnd * 5);
}
