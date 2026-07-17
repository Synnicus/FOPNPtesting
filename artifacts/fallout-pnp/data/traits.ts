import { Character, RaceType, SPECIALStats, SkillType } from '@/context/types';

// ─── Traits (Fallout PnP 2.0 manual, Character Creation Part Three) ──────────
// Traits are optional. A character may pick 0, 1, or 2 traits — never more.
// Skill values referenced by traits are stored WITHOUT the tagged +20 bonus;
// combat/derived code applies bonuses as needed.

export const MAX_TRAITS = 2;

/**
 * Structured, mechanically-applicable effects of a trait. All fields are
 * optional. Non-automatable / GM-adjudicated aspects live in `notes`.
 * `computeTraitEffects` aggregates these across a character's chosen traits.
 */
export interface TraitEffects {
  // SPECIAL stat deltas (may exceed racial max only where the manual says so —
  // that nuance is left to derived code; the raw delta is stored here).
  strengthBonus?: number;
  perceptionBonus?: number;
  enduranceBonus?: number;
  charismaBonus?: number;
  intelligenceBonus?: number;
  agilityBonus?: number;
  luckBonus?: number;

  // Action Points / sequence
  actionPointBonus?: number;   // Bruiser: -2
  sequenceBonus?: number;      // Kamikaze: +5

  // Armor Class
  armorClassBonus?: number;    // Vat Skin: +10
  noNaturalAC?: boolean;       // Kamikaze: AC from armor only (natural AC = 0)

  // Carry weight
  carryWeightPerStr?: number;  // Small Frame: 15 lbs × STR

  // Healing / resistances
  healingRateBonus?: number;   // Fast Metabolism: +2
  radResistBase0?: boolean;    // Fast Metabolism: Radiation Resistance starts at 0%
  poisonResistBase0?: boolean; // Fast Metabolism: Poison Resistance starts at 0%
  radResistBonus?: number;     // Glowing One: +50%
  empResistBonus?: number;     // EMP Shielding: +30%

  // Combat
  meleeDamageBonus?: number;         // Heavy Handed: +4, Domesticated: -2
  damageMultiplier?: number;         // Finesse: 0.7 (all attacks lose 30% damage)
  critChanceBonus?: number;          // Finesse: +10%
  critDamageMultiplier?: number;     // Heavy Handed: 0.7 (crits do 30% less)
  critCrippleMultiplier?: number;    // Heavy Handed: 0.7 (30% less likely to cripple/KO)
  oneHandedToHit?: number;           // One Hander: +20
  twoHandedToHit?: number;           // One Hander: -40
  toHitBonus?: number;               // Targeting Computer: +15 (all attacks)
  attackAPDiscount?: number;         // Fast Shot: 1 AP less per weapon attack
  attackAPPenalty?: number;          // Targeting Computer: +1 AP per attack
  cannotTargetedShot?: boolean;      // Fast Shot: no targeted attacks
  apPerHexMove?: number;             // EMP Shielding: 2 AP per hex

  // Skill deltas (percent, before tag bonus). Negative = penalty.
  skillBonuses?: Partial<Record<SkillType, number>>;
  combatSkillPenaltyPercent?: number; // Good Natured: -10% to all combat skills
  allSkillPenaltyPercent?: number;    // Gifted: -10% to all skills
  allStatBonus?: number;              // Gifted: +1 to all SPECIAL
  skillPointsPerLevelDelta?: number;  // Gifted: -5, Skilled: +5
  oneTimeSkillBonusPercent?: number;  // Skilled: +10% one-time to all skills
  freeTagSkill?: SkillType;           // Ham Fisted: free tag Unarmed
  extraTagSkills?: number;            // Beta Software: +1, Skilled(none)

  // Perk-cadence adjustments
  perkLevelPenalty?: number;          // Skilled: perk every +1 level
  perksAsHuman?: boolean;             // Fear the Reaper: gain perks as a human

  // Free-form GM-adjudicated / non-automatable notes.
  notes?: string;
}

export interface Trait {
  id: string;
  name: string;
  description: string; // includes BOTH benefit and penalty
  // Races that CANNOT choose this trait (from the manual text).
  excludedRaces?: RaceType[];
  // If set, the trait is race-EXCLUSIVE — only these races may choose it.
  allowedRaces?: RaceType[];
  effects: TraitEffects;
}

// The manual uses "Animals" for Dogs + Deathclaws, and "Mutants" for
// super-mutants (+ half-mutants where noted).
const ANIMALS: RaceType[] = ['dog', 'deathclaw'];

