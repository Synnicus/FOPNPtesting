import type { SPECIALStats } from '@/context/types';

// ─── Chems (Drugs) — Fallout PnP 2.0 manual ("Chems (Drugs)" section) ─────────
// Every chem from the manual is represented below. Numbers are quote-checked
// against the manual text. Multi-stage chems (Jet, Voodoo, Buffout, Mentats,
// Psycho, After Burner Gum, Mutie) have an immediate first stage followed by a
// negative after-effect stage that the player progresses through manually.
//
// Manual notes:
//  • "All chems can change a character's stats above and below racial limits."
//  • "When a drug's positive effects have worn off, stats return to normal and
//    are then effected by the negative effects."

export interface ChemStage {
  /** Short label shown in the UI (e.g. "Immediate", "After-effect"). */
  label: string;
  /** SPECIAL stat modifiers applied by this stage. */
  statMods: Partial<SPECIALStats>;
  /** HP healed immediately by this stage (positive). */
  hpHeal?: number;
  /** HP damage taken by this stage (positive number = damage). */
  hpDamage?: number;
  /** Armor Class modifier. */
  acMod?: number;
  /** Action Point modifier. */
  apMod?: number;
  /** Sequence modifier. */
  sequenceMod?: number;
  /** Damage Resistance modifier (percentage points). */
  drMod?: number;
  /** Radiation Resistance modifier (percentage points). */
  radResistMod?: number;
  /** Poison Resistance modifier (percentage points). */
  poisonResistMod?: number;
  /** Healing Rate modifier. */
  healingRateMod?: number;
  /** Rads removed by this stage. */
  radsRemoved?: number;
  /** How long this stage lasts (verbatim-ish from the manual). */
  durationText: string;
  /** Extra GM-adjudicated / non-automatable details. */
  notes?: string;
}

export interface Chem {
  id: string;
  name: string;
  value?: number;
  description: string;
  /** First stage = immediate effect; later stages = after-effects. */
  stages: ChemStage[];
  /** Addiction chance text from the manual, e.g. "80%". */
  addictionChance?: string;
  /** Withdrawal / addiction description. */
  withdrawalText?: string;
  /** True when the chem has after-effect stage(s) beyond the first. */
  isMultiStage: boolean;
}

/**
 * Alcohol is mentioned by the manual as the trigger for Drunken Master, but the
 * manual does not provide an alcohol item table, dose duration, or penalties.
 * Keep it separate from Chem so consuming it cannot accidentally apply a
 * fabricated ChemStage.
 */
export interface AlcoholConsumable {
  id: string;
  name: string;
  description: string;
  conditionId: 'drunk';
  /** Alcohol intoxication is started and ended explicitly by a player or GM. */
  application: 'user-or-gm-controlled';
}

/**
 * The only alcohol consumable identified mechanically by Fallout PnP 2.0 is
 * alcohol itself ("under the influence of alcohol" in Drunken Master). The
 * manual mentions cheap beer only in generic setting-writing prose, not as an
 * equipment entry, so unsupported video-game alcohol brands are not added.
 */
export const ALCOHOL_CONSUMABLES: readonly AlcoholConsumable[] = [
  {
    id: 'alcohol',
    name: 'Alcohol',
    description:
      'An alcoholic drink. The manual defines being under the influence of alcohol, but gives no universal penalties or duration; the player or GM controls the Drunk condition.',
    conditionId: 'drunk',
    application: 'user-or-gm-controlled',
  },
] as const;

export const ALCOHOL_CONSUMABLES_BY_ID: Readonly<Record<string, AlcoholConsumable>> =
  ALCOHOL_CONSUMABLES.reduce(
    (acc, consumable) => {
      acc[consumable.id] = consumable;
      return acc;
    },
    {} as Record<string, AlcoholConsumable>,
  );

export function getAlcoholConsumable(
  id: string | undefined,
): AlcoholConsumable | undefined {
  if (!id) return undefined;
  return ALCOHOL_CONSUMABLES_BY_ID[id];
}

