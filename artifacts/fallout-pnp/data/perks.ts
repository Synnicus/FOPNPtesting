import { Character, RaceType, SPECIALStats, SkillType } from '@/context/types';
import { calcBaseSkills } from './derived';
import { computePerkStatBonuses } from './effects';
import { applyImmediateTraitSpecial, calculateRebasedEffectiveSkills } from './effectiveRules';

export type PerkCategory = 'combat' | 'defense' | 'utility' | 'social' | 'survival' | 'racial';

export interface PerkCombatEffect {
  // To-hit bonuses
  toHitBonus?: number;
  rangedToHitBonus?: number;
  meleeToHitBonus?: number;
  smallGunsToHitBonus?: number;
  // Damage bonuses
  damageBonus?: number;
  rangedDamageBonus?: number;
  meleeDamageBonus?: number;
  fireWeaponDamageBonus?: number;
  explosionDamageBonus?: number;
  // Critical hit modifiers
  critChanceBonus?: number;       // flat % added to crit chance
  critDamageMultiplier?: number;  // multiply crit damage by this
  allHitsAreCrits?: boolean;      // Slayer / Sniper / Gunslinger
  // DT/DR ignore
  ignoreDT?: number;
  damageResistBonus?: number;
  // AP economy
  attackAPDiscount?: number;
  /** Permanent maximum AP gained per rank (Action Boy/Girl). */
  maxAPBonus?: number;
  // Defensive
  armorClassBonus?: number;
  sequenceBonus?: number;
  // Misc
  extraMaxHP?: number;
  combatNote?: string;
  // Adrenaline Rush trigger
  adrenalineRushActive?: boolean;
  adrenalineStrBonus?: number;
  // Perk-specific
  weaponStrReqReduction?: number;
}

// Structured requirements parsed from the manual. All fields optional; a
// perk with no requirements object simply has none beyond level.
export interface PerkRequirements {
  level?: number;
  // Partial SPECIAL minimums (e.g. { strength: 6, agility: 8 }).
  stats?: Partial<SPECIALStats>;
  // Skill % minimums; skills are stored WITHOUT the tagged +20 bonus, which
  // canTakePerk applies at check time.
  skills?: Partial<Record<SkillType, number>>;
  // Requires the character to already possess these perk ids.
  otherPerks?: string[];
  // If true, requirement is an OR across the listed skills (e.g. Medic:
  // First Aid 40% OR Doctor 40%).
  skillsAny?: boolean;
}

export interface Perk {
  id: string;
  name: string;
  category: PerkCategory;
  description: string;
  minLevel: number;
  maxRanks: number;
  // Legacy flat SPECIAL requirements (kept for backward compatibility; the
  // structured `requirements` object is authoritative going forward).
  minSTR?: number;
  minPER?: number;
  minEND?: number;
  minCHA?: number;
  minAGI?: number;
  minINT?: number;
  minLCK?: number;
  // Legacy single-skill requirement.
  minSkill?: { skill: string; value: number };
  // Structured requirements (authoritative).
  requirements?: PerkRequirements;
  // Race restriction — perk is ONLY available to these races (empty/undefined = any).
  requiresRace?: RaceType[];
  // Races that CANNOT choose this perk (from the manual text).
  excludedRaces?: RaceType[];
  // Combat effect (null = non-combat)
  combatEffect: PerkCombatEffect | null;
}

// Robots never gain perks (manual). Applied globally in canTakePerk.
const ROBOTS_NO_PERKS = true;