export const TRAITS: Trait[] = [
  {
    id: 'fast_metabolism', name: 'Fast Metabolism',
    description: 'Your metabolic rate is twice normal. Benefit: +2 bonus to Healing Rate. Penalty: your Radiation and Poison Resistance start at 0% (racial modifiers are added later). Robots cannot choose this trait.',
    excludedRaces: ['robot'],
    effects: { healingRateBonus: 2, radResistBase0: true, poisonResistBase0: true },
  },
  {
    id: 'small_frame', name: 'Small Frame',
    description: 'You are not quite as big as everyone else, but that never slowed you down. Benefit: +1 bonus to Agility. Penalty: your Carry Weight is only 15 lbs × Strength.',
    effects: { agilityBonus: 1, carryWeightPerStr: 15 },
  },
  {
    id: 'one_hander', name: 'One Hander',
    description: 'One of your hands is very dominant. Benefit: +20% bonus to hit with weapons that only require one hand. Penalty: 40% penalty to hit with two-handed weapons. Animals cannot choose this trait.',
    excludedRaces: [...ANIMALS],
    effects: { oneHandedToHit: 20, twoHandedToHit: -40 },
  },
  {
    id: 'finesse', name: 'Finesse',
    description: 'Your attacks show a lot of finesse. Benefit: +10% bonus to Critical Chance. Penalty: all of your attacks lose 30% of their damage (after reductions for Damage Resistance, etc.).',
    effects: { critChanceBonus: 10, damageMultiplier: 0.7 },
  },
  {
    id: 'kamikaze', name: 'Kamikaze',
    description: 'By not paying attention to any threats, you act faster in a turn. Benefit: +5 point bonus to Sequence. Penalty: you have no natural Armor Class (AC is 0 regardless of Agility) — you must wear armor to get an Armor Class.',
    effects: { sequenceBonus: 5, noNaturalAC: true },
  },
  {
    id: 'heavy_handed', name: 'Heavy Handed',
    description: 'You swing harder, not better. Benefit: +4 point bonus to Melee Damage. Penalty: your critical hits do 30% less damage and are 30% less likely to cripple a limb or cause unconsciousness.',
    effects: { meleeDamageBonus: 4, critDamageMultiplier: 0.7, critCrippleMultiplier: 0.7 },
  },
  {
    id: 'fast_shot', name: 'Fast Shot',
    description: "You don't have time for a targeted attack because you attack faster than normal. Benefit: all weapons take one less action point to use. Penalty: you cannot perform targeted shots. Has no effect on HtH or Melee attacks. Animals cannot choose this trait.",
    excludedRaces: [...ANIMALS],
    effects: { attackAPDiscount: 1, cannotTargetedShot: true, notes: 'No effect on HtH or Melee attacks.' },
  },
  {
    id: 'bloody_mess', name: 'Bloody Mess',
    description: 'By some strange twist of fate, people around you die violently. You always see the worst way a person can die. This does not make you kill any faster or slower, but when enemies die it will be dramatic. Just how dramatic is up to the Gamemaster.',
    effects: { notes: 'Cosmetic/GM-adjudicated: enemies die dramatically. No mechanical effect.' },
  },
  {
    id: 'jinxed', name: 'Jinxed',
    description: 'The good thing is that everyone around you has more critical failures in combat. The bad thing: so do you! Any combat failure (yours, an ally\'s, or an NPC\'s) is 50% more likely to become a critical failure. Critical failures are bad: weapons explode, you may hit the wrong target, you could lose part of your turn, and more.',
    effects: { notes: 'Combat failures (for everyone in combat) are 50% more likely to become critical failures.' },
  },
  {
    id: 'good_natured', name: 'Good Natured',
    description: 'You studied less-combative skills growing up. Benefit: +20% one-time bonus to First Aid, Doctor, Speech, and Barter. Penalty: -10% to starting combat skills (Small Guns, Big Guns, Energy Weapons, Unarmed, and Melee Weapons). One-time bonus. Animals and robots cannot choose this trait.',
    excludedRaces: [...ANIMALS, 'robot'],
    effects: {
      skillBonuses: { firstAid: 20, doctor: 20, speech: 20, barter: 20 },
      combatSkillPenaltyPercent: 10,
    },
  },
  {
    id: 'chem_reliant', name: 'Chem Reliant',
    description: 'You are more easily addicted to chems. Benefit: you recover in half the time from their ill effects. Penalty: your chance to be addicted is twice normal. Robots cannot choose this trait.',
    excludedRaces: ['robot'],
    effects: { notes: 'Addiction chance ×2; withdrawal/recovery time halved.' },
  },
  {
    id: 'chem_resistant', name: 'Chem Resistant',
    description: 'Chems affect you only half as long as normal, and your chance to be addicted is only 50% the normal amount. Robots cannot choose this trait.',
    excludedRaces: ['robot'],
    effects: { notes: 'Chem effect duration halved; addiction chance halved.' },
  },
  {
    id: 'night_person', name: 'Night Person',
    description: 'As a night-time person, you are more awake after dark. Benefit: +1 to Intelligence and Perception from 1801 to 0600. Penalty: -1 to Intelligence and Perception from 0601 to 1800. Cannot take IN/PE above racial maximum or below racial minimum. Robots cannot choose this trait.',
    excludedRaces: ['robot'],
    effects: { notes: 'Night (1801–0600): +1 IN and +1 PE. Day (0601–1800): -1 IN and -1 PE. Clamped to racial min/max.' },
  },
  {
    id: 'skilled', name: 'Skilled',
    description: 'You spend more time improving your skills than a normal person. Benefit: +5 skill points per new level and a one-time +10% to your skills at the start. Penalty: you gain a perk at one level higher than normal. Animals and robots cannot choose this trait.',
    excludedRaces: [...ANIMALS, 'robot'],
    effects: { skillPointsPerLevelDelta: 5, oneTimeSkillBonusPercent: 10, perkLevelPenalty: 1 },
  },
  {
    id: 'gifted', name: 'Gifted',
    description: 'You have more innate abilities than most, so you have not honed your skills as much. Benefit: +1 to all SPECIAL statistics. Penalty: -10% to all skills and 5 fewer Skill Points per level. Robots cannot choose this trait.',
    excludedRaces: ['robot'],
    effects: {
      allStatBonus: 1, allSkillPenaltyPercent: 10, skillPointsPerLevelDelta: -5,
      strengthBonus: 1, perceptionBonus: 1, enduranceBonus: 1, charismaBonus: 1,
      intelligenceBonus: 1, agilityBonus: 1, luckBonus: 1,
    },
  },
  {
    id: 'sex_appeal', name: 'Sex Appeal',
    description: 'Increases your chances of a good reaction with members of the opposite sex, but annoys members of your own. Benefit: +1 Charisma for reactions and +40% to Speech and Barter with the opposite sex. Penalty: -1 Charisma for reactions and -40% to Speech and Barter with the same sex. Only humans can choose this trait.',
    allowedRaces: ['human'],
    effects: { notes: 'Opposite sex: +1 CHA (reactions), +40% Speech/Barter. Same sex: -1 CHA (reactions), -40% Speech/Barter.' },
  },
  {
    id: 'glowing_one', name: 'Glowing One',
    description: 'Extreme radiation exposure has left you glowing in the dark. Benefit: your glow eliminates light modifiers in combat for both you and your enemies, and you gain +50% Radiation Resistance. Penalty: everyone around you takes 10 rads per hour. Only Ghouls can choose this trait.',
    allowedRaces: ['ghoul'],
    effects: { radResistBonus: 50, notes: 'Eliminates light modifiers in combat for you and enemies; everyone nearby takes 10 rads/hour.' },
  },
  {
    id: 'tech_wizard', name: 'Tech Wizard',
    description: "You spent your formative years learning how things work — but ruined your eyes. Benefit: +15% to Science, Repair, and Lockpick. Penalty: -1 Perception. Deathclaws and Dogs cannot choose this trait.",
    excludedRaces: [...ANIMALS],
    effects: { skillBonuses: { science: 15, repair: 15, lockpick: 15 }, perceptionBonus: -1 },
  },
  {
    id: 'fear_the_reaper', name: 'Fear the Reaper',
    description: "You have cheated death! Benefit: you gain perks as if you were a human. Penalty: once a month you must roll against Luck or drop dead. Only Ghouls can choose this trait.",
    allowedRaces: ['ghoul'],
    effects: { perksAsHuman: true, notes: 'Once a month, roll against Luck or die.' },
  },
  {
    id: 'vat_skin', name: 'Vat Skin',
    description: 'Others find you hideous and disgusting after your "dip" in the FEV vats. Benefit: +10 bonus to your Armor Class from your extra-tough skin. Penalty: everyone within ten hexes (friend and foe) suffers a -1 penalty to Perception (you are unaffected). Only Mutants can choose this trait.',
    allowedRaces: ['superMutant', 'halfMutant'],
    effects: { armorClassBonus: 10, notes: 'Everyone within 10 hexes (friend and foe) suffers -1 Perception; you are unaffected.' },
  },
  {
    id: 'ham_fisted', name: 'Ham Fisted',
    description: 'Genetic engineering — or dumb luck — endowed you with huge hands. Benefit: a "free" tag skill in Unarmed. Penalty: -20% to Small Guns, First Aid, Doctor, Repair, Science, and Lockpick (these cannot go below 0%). Only Mutants can choose this trait.',
    allowedRaces: ['superMutant', 'halfMutant'],
    effects: {
      freeTagSkill: 'unarmed',
      skillBonuses: { smallGuns: -20, firstAid: -20, doctor: -20, repair: -20, science: -20, lockpick: -20 },
      notes: 'Penalized skills cannot go below 0%.',
    },
  },
  {
    id: 'bruiser', name: 'Bruiser',
    description: 'A little slower, but a little bigger. You may not hit as often, but they will feel it when you do! Benefit: +2 bonus to Strength. Penalty: -2 Action Points.',
    effects: { strengthBonus: 2, actionPointBonus: -2 },
  },
  // ─── Animal-exclusive traits (Deathclaws and Dogs) ──────────────────────────
  {
    id: 'domesticated', name: 'Domesticated',
    description: 'You have undergone extensive house training and developed above-average Intelligence. Benefit: +1 Intelligence (can even go above your racial maximum). Penalty: -2 penalty to Melee Damage. Only Deathclaws and Dogs can choose this trait.',
    allowedRaces: [...ANIMALS],
    effects: { intelligenceBonus: 1, meleeDamageBonus: -2, notes: 'IN may exceed racial maximum.' },
  },
  {
    id: 'rabid', name: 'Rabid',
    description: 'You are a half-crazed, feral killing machine. Benefit: you are not affected by crippled limbs (blindness still affects you normally), and each time you kill an opponent in combat you get 5 more APs that round. Penalty: chems, including stimpaks, have no effect on you. Only Deathclaws and Dogs can choose this trait.',
    allowedRaces: [...ANIMALS],
    effects: { notes: 'Ignore crippled-limb effects (not blindness); +5 AP on each kill this round; chems/stimpaks have no effect.' },
  },
  // ─── Robot-exclusive traits ─────────────────────────────────────────────────
  {
    id: 'tight_nuts', name: 'Tight Nuts',
    description: 'This robot was built to take the knocks. Benefit: double the base Damage Resistance to any attack. Penalty: you gain only half the Hit Points back from repairs. Only Robots can choose this trait.',
    allowedRaces: ['robot'],
    effects: { notes: 'Base Damage Resistance ×2 to any attack; HP recovered from repairs ×0.5.' },
  },
  {
    id: 'targeting_computer', name: 'Targeting Computer',
    description: 'You have been programmed with an onboard targeting computer. Benefit: you can always add +15% to your chance to-hit. Penalty: all attacks cost 1 extra AP to perform. Only Robots can choose this trait.',
    allowedRaces: ['robot'],
    effects: { toHitBonus: 15, attackAPPenalty: 1 },
  },
  {
    id: 'emp_shielding', name: 'EMP Shielding',
    description: 'You have a dedicated EMP shielding system. Benefit: 30% Resistance to all forms of EMP attack. Penalty: it takes you 2 AP to move 1 hex because of your heavy equipment. Only Robots can choose this trait.',
    allowedRaces: ['robot'],
    effects: { empResistBonus: 30, apPerHexMove: 2 },
  },
  {
    id: 'beta_software', name: 'Beta Software',
    description: 'You have an experimental operating system and peripherals. Benefit: 1 extra Tag Skill. Penalty: whenever using ANY tag skill, you must roll against Luck or suffer an automatic failure and, in combat, a loss of all APs for that round. Only Robots can choose this trait.',
    allowedRaces: ['robot'],
    effects: { extraTagSkills: 1, notes: 'Using any tag skill: roll against Luck or auto-fail (and lose all APs that round in combat).' },
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getTraitById(id: string): Trait | undefined {
  return TRAITS.find(t => t.id === id);
}

// Resolve a trait from either its id or its display name (premades reference
// traits by name, e.g. "Heavy-Handed", "One-Hander", "Fear the Reaper").
export function resolveTrait(idOrName: string): Trait | undefined {
  if (!idOrName) return undefined;
  const norm = idOrName.trim().toLowerCase().replace(/[-\s]+/g, '_');
  return (
    TRAITS.find(t => t.id === norm) ||
    TRAITS.find(t => t.name.toLowerCase().replace(/[-\s]+/g, '_') === norm) ||
    TRAITS.find(t => t.name.toLowerCase() === idOrName.trim().toLowerCase())
  );
}

export function getTraitsForRace(race: RaceType): Trait[] {
  return TRAITS.filter(t =>
    (!t.allowedRaces || t.allowedRaces.includes(race)) &&
    (!t.excludedRaces || !t.excludedRaces.includes(race)),
  );
}

/**
 * Determine whether a character can take a trait. Enforces the MAX_TRAITS cap,
 * race exclusion, race-exclusivity, and duplicate selection.
 */
export function canTakeTrait(
  char: Character,
  trait: Trait,
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const current = char.traits ?? [];

  if (current.includes(trait.id)) {
    reasons.push('Already selected');
  } else if (current.length >= MAX_TRAITS) {
    reasons.push(`A character can have at most ${MAX_TRAITS} traits`);
  }

  if (trait.allowedRaces && !trait.allowedRaces.includes(char.race)) {
    reasons.push(`Only available to: ${trait.allowedRaces.join(', ')}`);
  }

  if (trait.excludedRaces && trait.excludedRaces.includes(char.race)) {
    reasons.push('Your race cannot choose this trait');
  }

  return { allowed: reasons.length === 0, reasons };
}

const SPECIAL_EFFECT_KEYS: (keyof TraitEffects & string)[] = [
  'strengthBonus', 'perceptionBonus', 'enduranceBonus', 'charismaBonus',
  'intelligenceBonus', 'agilityBonus', 'luckBonus',
];

const NUMERIC_SUM_KEYS: (keyof TraitEffects & string)[] = [
  ...SPECIAL_EFFECT_KEYS,
  'actionPointBonus', 'sequenceBonus', 'armorClassBonus', 'carryWeightPerStr',
  'healingRateBonus', 'radResistBonus', 'empResistBonus', 'meleeDamageBonus',
  'critChanceBonus', 'oneHandedToHit', 'twoHandedToHit', 'toHitBonus',
  'attackAPDiscount', 'attackAPPenalty', 'apPerHexMove', 'combatSkillPenaltyPercent',
  'allSkillPenaltyPercent', 'allStatBonus', 'skillPointsPerLevelDelta',
  'oneTimeSkillBonusPercent', 'extraTagSkills', 'perkLevelPenalty',
];

const MULTIPLIER_KEYS: (keyof TraitEffects & string)[] = [
  'damageMultiplier', 'critDamageMultiplier', 'critCrippleMultiplier',
];

const BOOLEAN_KEYS: (keyof TraitEffects & string)[] = [
  'noNaturalAC', 'radResistBase0', 'poisonResistBase0', 'cannotTargetedShot',
  'perksAsHuman',
];

/**
 * Aggregate the structured effects of a character's chosen traits into a single
 * TraitEffects object for use by combat/derived code.
 * - Numeric bonuses are summed.
 * - Multipliers are multiplied together (default 1).
 * - Booleans are OR-ed.
 * - Skill bonuses are summed per skill.
 * - freeTagSkill / notes are collected.
 */
export function computeTraitEffects(char: Character): TraitEffects {
  const result: TraitEffects = {};
  const skillTotals: Partial<Record<SkillType, number>> = {};
  const freeTagSkills: SkillType[] = [];
  const notes: string[] = [];

  const traitIds = char.traits ?? [];
  for (const id of traitIds) {
    const trait = resolveTrait(id);
    if (!trait) continue;
    const e = trait.effects;

    const r = result as Record<string, unknown>;

    for (const key of NUMERIC_SUM_KEYS) {
      const v = e[key] as number | undefined;
      if (typeof v === 'number') {
        r[key] = ((r[key] as number | undefined) ?? 0) + v;
      }
    }

    for (const key of MULTIPLIER_KEYS) {
      const v = e[key] as number | undefined;
      if (typeof v === 'number') {
        r[key] = ((r[key] as number | undefined) ?? 1) * v;
      }
    }

    for (const key of BOOLEAN_KEYS) {
      const v = e[key] as boolean | undefined;
      if (v) {
        r[key] = true;
      }
    }

    if (e.skillBonuses) {
      for (const s of Object.keys(e.skillBonuses) as SkillType[]) {
        skillTotals[s] = (skillTotals[s] ?? 0) + (e.skillBonuses[s] ?? 0);
      }
    }

    if (e.freeTagSkill && !freeTagSkills.includes(e.freeTagSkill)) {
      freeTagSkills.push(e.freeTagSkill);
    }

    if (e.notes) notes.push(`${trait.name}: ${e.notes}`);
  }

  if (Object.keys(skillTotals).length > 0) result.skillBonuses = skillTotals;
  if (freeTagSkills.length > 0) result.freeTagSkill = freeTagSkills[0];
  if (notes.length > 0) result.notes = notes.join(' | ');

  return result;
}