export const CHEMS: Chem[] = [
  {
    id: 'jet',
    name: 'Jet',
    value: 25,
    description:
      'The new street drug of the post-nuclear world, delivered via an inhaler like asthma medicine. Addictive from the very first dose.',
    isMultiStage: true,
    addictionChance: '80%',
    withdrawalText:
      'Jet is addictive from the first dose. It is rumored an antidote for the addiction exists somewhere.',
    stages: [
      {
        label: 'Immediate',
        statMods: { strength: 1, perception: 1 },
        apMod: 2,
        durationText: '1d10 hours',
        notes: '+2 Action Points (up to a maximum of 13), +1 Strength, +1 Perception.',
      },
      {
        label: 'After-effect',
        statMods: { strength: -3, perception: -3 },
        apMod: -2,
        durationText: 'until stats recover',
        notes: 'Loses 2 Action Points, 3 Strength, and 3 Perception.',
      },
    ],
  },
  {
    id: 'healingPowder',
    name: 'Healing Powder',
    value: 50,
    description:
      'A simple healing powder that, when ingested, eases pain from minor wounds. Not addictive; the negative Perception effects are cumulative.',
    isMultiStage: true,
    addictionChance: 'Not addictive',
    stages: [
      {
        label: 'Immediate',
        statMods: {},
        hpHeal: 15, // 1d10+5 — average shown for reference; roll 1d10+5
        durationText: 'instant',
        notes: 'Heals 1d10+5 HP when eaten.',
      },
      {
        label: 'After-effect',
        statMods: { perception: -1 },
        durationText: '1 hour',
        notes: 'Loses 1 Perception for 1 hour. Negative effects are cumulative with repeated doses.',
      },
    ],
  },
  {
    id: 'stimpak',
    name: 'Stimpak',
    value: 150,
    description:
      'A small syringe of healing chems that eases pain and encourages cellular mitosis. Common before the war and found almost everywhere.',
    isMultiStage: false,
    addictionChance: 'Not addictive',
    stages: [
      {
        label: 'Immediate',
        statMods: {},
        hpHeal: 20, // 1d10+10 — roll 1d10+10
        durationText: 'instant',
        notes: 'When injected, heals 1d10+10 HP.',
      },
    ],
  },
  {
    id: 'voodoo',
    name: 'Voodoo',
    value: 50,
    description:
      'A tribal concoction made from parts of dead critters. Eating this powder makes someone feel invincible.',
    isMultiStage: true,
    addictionChance: '20%',
    stages: [
      {
        label: 'Immediate',
        statMods: { agility: 2, luck: 3 },
        drMod: 20, // +20% DR vs Normal attacks only
        durationText: '30 minutes',
        notes: '+2 Agility, +3 Luck, and +20% Damage Resistance vs Normal attacks only.',
      },
      {
        label: 'After-effect',
        statMods: { agility: -2, luck: -3 },
        drMod: -20, // loses all Normal DR gained
        durationText: 'until stats recover',
        notes: 'Feels depressed: loses 2 Agility, 3 Luck, and all Damage Resistance vs Normal attacks.',
      },
    ],
  },
  {
    id: 'antidote',
    name: 'Antidote',
    value: 150,
    description:
      'Made from distilled poisons and antibodies. Tastes and looks like cough syrup and comes in little bottles. Each dose removes one level of poisoning.',
    isMultiStage: false,
    addictionChance: 'Not addictive',
    stages: [
      {
        label: 'Immediate',
        statMods: {},
        durationText: 'instant',
        notes: 'Removes one level of poisoning.',
      },
    ],
  },
  {
    id: 'buffout',
    name: 'Buffout',
    value: 200,
    description:
      'A temporary steroid that increases mitochondrial activity in muscles for a brief time, but impairs brain function.',
    isMultiStage: true,
    addictionChance: '30%',
    stages: [
      {
        label: 'Immediate',
        statMods: { strength: 2, agility: 2, endurance: 3 },
        durationText: 'one-half (round down) of 1d10 hours',
        notes: '+2 Strength, +2 Agility, +3 Endurance.',
      },
      {
        label: 'After-effect',
        statMods: { strength: -3, agility: -3, endurance: -2 },
        durationText: '1d10 hours',
        notes: 'Loses 3 Strength, 3 Agility, and 2 Endurance for 1d10 hours.',
      },
    ],
  },
  {
    id: 'mentats',
    name: 'Mentats',
    value: 280,
    description:
      'Pills that increase awareness for a short time. An experimental military drug that became popular on prewar streets for its intense high.',
    isMultiStage: true,
    addictionChance: '60%',
    stages: [
      {
        label: 'Immediate',
        statMods: { perception: 2, intelligence: 2, charisma: 1 },
        durationText: '1 hour',
        notes: '+2 Perception, +2 Intelligence, +1 Charisma.',
      },
      {
        label: 'After-effect',
        statMods: { perception: -4, intelligence: -4, charisma: -3 },
        durationText: '1d10 hours',
        notes: 'Perception and Intelligence decreased by 4, Charisma decreased by 3, for 1d10 hours.',
      },
    ],
  },
  {
    id: 'afterBurnerGum',
    name: 'After Burner Gum',
    value: 350,
    description:
      'Tiny methamphetamine crystals mixed into chewing gum — an early-21st-century attempt at a "safe" form of meth. A moderate dose with an intense, short high.',
    isMultiStage: true,
    addictionChance: '30%',
    stages: [
      {
        label: 'Immediate',
        statMods: { strength: 1, perception: 1 },
        apMod: 2,
        durationText: '1d10 minutes',
        notes: '+1 Strength, +1 Perception, and +2 Action Points.',
      },
      {
        label: 'After-effect',
        statMods: { strength: -1, perception: -2 },
        durationText: '1 hour',
        notes: 'Loses 1 Strength and 2 Perception for 1 hour.',
      },
    ],
  },
  {
    id: 'psycho',
    name: 'Psycho',
    value: 400,
    description:
      'A chemical cocktail much like a combination of Mentats and speed. Highly addictive with horrible side effects, but the high is worth it to many users.',
    isMultiStage: true,
    addictionChance: '50%',
    stages: [
      {
        label: 'Immediate',
        statMods: { agility: 3, intelligence: -3 },
        durationText: '1d10 hours',
        notes: '+3 Agility, -3 Intelligence.',
      },
      {
        label: 'After-effect',
        statMods: {
          strength: -3,
          perception: -3,
          endurance: -3,
          charisma: -3,
          intelligence: -3,
          agility: -3,
        },
        durationText: '1d10 hours',
        notes: 'Loses 3 points to ALL Stats except Luck for 1d10 hours.',
      },
    ],
  },
  {
    id: 'superStimpak',
    name: 'Super Stimpak',
    value: 500,
    description:
      'An incredible melange of healing chems designed to aid wounded soldiers in crucial moments of combat. Comes in a large clamp that fits around the arm.',
    isMultiStage: true,
    addictionChance: 'Not addictive',
    stages: [
      {
        label: 'Immediate',
        statMods: {},
        hpHeal: 75, // 5d10+50 — roll 5d10+50
        durationText: 'instant',
        notes: 'Heals 5d10+50 HP.',
      },
      {
        label: 'After-effect',
        statMods: {},
        hpDamage: 5, // 1d10 — roll 1d10
        durationText: 'after 1 hour',
        notes: 'Loses 1d10 HP after an hour from the aftershock. Get other healing if HP drops dangerously.',
      },
    ],
  },
  {
    id: 'brotherhoodTraumaPack',
    name: 'Brotherhood of Steel Trauma Pack',
    value: 600,
    description:
      'A chemical concoction made by the Brotherhood for battle. Sends cellular reproduction into overdrive, healing instantly but causing damage afterward.',
    isMultiStage: true,
    addictionChance: 'Not addictive',
    stages: [
      {
        label: 'Immediate',
        statMods: {},
        hpHeal: 93, // 6d10+60 — roll 6d10+60
        durationText: 'instant',
        notes: 'Heals 6d10+60 HP instantly.',
      },
      {
        label: 'After-effect',
        statMods: {},
        hpDamage: 41, // 2d10+30 — roll 2d10+30
        durationText: 'after 1 hour',
        notes: 'Causes 2d10+30 points of damage after 1 hour.',
      },
    ],
  },
  {
    id: 'mutie',
    name: 'Mutie',
    value: 700,
    description:
      'A chemical that reproduces the effects of the Forced Evolutionary Virus for a short time. Super-mutants experience no effects from taking Mutie.',
    isMultiStage: true,
    addictionChance: '20%',
    stages: [
      {
        label: 'Immediate',
        statMods: { strength: 4, perception: 4, charisma: -4, intelligence: -4 },
        durationText: '1d10 hours',
        notes: '+4 Strength, +4 Perception, -4 Charisma, -4 Intelligence. No effect on super-mutants.',
      },
      {
        label: 'After-effect',
        statMods: {},
        hpDamage: 20, // 4d10 on a failed END roll — roll 4d10
        durationText: 'after positive effects wear off',
        notes: 'Make a successful roll against Endurance; if it fails, take 4d10 points of damage.',
      },
    ],
  },
  {
    id: 'ultraStimpack',
    name: 'Ultra Stimpack',
    value: 1000,
    description:
      'The most powerful healing substance on the planet, turning cellular reproduction into a frenzy. Only available in tech-rich organizations like the Brotherhood of Steel or the Enclave.',
    isMultiStage: true,
    addictionChance: 'Not addictive',
    stages: [
      {
        label: 'Immediate',
        statMods: {},
        hpHeal: 105, // 10d10+50 — roll 10d10+50
        durationText: 'instant',
        notes: 'Heals 10d10+50 HP immediately upon injection.',
      },
      {
        label: 'After-effect',
        statMods: {},
        durationText: 'in 1d10 hours',
        notes:
          'Make a roll against Endurance. On a failure, lose every HP the Ultra Stimpack healed; on a success, lose half of those HP.',
      },
    ],
  },
  {
    id: 'radaway',
    name: 'Radaway',
    value: 1500,
    description:
      'An obscure prewar drug that became one of the most useful after the bombs. Comes in an IV bag, taken via drip over about an hour, and bonds with radioactive particles to wash them out.',
    isMultiStage: true,
    addictionChance: '20%',
    stages: [
      {
        label: '1 day after use',
        statMods: {},
        radsRemoved: 25,
        durationText: '1 day after use',
        notes: 'Loses 25 rads.',
      },
      {
        label: '2 days after use',
        statMods: {},
        radsRemoved: 25,
        durationText: '2 days after use',
        notes: 'Loses another 25 rads.',
      },
    ],
  },
  {
    id: 'radX',
    name: 'Rad-X',
    value: 2000,
    description:
      'A pill that creates a radiation "anti-body" in the user. Never marketed for consumers before the war, but made in enough quantity for militaries to remain known in the postwar world.',
    isMultiStage: false,
    addictionChance: 'Not addictive',
    stages: [
      {
        label: 'Immediate',
        statMods: {},
        radResistMod: 50, // +50% Radiation Resistance
        durationText: '1d10 hours',
        notes: 'Increases Radiation Resistance by 50%.',
      },
    ],
  },
];

export const CHEMS_BY_ID: Record<string, Chem> = CHEMS.reduce(
  (acc, chem) => {
    acc[chem.id] = chem;
    return acc;
  },
  {} as Record<string, Chem>,
);

export function getChem(id: string | undefined): Chem | undefined {
  if (!id) return undefined;
  return CHEMS_BY_ID[id];
}