export const PERKS: Perk[] = [
  // ─── COMBAT PERKS ─────────────────────────────────────────────────────────
  {
    id: 'action_boy_girl', name: 'Action Boy/Girl', category: 'combat',
    description: 'Each rank gives you one additional Action Point per combat turn.',
    minLevel: 12, maxRanks: 2, minAGI: 5,
    requirements: { level: 12, stats: { agility: 5 } },
    combatEffect: { maxAPBonus: 1, combatNote: '+1 max AP per rank' },
  },
  {
    id: 'adrenaline_rush', name: 'Adrenaline Rush', category: 'combat',
    description: 'You have a fear of death that lets you fight harder when wounded. When HP drop below 50% of maximum, you gain +1 Strength (cannot exceed racial maximum).',
    minLevel: 6, maxRanks: 1, minSTR: 1,
    requirements: { level: 6, stats: { strength: 1 } },
    combatEffect: { adrenalineRushActive: true, adrenalineStrBonus: 1, combatNote: '+1 STR when HP < 50%' },
  },
  {
    id: 'animal_friend', name: 'Animal Friend', category: 'utility',
    description: 'You spend a LOT of time with animals. Animals will not attack a friend unless threatened or attacked first.',
    minLevel: 9, maxRanks: 1, minINT: 5, minSkill: { skill: 'outdoorsman', value: 25 },
    requirements: { level: 9, stats: { intelligence: 5 }, skills: { outdoorsman: 25 } },
    combatEffect: null,
  },
  {
    id: 'bend_the_rules', name: 'Bend the Rules', category: 'utility',
    description: 'The next time you get to choose a perk, you can ignore all restrictions except for race. You rule!',
    minLevel: 16, maxRanks: 1, minLCK: 6,
    requirements: { level: 16, stats: { luck: 6 } },
    combatEffect: null,
  },
  {
    id: 'better_criticals', name: 'Better Criticals', category: 'combat',
    description: 'The critical hits you cause are more devastating. A critical hit that does not kill outright does 150% normal damage (in addition to any damage bonuses), and your chance to damage a limb is increased by 50%.',
    minLevel: 9, maxRanks: 1, minPER: 6, minAGI: 4, minLCK: 6,
    requirements: { level: 9, stats: { perception: 6, agility: 4, luck: 6 } },
    excludedRaces: ['superMutant'],
    combatEffect: { critDamageMultiplier: 1.5, combatNote: '+50% crit damage; +50% chance to cripple limb' },
  },
  {
    id: 'bluff_master', name: 'Bluff Master', category: 'social',
    description: 'You are the king or queen of smooth talking. Whenever caught stealing, you can automatically talk your way out of the situation.',
    minLevel: 8, maxRanks: 1, minCHA: 3,
    requirements: { level: 8, stats: { charisma: 3 } },
    combatEffect: null,
  },
  {
    id: 'bone_head', name: 'Bone Head', category: 'defense',
    description: 'You have a very thick skull. Rank 1 gives a 50% chance to avoid being knocked unconscious; rank 2 increases that to 75%.',
    minLevel: 7, maxRanks: 2, minSTR: 7,
    requirements: { level: 7, stats: { strength: 7 } },
    combatEffect: { combatNote: '50%/75% chance to avoid knockout' },
  },
  {
    id: 'bonsai', name: 'Bonsai', category: 'racial',
    description: 'Through careful nurturing, a small fruit tree grows out of your head — a steady supply of fruit! Only Ghouls can choose this perk.',
    minLevel: 12, maxRanks: 1,
    requiresRace: ['ghoul'],
    requirements: { level: 12, skills: { outdoorsman: 50, science: 40 } },
    combatEffect: null,
  },
  {
    id: 'bonus_hth_attacks', name: 'Bonus HtH Attacks', category: 'combat',
    description: 'You can make more hand-to-hand or melee attacks per combat turn. The AP cost to use a HtH or Melee attack is reduced by 1.',
    minLevel: 15, maxRanks: 1, minAGI: 6,
    requirements: { level: 15, stats: { agility: 6 } },
    combatEffect: { attackAPDiscount: 1, combatNote: 'Melee/HtH attacks −1 AP' },
  },
  {
    id: 'bonus_hth_damage', name: 'Bonus HtH Damage', category: 'combat',
    description: 'A special technique lets you deal more damage with your fists and melee weapons. +2 Melee Damage per rank.',
    minLevel: 3, maxRanks: 3, minSTR: 6, minAGI: 6,
    requirements: { level: 3, stats: { strength: 6, agility: 6 } },
    combatEffect: { meleeDamageBonus: 2, combatNote: '+2 melee/unarmed damage per rank' },
  },
  {
    id: 'bonus_move', name: 'Bonus Move', category: 'combat',
    description: 'You take longer strides in combat. For each rank you can move 2 more hexes in combat; the first two hexes you move cost no APs.',
    minLevel: 6, maxRanks: 2, minAGI: 5,
    requirements: { level: 6, stats: { agility: 5 } },
    combatEffect: { combatNote: '+2 free-move hexes per rank' },
  },
  {
    id: 'bonus_ranged_damage', name: 'Bonus Ranged Damage', category: 'combat',
    description: 'You know just where to hit. Every bullet that successfully hits does +2 damage for each rank.',
    minLevel: 6, maxRanks: 2, minAGI: 6, minLCK: 6,
    requirements: { level: 6, stats: { agility: 6, luck: 6 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: { rangedDamageBonus: 2, combatNote: '+2 ranged damage per rank' },
  },
  {
    id: 'bonus_rate_of_fire', name: 'Bonus Rate of Fire', category: 'combat',
    description: 'Your trigger finger is faster than normal. Each ranged weapon attack costs one less AP to perform.',
    minLevel: 15, maxRanks: 1, minPER: 6, minAGI: 7, minINT: 6,
    requirements: { level: 15, stats: { agility: 7, intelligence: 6, perception: 6 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: { attackAPDiscount: 1, combatNote: 'Ranged attacks −1 AP' },
  },
  {
    id: 'bracing', name: 'Bracing', category: 'combat',
    description: 'You can brace large weapons while standing, gaining a tripod bonus just by holding the weapon in your hands.',
    minLevel: 4, maxRanks: 1, minSTR: 7, minSkill: { skill: 'bigGuns', value: 80 },
    requirements: { level: 4, stats: { strength: 7 }, skills: { bigGuns: 80 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: { combatNote: 'Tripod to-hit bonus with big guns while standing' },
  },
  {
    id: 'break_the_rules', name: 'Break the Rules', category: 'utility',
    description: 'When you choose this perk, you may choose any perk next time, regardless of requirements or race.',
    minLevel: 20, maxRanks: 1, minLCK: 6,
    requirements: { level: 20, stats: { luck: 6 } },
    combatEffect: null,
  },
  {
    id: 'brown_noser', name: 'Brown Noser', category: 'social',
    description: 'You have learned to suck up to your superiors. +1 Charisma for reaction rolls when dealing with authority figures, per rank.',
    minLevel: 2, maxRanks: 2, minCHA: 5, minINT: 6,
    requirements: { level: 2, stats: { charisma: 5, intelligence: 6 } },
    excludedRaces: ['dog', 'deathclaw'],
    combatEffect: null,
  },
  {
    id: 'brutish_hulk', name: 'Brutish Hulk', category: 'racial',
    description: 'You gain double the normal hit points when you go up a level. Only Deathclaws can choose this perk.',
    minLevel: 8, maxRanks: 1, minSTR: 7, minEND: 5,
    requiresRace: ['deathclaw'],
    requirements: { level: 8, stats: { strength: 7, endurance: 5 } },
    combatEffect: { combatNote: 'Double HP gained per level' },
  },
  {
    id: 'cancerous_growth', name: 'Cancerous Growth', category: 'racial',
    description: 'Radiation has mutated you so badly that you thrive in the wastes. +2 Healing Rate, and you can regenerate a crippled limb in 48 hours. Only Ghouls can choose this perk.',
    minLevel: 6, maxRanks: 1,
    requiresRace: ['ghoul'],
    requirements: { level: 6, stats: { strength: 6 } },
    combatEffect: { combatNote: '+2 Healing Rate; regenerate crippled limb in 48h' },
  },
  {
    id: 'cautious_nature', name: 'Cautious Nature', category: 'defense',
    description: 'You have learned to be wary. +3 Perception when determining where you begin in random encounters.',
    minLevel: 3, maxRanks: 1, minPER: 6,
    requirements: { level: 3, stats: { perception: 6 } },
    combatEffect: null,
  },
  {
    id: 'comprehension', name: 'Comprehension', category: 'utility',
    description: 'You gain 50% more skill points when reading educational books. Books that normally give 10 skill points now give 15. Dogs cannot choose this perk.',
    minLevel: 3, maxRanks: 1, minINT: 6,
    requirements: { level: 3, stats: { intelligence: 6 } },
    excludedRaces: ['dog'],
    combatEffect: null,
  },
  {
    id: 'crazy_bomber', name: 'Crazy Bomber', category: 'utility',
    description: 'Your luck with explosives is legendary. If you fail to set an explosive properly you know immediately, and it will not detonate — it is reset so you can try again. Dogs and Deathclaws cannot choose this perk.',
    minLevel: 9, maxRanks: 1, minINT: 6, minSkill: { skill: 'traps', value: 60 },
    requirements: { level: 9, stats: { intelligence: 6 }, skills: { traps: 60 } },
    excludedRaces: ['dog', 'deathclaw'],
    combatEffect: null,
  },
  {
    id: 'cult_of_personality', name: 'Cult of Personality', category: 'social',
    description: 'Everybody likes you. Instead of a negative karma reaction modifier, you get a positive one. Bad people like good characters and good people like bad characters.',
    minLevel: 12, maxRanks: 1, minCHA: 10,
    requirements: { level: 12, stats: { charisma: 10 } },
    combatEffect: null,
  },
  {
    id: 'death_sense', name: 'Death Sense', category: 'racial',
    description: 'Your senses are very well developed. +2 Perception in the dark, light-level penalties reduced by 50%, and +25% to detecting sneaking enemies. Only Deathclaws can choose this perk.',
    minLevel: 4, maxRanks: 1, minINT: 5,
    requiresRace: ['deathclaw'],
    requirements: { level: 4, stats: { intelligence: 5 } },
    combatEffect: { combatNote: '+2 PER in dark; −50% light penalties; +25% detect sneakers' },
  },
  {
    id: 'demolition_expert', name: 'Demolition Expert', category: 'combat',
    description: 'You handle explosives like a pro. Explosives you set do 50% more damage and always detonate on time. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 9, maxRanks: 1, minAGI: 4, minSkill: { skill: 'traps', value: 90 },
    requirements: { level: 9, stats: { agility: 4 }, skills: { traps: 90 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: { combatNote: 'Set explosives do +50% damage; always detonate on time' },
  },
  {
    id: 'die_hard', name: 'Die Hard', category: 'defense',
    description: 'You will not go down without a fight! When your HP drop below 20% of maximum, you gain +10% Damage Resistance to all types of damage.',
    minLevel: 2, maxRanks: 1, minEND: 6, minSkill: { skill: 'firstAid', value: 40 },
    requirements: { level: 2, stats: { endurance: 6 }, skills: { firstAid: 40 } },
    combatEffect: { combatNote: '+10% DR (all types) when HP < 20%' },
  },
  {
    id: 'divine_favor', name: 'Divine Favor', category: 'utility',
    description: 'A higher power has taken a liking to you. Any failed roll may be re-rolled (you must accept the re-roll). Usable once per 24-hour period.',
    minLevel: 14, maxRanks: 1, minCHA: 8,
    requirements: { level: 14, stats: { charisma: 8 } },
    combatEffect: null,
  },
  {
    id: 'dodger', name: 'Dodger', category: 'defense',
    description: 'You have developed into a slippery little rat. Armor Class increases by +5 for each rank.',
    minLevel: 9, maxRanks: 2, minAGI: 6,
    requirements: { level: 9, stats: { agility: 6 } },
    combatEffect: { armorClassBonus: 5, combatNote: '+5 AC per rank' },
  },
  {
    id: 'driving_city_style', name: 'Driving, City Style', category: 'utility',
    description: 'You picked up aggressive driving techniques. One-time +30% to Pilot, and any stat rolls made while driving get a +2 bonus. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 9, maxRanks: 1, minPER: 6, minAGI: 5,
    requirements: { level: 9, stats: { perception: 6, agility: 5 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'drunken_master', name: 'Drunken Master', category: 'combat',
    description: 'As a "child of the bottle," you fight better when drunk. +20% to Unarmed skill while under the influence of alcohol.',
    minLevel: 3, maxRanks: 1, minSkill: { skill: 'unarmed', value: 60 },
    requirements: { level: 3, skills: { unarmed: 60 } },
    combatEffect: { combatNote: '+20% Unarmed while drunk' },
  },
  {
    id: 'earlier_sequence', name: 'Earlier Sequence', category: 'combat',
    description: 'You are more likely to move before others in combat. +2 Sequence per rank.',
    minLevel: 3, maxRanks: 3, minPER: 6,
    requirements: { level: 3, stats: { perception: 6 } },
    combatEffect: { sequenceBonus: 2, combatNote: '+2 Sequence per rank' },
  },
  {
    id: 'educated', name: 'Educated', category: 'utility',
    description: 'Every rank adds +2 skill points when you gain a level.',
    minLevel: 6, maxRanks: 3, minINT: 6,
    requirements: { level: 6, stats: { intelligence: 6 } },
    combatEffect: null,
  },
  {
    id: 'empathy', name: 'Empathy', category: 'social',
    description: 'You get a better idea of what to say to an NPC. The GM must warn you when dialogue will be interpreted the wrong way.',
    minLevel: 6, maxRanks: 1, minPER: 7, minINT: 5,
    requirements: { level: 6, stats: { perception: 7, intelligence: 5 } },
    combatEffect: null,
  },
  {
    id: 'explorer', name: 'Explorer', category: 'utility',
    description: 'You are more likely to find strange and interesting encounters and items. It is up to the GM to decide what those are.',
    minLevel: 9, maxRanks: 1,
    requirements: { level: 9 },
    combatEffect: null,
  },
  {
    id: 'faster_healing', name: 'Faster Healing', category: 'defense',
    description: 'You just plain heal faster. For each rank, +2 to the Healing Rate statistic.',
    minLevel: 3, maxRanks: 3, minEND: 6,
    requirements: { level: 3, stats: { endurance: 6 } },
    combatEffect: { combatNote: '+2 Healing Rate per rank' },
  },
  {
    id: 'flexible', name: 'Flexible', category: 'combat',
    description: 'Years of exercise have made you supple. It only takes 1 AP to change your stance in combat.',
    minLevel: 4, maxRanks: 1, minAGI: 6, minSkill: { skill: 'sneak', value: 60 },
    requirements: { level: 4, stats: { agility: 6 }, skills: { sneak: 60 } },
    combatEffect: { combatNote: 'Change stance for 1 AP' },
  },
  {
    id: 'flower_child', name: 'Flower Child', category: 'utility',
    description: 'You are 50% less likely to be addicted to chems and suffer half the normal withdrawal time.',
    minLevel: 9, maxRanks: 1, minEND: 5,
    requirements: { level: 9, stats: { endurance: 5 } },
    combatEffect: null,
  },
  {
    id: 'fortune_finder', name: 'Fortune Finder', category: 'utility',
    description: 'Random encounters yield more money — off the cold, dead bodies of your opponents. How much is up to the GM.',
    minLevel: 6, maxRanks: 1, minLCK: 8,
    requirements: { level: 6, stats: { luck: 8 } },
    combatEffect: null,
  },
  {
    id: 'gain_agility', name: 'Gain Agility', category: 'utility',
    description: 'Increases your Agility by +1 permanently.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'gain_charisma', name: 'Gain Charisma', category: 'utility',
    description: 'Increases your Charisma by +1 permanently.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'gain_endurance', name: 'Gain Endurance', category: 'utility',
    description: 'Increases your Endurance by +1 permanently.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'gain_intelligence', name: 'Gain Intelligence', category: 'utility',
    description: 'Increases your Intelligence by +1 permanently.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'gain_luck', name: 'Gain Luck', category: 'utility',
    description: 'Increases your Luck by +1 permanently.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'gain_perception', name: 'Gain Perception', category: 'utility',
    description: 'Increases your Perception by +1 permanently.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'gain_strength', name: 'Gain Strength', category: 'utility',
    description: 'Increases your Strength by +1 permanently.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'gambler', name: 'Gambler', category: 'utility',
    description: 'A one-time +20% to the Gambling skill.',
    minLevel: 6, maxRanks: 1, minSkill: { skill: 'gambling', value: 50 },
    requirements: { level: 6, skills: { gambling: 50 } },
    combatEffect: null,
  },
  {
    id: 'ghost', name: 'Ghost', category: 'utility',
    description: 'In areas of darkness, or at night, you gain +20% to your Sneak skill.',
    minLevel: 6, maxRanks: 1, minSkill: { skill: 'sneak', value: 60 },
    requirements: { level: 6, skills: { sneak: 60 } },
    combatEffect: null,
  },
  {
    id: 'gunner', name: 'Gunner', category: 'combat',
    description: 'You are an expert at firing from a moving vehicle. You do not suffer the normal 10% penalty when firing from a vehicle in motion.',
    minLevel: 3, maxRanks: 1, minAGI: 6, minSkill: { skill: 'smallGuns', value: 40 },
    requirements: { level: 3, stats: { agility: 6 }, skills: { smallGuns: 40 } },
    combatEffect: { combatNote: 'No penalty firing from a moving vehicle' },
  },
  {
    id: 'harmless', name: 'Harmless', category: 'utility',
    description: 'Your innocent demeanor makes stealing easier. +20% bonus to Steal. Deathclaws cannot choose this perk.',
    minLevel: 6, maxRanks: 1, minSkill: { skill: 'steal', value: 50 },
    requirements: { level: 6, skills: { steal: 50 } },
    excludedRaces: ['deathclaw'],
    combatEffect: null,
  },
  {
    id: 'healer', name: 'Healer', category: 'defense',
    description: 'Each rank increases the Hit Points healed by First Aid or Doctor by 4-10 (1d6+4). The second rank adds +8-20 (2 × (1d6+4)).',
    minLevel: 3, maxRanks: 2, minPER: 7, minINT: 5, minAGI: 6, minSkill: { skill: 'firstAid', value: 40 },
    requirements: { level: 3, stats: { perception: 7, agility: 6, intelligence: 5 }, skills: { firstAid: 40 } },
    combatEffect: null,
  },
  {
    id: 'heave_ho', name: 'Heave Ho!', category: 'combat',
    description: 'For determining the maximum range of thrown weapons only, this perk increases Strength by +2 for each rank.',
    minLevel: 6, maxRanks: 3,
    requirements: { level: 6 },
    combatEffect: { combatNote: '+2 effective STR for thrown-weapon range per rank' },
  },
  {
    id: 'here_and_now', name: 'Here and Now', category: 'utility',
    description: 'You immediately gain enough experience points to go up to the next level.',
    minLevel: 9, maxRanks: 1,
    requirements: { level: 9 },
    combatEffect: null,
  },
  {
    id: 'hide_of_scars', name: 'Hide of Scars', category: 'racial',
    description: 'Your battle-weary flesh has hardened into armor. +15% to all resistances except fire. Only Deathclaws can choose this perk.',
    minLevel: 10, maxRanks: 2, minEND: 6,
    requiresRace: ['deathclaw'],
    requirements: { level: 10, stats: { endurance: 6 } },
    combatEffect: { combatNote: '+15% to all resistances except fire, per rank' },
  },
  {
    id: 'hit_the_deck', name: 'Hit the Deck!', category: 'defense',
    description: 'You react quickly to incoming explosives. You take only half damage from ranged explosive weapons (Explosive DR +50%), including concussion and shrapnel.',
    minLevel: 4, maxRanks: 1, minAGI: 6,
    requirements: { level: 4, stats: { agility: 6 } },
    combatEffect: { combatNote: '+50% Explosive DR vs ranged explosives' },
  },
  {
    id: 'hth_evade', name: 'HtH Evade', category: 'combat',
    description: 'If you carry no weapons in either hand, at the end of a combat turn you gain 3 points of AC (instead of the normal 1) for each unused Action Point.',
    minLevel: 12, maxRanks: 1, minSkill: { skill: 'unarmed', value: 75 },
    requirements: { level: 12, skills: { unarmed: 75 } },
    combatEffect: { combatNote: '+3 AC per unused AP when unarmed' },
  },
  {
    id: 'kama_sutra_master', name: 'Kama Sutra Master', category: 'utility',
    description: 'This perk confers great stamina and skill when doing the dirty.',
    minLevel: 3, maxRanks: 1, minEND: 5, minAGI: 5,
    requirements: { level: 3, stats: { endurance: 5, agility: 5 } },
    combatEffect: null,
  },
  {
    id: 'karma_beacon', name: 'Karma Beacon', category: 'social',
    description: 'Your Karma ran over someone\'s Dogma. Karma is doubled for the purposes of reaction.',
    minLevel: 9, maxRanks: 1, minCHA: 6,
    requirements: { level: 9, stats: { charisma: 6 } },
    combatEffect: null,
  },
  {
    id: 'leadfoot', name: 'Leadfoot', category: 'utility',
    description: 'Your reflexes make you a very fast (if not safer) driver. You can make a vehicle go 25% faster than its maximum speed.',
    minLevel: 3, maxRanks: 1, minPER: 6, minAGI: 6, minSkill: { skill: 'pilot', value: 60 },
    requirements: { level: 3, stats: { perception: 6, agility: 6 }, skills: { pilot: 60 } },
    combatEffect: null,
  },
  {
    id: 'leader', name: 'Leader', category: 'social',
    description: 'Any party member within 10 hexes of you gains +1 Agility (up to racial max) and +5 Armor Class. You do not get these benefits — the price of being a leader.',
    minLevel: 4, maxRanks: 1, minCHA: 6,
    requirements: { level: 4, stats: { charisma: 6 } },
    combatEffect: { combatNote: '+1 AGI, +5 AC to nearby allies (not self)' },
  },
  {
    id: 'lifegiver', name: 'Lifegiver', category: 'defense',
    description: 'Every time you gain a level, you gain an additional 4 HP for each rank of this perk. With two ranks, that\'s +8 HP per level!',
    minLevel: 12, maxRanks: 2, minEND: 4,
    requirements: { level: 12, stats: { endurance: 4 } },
    combatEffect: { extraMaxHP: 4, combatNote: '+4 max HP per level, per rank' },
  },
  {
    id: 'light_step', name: 'Light Step', category: 'defense',
    description: 'You are much less likely to set off traps. For triggering a trap, you gain a +4 bonus to Agility.',
    minLevel: 9, maxRanks: 1, minAGI: 5, minLCK: 5,
    requirements: { level: 9, stats: { agility: 5, luck: 5 } },
    combatEffect: null,
  },
  {
    id: 'living_anatomy', name: 'Living Anatomy', category: 'combat',
    description: '+10% bonus to Doctor. Your knowledge of anatomy means you do +5 points of damage with every attack against living creatures.',
    minLevel: 12, maxRanks: 1, minSkill: { skill: 'doctor', value: 60 },
    requirements: { level: 12, skills: { doctor: 60 } },
    combatEffect: { damageBonus: 5, combatNote: '+5 damage vs living targets; +10% Doctor' },
  },
  {
    id: 'loner', name: 'Loner', category: 'utility',
    description: 'You use your differences to your advantage. +10% to all skill rolls when at least 10 hexes away from all other party members.',
    minLevel: 4, maxRanks: 1, minSkill: { skill: 'outdoorsman', value: 50 },
    requirements: { level: 4, skills: { outdoorsman: 50 } },
    combatEffect: null,
  },
  {
    id: 'master_thief', name: 'Master Thief', category: 'utility',
    description: 'A one-time bonus of 15 points to both Lockpick and Steal. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 12, maxRanks: 1, minSkill: { skill: 'lockpick', value: 50 },
    requirements: { level: 12, skills: { lockpick: 50, steal: 50 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'master_trader', name: 'Master Trader', category: 'social',
    description: 'A one-time 30% bonus to your Barter skill. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 9, maxRanks: 1, minCHA: 7, minSkill: { skill: 'barter', value: 60 },
    requirements: { level: 9, stats: { charisma: 7 }, skills: { barter: 60 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'medic', name: 'Medic', category: 'utility',
    description: 'A one-time bonus of 10% to First Aid and Doctor.',
    minLevel: 12, maxRanks: 1, minSkill: { skill: 'firstAid', value: 40 },
    requirements: { level: 12, skills: { firstAid: 40, doctor: 40 }, skillsAny: true },
    combatEffect: null,
  },
  {
    id: 'mental_block', name: 'Mental Block', category: 'utility',
    description: 'You can tune out outside mental interference. For determining range in combat AND finding traps ONLY, your Perception is raised by 1 (up to racial maximum).',
    minLevel: 15, maxRanks: 1,
    requirements: { level: 15 },
    combatEffect: { combatNote: '+1 PER for range and trap detection' },
  },
  {
    id: 'more_criticals', name: 'More Criticals', category: 'combat',
    description: 'You cause more critical hits in combat. Each rank adds +5% to the Critical Chance statistic. Mutants cannot choose this perk.',
    minLevel: 6, maxRanks: 3, minLCK: 6,
    requirements: { level: 6, stats: { luck: 6 } },
    excludedRaces: ['superMutant'],
    combatEffect: { critChanceBonus: 5, combatNote: '+5% critical chance per rank' },
  },
  {
    id: 'mr_fixit', name: 'Mr. (or Ms.) Fixit', category: 'utility',
    description: 'A one-time bonus of 10% to both Repair and Science. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 12, maxRanks: 1, minSkill: { skill: 'repair', value: 40 },
    requirements: { level: 12, skills: { repair: 40, science: 40 }, skillsAny: true },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'mutate', name: 'Mutate!', category: 'utility',
    description: 'You select one of your current Traits to remove, then get to pick another Trait. Weird, eh?',
    minLevel: 9, maxRanks: 1,
    requirements: { level: 9 },
    combatEffect: null,
  },
  {
    id: 'mysterious_stranger', name: 'Mysterious Stranger', category: 'utility',
    description: 'There is a chance (30% + (2 × LK)) that you gain a temporary ally, but only in random encounters. The GM chooses that ally.',
    minLevel: 9, maxRanks: 1, minLCK: 4,
    requirements: { level: 9, stats: { luck: 4 } },
    combatEffect: null,
  },
  {
    id: 'negotiator', name: 'Negotiator', category: 'social',
    description: 'A one-time bonus of 10% to Speech and Barter. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 6, maxRanks: 1, minSkill: { skill: 'barter', value: 50 },
    requirements: { level: 6, skills: { barter: 50, speech: 50 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'night_vision', name: 'Night Vision', category: 'utility',
    description: 'You can see better in darkness. Negative modifiers for dark conditions are reduced by 50%.',
    minLevel: 3, maxRanks: 1, minPER: 6,
    requirements: { level: 3, stats: { perception: 6 } },
    combatEffect: { combatNote: '−50% dark-condition penalties' },
  },
  {
    id: 'pack_rat', name: 'Pack Rat', category: 'utility',
    description: 'Each rank adds +10 lbs. to your Carry Weight statistic.',
    minLevel: 6, maxRanks: 2,
    requirements: { level: 6 },
    combatEffect: null,
  },
  {
    id: 'pathfinder', name: 'Pathfinder', category: 'survival',
    description: 'Reduces travel time by 25%. You have a knack for finding old trails and roads.',
    minLevel: 6, maxRanks: 1, minEND: 6, minSkill: { skill: 'outdoorsman', value: 60 },
    requirements: { level: 6, stats: { endurance: 6 }, skills: { outdoorsman: 60 } },
    combatEffect: null,
  },
  {
    id: 'pickpocket', name: 'Pickpocket', category: 'utility',
    description: '+25% bonus to Steal for stealing from other characters or NPCs. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 15, maxRanks: 1, minAGI: 8, minSkill: { skill: 'steal', value: 80 },
    requirements: { level: 15, stats: { agility: 8 }, skills: { steal: 80 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'presence', name: 'Presence', category: 'social',
    description: 'You gain a +1 bonus to your Charisma for reaction rolls for each rank of this perk.',
    minLevel: 6, maxRanks: 3, minCHA: 6,
    requirements: { level: 6, stats: { charisma: 6 } },
    combatEffect: null,
  },
  {
    id: 'psychotic', name: 'Psychotic', category: 'racial',
    description: 'Your body has adapted to Psycho. Positive effects of Psycho are doubled and its addiction rate is halved. Only mutants and half-mutants can choose this perk.',
    minLevel: 8, maxRanks: 1, minEND: 5,
    requiresRace: ['superMutant', 'halfMutant'],
    requirements: { level: 8, stats: { endurance: 5 } },
    combatEffect: null,
  },
  {
    id: 'pyromaniac', name: 'Pyromaniac', category: 'combat',
    description: 'You do horrible things with fire. +5 points of damage with fire-based weapons such as flamethrowers, molotov cocktails, and napalm.',
    minLevel: 9, maxRanks: 1, minSkill: { skill: 'bigGuns', value: 75 },
    requirements: { level: 9, skills: { bigGuns: 75 } },
    combatEffect: { fireWeaponDamageBonus: 5, combatNote: '+5 fire weapon damage' },
  },
  {
    id: 'quick_pockets', name: 'Quick Pockets', category: 'utility',
    description: 'It only takes two action points instead of four to swap equipment in combat.',
    minLevel: 3, maxRanks: 1, minAGI: 5,
    requirements: { level: 3, stats: { agility: 5 } },
    combatEffect: { combatNote: 'Inventory access: 4 AP → 2 AP' },
  },
  {
    id: 'quick_recovery', name: 'Quick Recovery', category: 'combat',
    description: 'It only costs you one AP to stand up after being knocked down.',
    minLevel: 6, maxRanks: 1, minAGI: 5,
    requirements: { level: 6, stats: { agility: 5 } },
    combatEffect: { combatNote: 'Stand up for 1 AP' },
  },
  {
    id: 'rad_child', name: 'Rad Child', category: 'racial',
    description: 'You take no damage from radiation — it heals you. You gain +5 Healing Rate when in a source of radiation giving out 10 or more rads an hour. Only Ghouls can choose this perk.',
    minLevel: 3, maxRanks: 1, minEND: 6,
    requiresRace: ['ghoul'],
    requirements: { level: 3, stats: { endurance: 6 } },
    combatEffect: { combatNote: '+5 Healing Rate in radiation; radiation heals you' },
  },
  {
    id: 'rad_resistance', name: 'Rad Resistance', category: 'defense',
    description: 'Each rank increases your Radiation Resistance by 15%.',
    minLevel: 6, maxRanks: 2, minEND: 6, minINT: 4,
    requirements: { level: 6, stats: { endurance: 6, intelligence: 4 } },
    combatEffect: null,
  },
  {
    id: 'ranger', name: 'Ranger', category: 'survival',
    description: '+15% to Outdoorsman. Also makes finding special encounters and items a little easier.',
    minLevel: 6, maxRanks: 1, minPER: 6,
    requirements: { level: 6, stats: { perception: 6 } },
    combatEffect: null,
  },
  {
    id: 'road_warrior', name: 'Road Warrior', category: 'combat',
    description: 'You have learned to drive and shoot at the same time. You suffer no penalties when driving vehicles and making attacks simultaneously. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 12, maxRanks: 1, minINT: 6, minSkill: { skill: 'pilot', value: 60 },
    requirements: { level: 12, stats: { intelligence: 6 }, skills: { pilot: 60 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: { combatNote: 'No penalty driving and attacking at once' },
  },
  {
    id: 'salesman', name: 'Salesman', category: 'social',
    description: '+20% to the Barter skill. Deathclaws and Dogs cannot be salesmen.',
    minLevel: 6, maxRanks: 1, minSkill: { skill: 'barter', value: 50 },
    requirements: { level: 6, skills: { barter: 50 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'scout', name: 'Scout', category: 'utility',
    description: 'You can see further in the wilderness and maps are easier to read. Special encounters and items are a little easier to find.',
    minLevel: 3, maxRanks: 1, minPER: 7,
    requirements: { level: 3, stats: { perception: 7 } },
    combatEffect: null,
  },
  {
    id: 'scrounger', name: 'Scrounger', category: 'survival',
    description: 'You can find more ammo than the normal post-nuclear survivor. You always find double the normal ammunition in random encounters.',
    minLevel: 9, maxRanks: 1, minLCK: 8,
    requirements: { level: 9, stats: { luck: 8 } },
    combatEffect: null,
  },
  {
    id: 'sharpshooter', name: 'Sharpshooter', category: 'combat',
    description: 'With each rank, Perception increases by +2 for determining range modifiers in combat.',
    minLevel: 9, maxRanks: 1, minPER: 7, minINT: 6,
    requirements: { level: 9, stats: { perception: 7, intelligence: 6 } },
    combatEffect: { combatNote: '+2 effective PER for range per rank' },
  },
  {
    id: 'silent_death', name: 'Silent Death', category: 'combat',
    description: 'While sneaking successfully, you do double damage using HtH or melee attacks if you hit your opponent in the back (backstab!).',
    minLevel: 18, maxRanks: 1, minAGI: 10, minSkill: { skill: 'sneak', value: 80 },
    requirements: { level: 18, stats: { agility: 10 }, skills: { sneak: 80, unarmed: 80 } },
    combatEffect: { combatNote: 'Double HtH/melee damage on backstab while sneaking' },
  },
  {
    id: 'silent_running', name: 'Silent Running', category: 'defense',
    description: 'This perk allows you to run and sneak at the same time.',
    minLevel: 6, maxRanks: 1, minAGI: 6, minSkill: { skill: 'sneak', value: 50 },
    requirements: { level: 6, stats: { agility: 6 }, skills: { sneak: 50 } },
    combatEffect: null,
  },
  {
    id: 'slayer', name: 'Slayer', category: 'combat',
    description: 'The slayer walks the earth! In HtH or melee combat, you do a critical hit with a successful roll against Luck.',
    minLevel: 24, maxRanks: 1, minSTR: 8, minAGI: 8, minSkill: { skill: 'unarmed', value: 80 },
    requirements: { level: 24, stats: { strength: 8, agility: 8 }, skills: { unarmed: 80 } },
    combatEffect: { allHitsAreCrits: true, combatNote: 'HtH/melee crit on successful Luck roll' },
  },
  {
    id: 'smooth_talker', name: 'Smooth Talker', category: 'social',
    description: 'Each rank increases your Intelligence by +1 for rolls against that Stat when attempting to smooth-talk NPCs. Dogs cannot choose this perk (dogs cannot talk).',
    minLevel: 3, maxRanks: 3, minINT: 4,
    requirements: { level: 3, stats: { intelligence: 4 } },
    excludedRaces: ['dog'],
    combatEffect: null,
  },
  {
    id: 'snakeater', name: 'Snakeater', category: 'survival',
    description: 'This perk adds +25% to Poison Resistance.',
    minLevel: 6, maxRanks: 1, minEND: 3,
    requirements: { level: 6, stats: { endurance: 3 } },
    combatEffect: { combatNote: '+25% Poison Resistance' },
  },
  {
    id: 'sniper', name: 'Sniper', category: 'combat',
    description: 'When using a ranged weapon, you do a critical hit with a successful roll against Luck and this perk. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 24, maxRanks: 1, minPER: 8, minAGI: 8, minSkill: { skill: 'smallGuns', value: 80 },
    requirements: { level: 24, stats: { agility: 8, perception: 8 }, skills: { smallGuns: 80 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: { allHitsAreCrits: true, combatNote: 'Ranged crit on successful Luck roll' },
  },
  {
    id: 'speaker', name: 'Speaker', category: 'social',
    description: 'A one-time bonus of 20% to the Speech skill. Deathclaws and Dogs cannot choose this perk.',
    minLevel: 9, maxRanks: 1, minSkill: { skill: 'speech', value: 50 },
    requirements: { level: 9, skills: { speech: 50 } },
    excludedRaces: ['deathclaw', 'dog'],
    combatEffect: null,
  },
  {
    id: 'stat', name: 'Stat!', category: 'defense',
    description: 'You can heal people much faster in combat. When helping a fallen comrade, it only takes 5 APs to use your skill.',
    minLevel: 3, maxRanks: 1, minAGI: 6, minSkill: { skill: 'firstAid', value: 75 },
    requirements: { level: 3, stats: { agility: 6 }, skills: { firstAid: 75, doctor: 50 } },
    combatEffect: { combatNote: 'Heal a fallen comrade for 5 AP' },
  },
  {
    id: 'steady_arm', name: 'Steady Arm', category: 'racial',
    description: 'Due to your massive size, burst attacks cost 1 less AP. Only mutants can choose this perk.',
    minLevel: 4, maxRanks: 1, minSTR: 6,
    requiresRace: ['superMutant'],
    requirements: { level: 4, stats: { strength: 6 } },
    combatEffect: { combatNote: 'Burst attacks −1 AP' },
  },
  {
    id: 'stonewall', name: 'Stonewall', category: 'defense',
    description: 'If you are about to be knocked down in combat, you may roll percentile dice for a 50% chance to avoid that fate.',
    minLevel: 3, maxRanks: 1, minSTR: 6,
    requirements: { level: 3, stats: { strength: 6 } },
    combatEffect: { combatNote: '50% chance to avoid knockdown' },
  },
  {
    id: 'strong_back', name: 'Strong Back', category: 'utility',
    description: 'Each rank increases Carry Weight by 50 lbs.',
    minLevel: 3, maxRanks: 2, minSTR: 6, minEND: 6,
    requirements: { level: 3, stats: { strength: 6, endurance: 6 } },
    combatEffect: null,
  },
  {
    id: 'stunt_devil', name: 'Stunt Devil', category: 'utility',
    description: 'You know how to bounce when you hit the ground! You take 25% less damage from falling and vehicle wrecks, and get a 10% bonus to Pilot. (No stunt dogs in the Fallout universe.)',
    minLevel: 6, maxRanks: 2, minSTR: 6, minEND: 6, minAGI: 6,
    requirements: { level: 6, stats: { strength: 6, endurance: 6, agility: 6 } },
    excludedRaces: ['dog'],
    combatEffect: null,
  },
  {
    id: 'survivalist', name: 'Survivalist', category: 'survival',
    description: 'Gain a +25% bonus to the Outdoorsman skill.',
    minLevel: 3, maxRanks: 3, minEND: 6, minINT: 6, minSkill: { skill: 'outdoorsman', value: 40 },
    requirements: { level: 3, stats: { endurance: 6, intelligence: 6 }, skills: { outdoorsman: 40 } },
    combatEffect: null,
  },
  {
    id: 'swift_learner', name: 'Swift Learner', category: 'utility',
    description: 'Each rank adds an additional 5% (round up) to the experience points you earn.',
    minLevel: 3, maxRanks: 3, minINT: 4,
    requirements: { level: 3, stats: { intelligence: 4 } },
    combatEffect: null,
  },
  {
    id: 'tag', name: 'Tag!', category: 'utility',
    description: 'Pick an additional Tag Skill.',
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'talon_of_fear', name: 'Talon of Fear', category: 'racial',
    description: 'Venom has seeped into your claws. All of your unarmed attacks carry a Type B poison. Only Deathclaws can choose this perk.',
    minLevel: 12, maxRanks: 1, minSTR: 6, minSkill: { skill: 'unarmed', value: 60 },
    requiresRace: ['deathclaw'],
    requirements: { level: 12, stats: { strength: 6 }, skills: { unarmed: 60 } },
    combatEffect: { combatNote: 'Unarmed attacks carry Type B poison' },
  },
  {
    id: 'team_player', name: 'Team Player', category: 'social',
    description: 'Whenever all party members are within 10 hexes of you, you gain +10% to all skills.',
    minLevel: 12, maxRanks: 1, minCHA: 4,
    requirements: { level: 12, stats: { charisma: 4 } },
    combatEffect: null,
  },
  {
    id: 'thief', name: 'Thief', category: 'utility',
    description: 'A one-time bonus of +10% to Sneak, Lockpick, Steal, and Traps. Dogs and Deathclaws cannot choose this perk.',
    minLevel: 3, maxRanks: 1,
    requirements: { level: 3 },
    excludedRaces: ['dog', 'deathclaw'],
    combatEffect: null,
  },
  {
    id: 'tough_hide', name: 'Tough Hide', category: 'racial',
    description: 'Exposure to radiation and the harsh wastes has hardened you. +15 to your Armor Class and +10% to all resistances. Only mutants can choose this perk.',
    minLevel: 12, maxRanks: 2, minEND: 1,
    requiresRace: ['superMutant'],
    requirements: { level: 12 },
    combatEffect: { armorClassBonus: 15, combatNote: '+15 AC, +10% all resistances per rank' },
  },
  {
    id: 'toughness', name: 'Toughness', category: 'defense',
    description: 'This perk confers a +10% to Damage Resistance to all types of damage.',
    minLevel: 3, maxRanks: 1, minEND: 6, minLCK: 6,
    requirements: { level: 3, stats: { endurance: 6, luck: 6 } },
    combatEffect: { damageResistBonus: 10, combatNote: '+10% all DR' },
  },
  {
    id: 'awareness', name: 'Awareness', category: 'utility',
    description: 'You know exactly what is going on in combat. When you examine a critter you can see their exact number of hit points and the weapon they are armed with, if any.',
    minLevel: 3, maxRanks: 1, minPER: 5,
    requirements: { level: 3, stats: { perception: 5 } },
    combatEffect: null,
  },
  // ─── EXISTING PERKS PRESERVED FOR ID STABILITY (not in the manual perks
  //     chapter as-worded, or referenced by combat/UI code). ─────────────────
  {
    id: 'finesse', name: 'Finesse', category: 'combat',
    description: 'Your attacks show a lot of finesse. +10% crit chance, but −30% crit damage. (Note: in the Fallout PnP 2.0 manual, Finesse is a Trait — see data/traits.ts. Kept here for backward compatibility.)',
    minLevel: 9, maxRanks: 1,
    requirements: { level: 9 },
    combatEffect: { critChanceBonus: 10, critDamageMultiplier: 0.7, combatNote: '+10% crit, −30% crit damage' },
  },
  {
    id: 'gunslinger', name: 'Gunslinger', category: 'combat',
    description: 'Your skill with single-handed ranged weapons makes you deadly. One-handed ranged attacks are always critical hits.',
    minLevel: 12, maxRanks: 1, minAGI: 6,
    requirements: { level: 12, stats: { agility: 6 } },
    combatEffect: { allHitsAreCrits: true, combatNote: 'One-handed ranged always crit' },
  },
  {
    id: 'penetrate', name: 'Penetrate', category: 'combat',
    description: 'Your ranged attacks ignore up to 10 points of Damage Threshold per rank.',
    minLevel: 9, maxRanks: 2, minAGI: 7,
    requirements: { level: 9, stats: { agility: 7 } },
    combatEffect: { ignoreDT: 10, combatNote: 'Ignore up to 10 DT per rank (ranged)' },
  },
  {
    id: 'weapon_handling', name: 'Weapon Handling', category: 'combat',
    description: 'Your grip and weapon technique allows you to use bigger guns. Weapon STR requirement −2.',
    minLevel: 12, maxRanks: 1, minSTR: 5, minAGI: 5,
    requirements: { level: 12, stats: { strength: 5, agility: 5 } },
    combatEffect: { weaponStrReqReduction: 2, combatNote: 'Weapon STR req −2' },
  },
  {
    id: 'fast_metabolism', name: 'Fast Metabolism', category: 'defense',
    description: 'Your metabolic rate is faster. +2 Healing Rate. (Note: in the manual this is a Trait — see data/traits.ts. Kept here for backward compatibility.)',
    minLevel: 3, maxRanks: 1,
    requirements: { level: 3 },
    combatEffect: { combatNote: '+2 Healing Rate' },
  },
  {
    id: 'chem_resistant', name: 'Chem Resistant', category: 'utility',
    description: 'Chems only have a 50% chance of getting you addicted. (Note: in the manual this is a Trait — see data/traits.ts. Kept here for backward compatibility.)',
    minLevel: 9, maxRanks: 1, minEND: 6,
    requirements: { level: 9, stats: { endurance: 6 } },
    excludedRaces: ['robot'],
    combatEffect: null,
  },
  {
    id: 'natural_chem_resistant', name: 'Natural Chem Resistant', category: 'utility',
    description: 'You are naturally immune to addiction. Chems can never addict you.',
    minLevel: 12, maxRanks: 1, minEND: 8,
    requirements: { level: 12, stats: { endurance: 8 } },
    combatEffect: null,
  },
  {
    id: 'jack_of_all_trades', name: 'Jack of All Trades', category: 'utility',
    description: "You've always dabbled. +5 to all skills.",
    minLevel: 12, maxRanks: 1,
    requirements: { level: 12 },
    combatEffect: null,
  },
  {
    id: 'treasure_hunter', name: 'Treasure Hunter', category: 'utility',
    description: 'Your knack for finding loot improves the quality of random encounter finds.',
    minLevel: 12, maxRanks: 1, minLCK: 8,
    requirements: { level: 12, stats: { luck: 8 } },
    combatEffect: null,
  },
  {
    id: 'pilot', name: 'Pilot', category: 'utility',
    description: '+20% to Pilot skill checks. You can handle vehicles others cannot.',
    minLevel: 6, maxRanks: 2, minPER: 6, minAGI: 6,
    requirements: { level: 6, stats: { perception: 6, agility: 6 } },
    combatEffect: null,
  },
  // ─── RACIAL PERKS (existing, preserved for ID stability) ─────────────────
  {
    id: 'glowing_one', name: 'Glowing One', category: 'racial',
    description: 'Ghoul only. You emit radiation, damaging enemies and healing nearby ghouls.',
    minLevel: 6, maxRanks: 1,
    requiresRace: ['ghoul'],
    requirements: { level: 6 },
    combatEffect: { damageBonus: 2, combatNote: 'Emit radiation aura (heal allies, damage enemies)' },
  },
  {
    id: 'feral_reversion', name: 'Feral Reversion', category: 'racial',
    description: 'Ghoul only. Tap into your feral instincts for bonus melee damage and speed.',
    minLevel: 9, maxRanks: 1,
    requiresRace: ['ghoul'],
    requirements: { level: 9 },
    combatEffect: { meleeDamageBonus: 4, attackAPDiscount: 1, combatNote: '+4 melee dmg, −1 AP melee (feral mode)' },
  },
  {
    id: 'super_mutant_upgrade', name: 'Super Mutant Upgrade', category: 'racial',
    description: 'Super Mutant only. Further mutation grants +1 STR and +1 END.',
    minLevel: 6, maxRanks: 2,
    requiresRace: ['superMutant'],
    requirements: { level: 6 },
    combatEffect: { combatNote: '+1 STR, +1 END per rank' },
  },
  {
    id: 'cyborg_systems', name: 'Cyborg Systems', category: 'racial',
    description: 'Robot only. Upgrade your internal systems. +10% all DR, +5 AC.',
    minLevel: 6, maxRanks: 2,
    requiresRace: ['robot'],
    requirements: { level: 6 },
    combatEffect: { damageResistBonus: 10, armorClassBonus: 5, combatNote: '+10% DR, +5 AC per rank' },
  },
  {
    id: 'deathclaw_rampage', name: 'Deathclaw Rampage', category: 'racial',
    description: 'Deathclaw only. When wounded below 50% HP, claw damage increases by 50% and AC bonus activates.',
    minLevel: 3, maxRanks: 1,
    requiresRace: ['deathclaw'],
    requirements: { level: 3 },
    combatEffect: { meleeDamageBonus: 6, armorClassBonus: 5, combatNote: '+6 melee dmg, +5 AC when HP < 50%' },
  },
];

// ─── Lookup / helper functions (kept stable for combat + UI code) ────────────

export function getPerkById(id: string): Perk | undefined {
  return PERKS.find(p => p.id === id);
}

export function getPerksForRace(race: string): Perk[] {
  return PERKS.filter(p =>
    (!p.requiresRace || p.requiresRace.includes(race as RaceType)) &&
    (!p.excludedRaces || !p.excludedRaces.includes(race as RaceType)) &&
    !(ROBOTS_NO_PERKS && race === 'robot'),
  );
}

export function getCombatPerks(characterPerks: { perkId: string; rank: number }[]): Perk[] {
  return characterPerks
    .map(cp => getPerkById(cp.perkId))
    .filter((p): p is Perk => !!p && p.combatEffect !== null);
}

export function calcAvailablePerkPoints(level: number): number {
  return Math.floor(level / 3);
}

export function calcUsedPerkPoints(perks: { perkId: string; rank: number }[]): number {
  return perks.reduce((sum, cp) => sum + cp.rank, 0);
}

// Map SPECIAL keys to their legacy flat-field counterparts, so both the
// structured `requirements.stats` and legacy `minXXX` fields are honoured.
const SPECIAL_LABELS: Record<keyof SPECIALStats, string> = {
  strength: 'Strength', perception: 'Perception', endurance: 'Endurance',
  charisma: 'Charisma', intelligence: 'Intelligence', agility: 'Agility', luck: 'Luck',
};

const SKILL_LABELS_SHORT: Record<SkillType, string> = {
  smallGuns: 'Small Guns', bigGuns: 'Big Guns', energyWeapons: 'Energy Weapons',
  meleeWeapons: 'Melee Weapons', unarmed: 'Unarmed', throwing: 'Throwing',
  firstAid: 'First Aid', doctor: 'Doctor', sneak: 'Sneak', lockpick: 'Lockpick',
  steal: 'Steal', traps: 'Traps', science: 'Science', repair: 'Repair',
  speech: 'Speech', barter: 'Barter', gambling: 'Gambling', outdoorsman: 'Outdoorsman',
  pilot: 'Pilot',
};

// Perk requirements use permanent trait and Gain-X values. Temporary chem,
// condition, and Night Person modifiers cannot be used to qualify for a perk.
function effectiveRequirementValues(char: Character): {
  special: SPECIALStats;
  skills: Character['skills'];
} {
  const special = applyImmediateTraitSpecial(char.special, char.traits);
  const perkStats = computePerkStatBonuses(char);
  for (const key of Object.keys(special) as (keyof SPECIALStats)[]) {
    special[key] += perkStats[key] ?? 0;
  }
  const skills = calculateRebasedEffectiveSkills<Character['skills']>({
    savedSkills: char.skills,
    savedBaseSkills: calcBaseSkills(char.special),
    effectiveBaseSkills: calcBaseSkills(special),
    options: {
      traits: char.traits,
      taggedSkills: char.taggedSkills,
      includeTagBonus: true,
    },
  });
  return { special, skills };
}

/**
 * Determine whether a character can take (another rank of) a perk.
 * Enforces: robots-get-no-perks, race exclusion/restriction, level, SPECIAL
 * minimums, skill minimums (with tagged +20 applied), otherPerks, and max ranks.
 */
export function canTakePerk(
  char: Character,
  perk: Perk,
  currentRanks: number,
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const requirementValues = effectiveRequirementValues(char);

  // Robots never gain perks.
  if (ROBOTS_NO_PERKS && char.race === 'robot') {
    reasons.push('Robots never gain perks');
  }

  // Race restriction (perk is race-exclusive).
  if (perk.requiresRace && perk.requiresRace.length > 0 && !perk.requiresRace.includes(char.race)) {
    reasons.push(`Only available to: ${perk.requiresRace.join(', ')}`);
  }

  // Race exclusion.
  if (perk.excludedRaces && perk.excludedRaces.includes(char.race)) {
    reasons.push('Your race cannot choose this perk');
  }

  // Max ranks.
  const maxRanks = perk.maxRanks ?? 1;
  if (currentRanks >= maxRanks) {
    reasons.push(`Already at max ranks (${maxRanks})`);
  }

  // Level.
  const reqLevel = perk.requirements?.level ?? perk.minLevel ?? 1;
  if (char.level < reqLevel) {
    reasons.push(`Requires level ${reqLevel}`);
  }

  // SPECIAL minimums — merge structured stats with legacy flat fields.
  const stats: Partial<SPECIALStats> = { ...(perk.requirements?.stats ?? {}) };
  if (perk.minSTR !== undefined && stats.strength === undefined) stats.strength = perk.minSTR;
  if (perk.minPER !== undefined && stats.perception === undefined) stats.perception = perk.minPER;
  if (perk.minEND !== undefined && stats.endurance === undefined) stats.endurance = perk.minEND;
  if (perk.minCHA !== undefined && stats.charisma === undefined) stats.charisma = perk.minCHA;
  if (perk.minINT !== undefined && stats.intelligence === undefined) stats.intelligence = perk.minINT;
  if (perk.minAGI !== undefined && stats.agility === undefined) stats.agility = perk.minAGI;
  if (perk.minLCK !== undefined && stats.luck === undefined) stats.luck = perk.minLCK;

  (Object.keys(stats) as (keyof SPECIALStats)[]).forEach(key => {
    const req = stats[key];
    if (req !== undefined && requirementValues.special[key] < req) {
      reasons.push(`Requires ${SPECIAL_LABELS[key]} ${req}`);
    }
  });

  // Skill minimums (tagged +20 applied at check time).
  const skills: Partial<Record<SkillType, number>> = { ...(perk.requirements?.skills ?? {}) };
  // Fold legacy single-skill requirement in if not already present.
  if (perk.minSkill && skills[perk.minSkill.skill as SkillType] === undefined) {
    skills[perk.minSkill.skill as SkillType] = perk.minSkill.value;
  }
  const skillEntries = (Object.keys(skills) as SkillType[]).map(s => ({ skill: s, value: skills[s]! }));

  if (skillEntries.length > 0) {
    if (perk.requirements?.skillsAny) {
      const anyMet = skillEntries.some(e => requirementValues.skills[e.skill] >= e.value);
      if (!anyMet) {
        const label = skillEntries.map(e => `${SKILL_LABELS_SHORT[e.skill]} ${e.value}%`).join(' OR ');
        reasons.push(`Requires ${label}`);
      }
    } else {
      skillEntries.forEach(e => {
        if (requirementValues.skills[e.skill] < e.value) {
          reasons.push(`Requires ${SKILL_LABELS_SHORT[e.skill]} ${e.value}%`);
        }
      });
    }
  }

  // Required prerequisite perks.
  if (perk.requirements?.otherPerks && perk.requirements.otherPerks.length > 0) {
    const owned = new Set((char.perks ?? []).map(p => p.perkId));
    perk.requirements.otherPerks.forEach(pid => {
      if (!owned.has(pid)) {
        const req = getPerkById(pid);
        reasons.push(`Requires perk: ${req?.name ?? pid}`);
      }
    });
  }

  return { allowed: reasons.length === 0, reasons };
}
