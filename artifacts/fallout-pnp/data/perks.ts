import { RaceType } from '@/context/types';

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

export interface Perk {
  id: string;
  name: string;
  category: PerkCategory;
  description: string;
  minLevel: number;
  maxRanks: number;
  // SPECIAL requirements
  minSTR?: number;
  minPER?: number;
  minEND?: number;
  minCHA?: number;
  minAGI?: number;
  minINT?: number;
  minLCK?: number;
  // Skill requirement
  minSkill?: { skill: string; value: number };
  // Race restriction (empty = any race)
  requiresRace?: RaceType[];
  // Combat effect (null = non-combat)
  combatEffect: PerkCombatEffect | null;
}

export const PERKS: Perk[] = [
  // ─── COMBAT PERKS ─────────────────────────────────────────────────────────
  {
    id: 'action_boy_girl', name: 'Action Boy/Girl', category: 'combat',
    description: 'Each rank gives you one additional Action Point per combat turn.',
    minLevel: 12, maxRanks: 2, minAGI: 6,
    combatEffect: { attackAPDiscount: -1, combatNote: '+1 max AP per rank' },
  },
  {
    id: 'adrenaline_rush', name: 'Adrenaline Rush', category: 'combat',
    description: 'With less than 50% HP, your Strength is increased by 1 for each rank.',
    minLevel: 6, maxRanks: 2, minSTR: 1,
    combatEffect: { adrenalineRushActive: true, adrenalineStrBonus: 1, combatNote: '+1 STR when HP < 50%' },
  },
  {
    id: 'better_criticals', name: 'Better Criticals', category: 'combat',
    description: 'The critical hits you inflict are more deadly. +20% damage multiplier on criticals.',
    minLevel: 9, maxRanks: 1, minPER: 6, minAGI: 4, minLCK: 6,
    combatEffect: { critDamageMultiplier: 1.2, combatNote: '+20% crit damage multiplier' },
  },
  {
    id: 'bonus_hth_attacks', name: 'Bonus HtH Attacks', category: 'combat',
    description: 'You gain a bonus attack each turn with hand-to-hand weapons. Melee attacks cost 1 less AP.',
    minLevel: 9, maxRanks: 1, minAGI: 6,
    combatEffect: { attackAPDiscount: 1, combatNote: 'Melee attacks −1 AP' },
  },
  {
    id: 'bonus_hth_damage', name: 'Bonus HtH Damage', category: 'combat',
    description: 'Proper training in hand-to-hand combat adds +2 per rank to your melee/unarmed damage.',
    minLevel: 3, maxRanks: 3, minSTR: 6,
    combatEffect: { meleeDamageBonus: 2, combatNote: '+2 melee/unarmed damage per rank' },
  },
  {
    id: 'bonus_ranged_damage', name: 'Bonus Ranged Damage', category: 'combat',
    description: 'Due to extensive training with ranged weapons, you do +2 damage per rank with any ranged weapon.',
    minLevel: 6, maxRanks: 2, minAGI: 6,
    combatEffect: { rangedDamageBonus: 2, combatNote: '+2 ranged damage per rank' },
  },
  {
    id: 'bonus_rate_of_fire', name: 'Bonus Rate of Fire', category: 'combat',
    description: 'Each ranged weapon attack now costs 1 less Action Point.',
    minLevel: 9, maxRanks: 1, minPER: 6, minAGI: 7, minINT: 6,
    combatEffect: { attackAPDiscount: 1, combatNote: 'Ranged attacks −1 AP' },
  },
  {
    id: 'demolition_expert', name: 'Demolition Expert', category: 'combat',
    description: 'Your skills with explosives are without equal. +4 explosion damage per rank.',
    minLevel: 6, maxRanks: 3, minAGI: 4, minSkill: { skill: 'traps', value: 75 },
    combatEffect: { explosionDamageBonus: 4, combatNote: '+4 explosion damage per rank' },
  },
  {
    id: 'die_hard', name: 'Die Hard', category: 'combat',
    description: 'You will fight to the death. If knocked unconscious, you fight for 1 more round at −10 HP.',
    minLevel: 3, maxRanks: 1, minEND: 6,
    combatEffect: { combatNote: 'Fight 1 more round at −10 HP when KO\'d' },
  },
  {
    id: 'dodger', name: 'Dodger', category: 'combat',
    description: 'You are hard to hit. +5 Armor Class per rank.',
    minLevel: 9, maxRanks: 2, minAGI: 6,
    combatEffect: { armorClassBonus: 5, combatNote: '+5 AC per rank' },
  },
  {
    id: 'earlier_sequence', name: 'Earlier Sequence', category: 'combat',
    description: 'You move faster than those around you. +2 Sequence per rank.',
    minLevel: 3, maxRanks: 3, minPER: 6,
    combatEffect: { sequenceBonus: 2, combatNote: '+2 Sequence per rank' },
  },
  {
    id: 'finesse', name: 'Finesse', category: 'combat',
    description: 'Your attacks show a lot of finesse. +10% crit chance, but −30% crit damage.',
    minLevel: 9, maxRanks: 1,
    combatEffect: { critChanceBonus: 10, critDamageMultiplier: 0.7, combatNote: '+10% crit, −30% crit damage' },
  },
  {
    id: 'gunslinger', name: 'Gunslinger', category: 'combat',
    description: 'Your skill with single-handed ranged weapons makes you deadly. One-handed ranged attacks are always critical hits.',
    minLevel: 12, maxRanks: 1, minAGI: 6,
    combatEffect: { allHitsAreCrits: true, combatNote: 'One-handed ranged always crit' },
  },
  {
    id: 'living_anatomy', name: 'Living Anatomy', category: 'combat',
    description: 'You know the anatomy of people and animals. +5 damage to living targets. You can see HP/weaknesses.',
    minLevel: 12, maxRanks: 1, minINT: 7, minSkill: { skill: 'doctor', value: 60 },
    combatEffect: { damageBonus: 5, combatNote: '+5 damage vs living targets' },
  },
  {
    id: 'more_criticals', name: 'More Criticals', category: 'combat',
    description: 'You are more likely to cause critical hits. +5% critical chance per rank.',
    minLevel: 6, maxRanks: 3, minLCK: 6,
    combatEffect: { critChanceBonus: 5, combatNote: '+5% critical chance per rank' },
  },
  {
    id: 'penetrate', name: 'Penetrate', category: 'combat',
    description: 'With this perk, your ranged attacks ignore up to 10 points of Damage Threshold per rank.',
    minLevel: 9, maxRanks: 2, minAGI: 7,
    combatEffect: { ignoreDT: 10, combatNote: 'Ignore up to 10 DT per rank (ranged)' },
  },
  {
    id: 'pyromaniac', name: 'Pyromaniac', category: 'combat',
    description: 'You do +5 damage per rank with fire-based weapons. Fire! Fire!',
    minLevel: 6, maxRanks: 2,
    combatEffect: { fireWeaponDamageBonus: 5, combatNote: '+5 fire weapon damage per rank' },
  },
  {
    id: 'sharpshooter', name: 'Sharpshooter', category: 'combat',
    description: 'You are an expert at long-range combat. +2 effective Perception for range calculations.',
    minLevel: 9, maxRanks: 1, minPER: 6, minINT: 6,
    combatEffect: { combatNote: '+2 PER effective for range' },
  },
  {
    id: 'slayer', name: 'Slayer', category: 'combat',
    description: 'In hand-to-hand combat, all of your hits are critical. The Slayer walks the earth!',
    minLevel: 18, maxRanks: 1, minSTR: 8, minAGI: 8, minSkill: { skill: 'unarmed', value: 80 },
    combatEffect: { allHitsAreCrits: true, combatNote: 'All HtH hits are critical' },
  },
  {
    id: 'sniper', name: 'Sniper', category: 'combat',
    description: 'You are an expert marksman. All ranged attacks aimed at the head zone are critical hits.',
    minLevel: 18, maxRanks: 1, minPER: 8, minAGI: 8, minSkill: { skill: 'smallGuns', value: 80 },
    combatEffect: { allHitsAreCrits: true, combatNote: 'Ranged aimed at head always crit' },
  },
  {
    id: 'snakeater', name: 'Snakeater', category: 'survival',
    description: '+35% Poison Resistance per rank.',
    minLevel: 3, maxRanks: 2,
    combatEffect: { combatNote: '+35% Poison Resistance per rank' },
  },
  {
    id: 'toughness', name: 'Toughness', category: 'defense',
    description: 'You are tougher. +10% Damage Resistance (all types) per rank.',
    minLevel: 3, maxRanks: 2, minEND: 6,
    combatEffect: { damageResistBonus: 10, combatNote: '+10% all DR per rank' },
  },
  {
    id: 'weapon_handling', name: 'Weapon Handling', category: 'combat',
    description: 'Your grip and weapon technique allows you to use bigger guns. Weapon STR requirement −2.',
    minLevel: 12, maxRanks: 1, minSTR: 5, minAGI: 5,
    combatEffect: { weaponStrReqReduction: 2, combatNote: 'Weapon STR req −2' },
  },
  // ─── DEFENSE PERKS ────────────────────────────────────────────────────────
  {
    id: 'cautious_nature', name: 'Cautious Nature', category: 'defense',
    description: '+3 Perception for random encounter detection.',
    minLevel: 3, maxRanks: 1, minPER: 6,
    combatEffect: null,
  },
  {
    id: 'fast_metabolism', name: 'Fast Metabolism', category: 'defense',
    description: 'Your metabolic rate is faster. +2 Healing Rate.',
    minLevel: 3, maxRanks: 1,
    combatEffect: null,
  },
  {
    id: 'healer', name: 'Healer', category: 'defense',
    description: 'The healing of wounds comes naturally to you. Restore 1d3+2 HP per day per rank.',
    minLevel: 3, maxRanks: 3, minPER: 7, minINT: 5, minAGI: 6,
    combatEffect: null,
  },
  {
    id: 'here_and_now', name: 'Here and Now', category: 'utility',
    description: 'You advance immediately to the next experience level. Single use.',
    minLevel: 9, maxRanks: 1,
    combatEffect: null,
  },
  {
    id: 'lifegiver', name: 'Lifegiver', category: 'defense',
    description: 'You gain an additional 4 maximum Hit Points per rank every time you level up.',
    minLevel: 6, maxRanks: 3, minEND: 4,
    combatEffect: { extraMaxHP: 4, combatNote: '+4 max HP per rank' },
  },
  {
    id: 'light_step', name: 'Light Step', category: 'defense',
    description: 'You are agile and careful. You won\'t trigger floor-based traps.',
    minLevel: 9, maxRanks: 1, minAGI: 5, minLCK: 5,
    combatEffect: null,
  },
  {
    id: 'rad_resistance', name: 'Rad Resistance', category: 'defense',
    description: '+15% Radiation Resistance per rank.',
    minLevel: 6, maxRanks: 2, minEND: 6, minINT: 4,
    combatEffect: null,
  },
  {
    id: 'silent_running', name: 'Silent Running', category: 'defense',
    description: 'With this perk, you can run and still remain quiet. No Sneak penalty while moving.',
    minLevel: 6, maxRanks: 1, minAGI: 6, minSkill: { skill: 'sneak', value: 50 },
    combatEffect: null,
  },
  // ─── UTILITY PERKS ─────────────────────────────────────────────────────────
  {
    id: 'awareness', name: 'Awareness', category: 'utility',
    description: 'With the Awareness perk, you are given detailed information about any critter you examine.',
    minLevel: 3, maxRanks: 1, minPER: 5,
    combatEffect: null,
  },
  {
    id: 'chem_resistant', name: 'Chem Resistant', category: 'utility',
    description: 'Chems only have a 50% chance of getting you addicted.',
    minLevel: 9, maxRanks: 1, minEND: 6,
    combatEffect: null,
  },
  {
    id: 'educated', name: 'Educated', category: 'utility',
    description: '+2 skill points per level per rank.',
    minLevel: 3, maxRanks: 3, minINT: 6,
    combatEffect: null,
  },
  {
    id: 'explorer', name: 'Explorer', category: 'utility',
    description: 'The thrill of exploration calls to you. Special encounters are more likely.',
    minLevel: 9, maxRanks: 1,
    combatEffect: null,
  },
  {
    id: 'flower_child', name: 'Flower Child', category: 'utility',
    description: 'Junkies rarely become friends with you. Half the normal withdrawal time.',
    minLevel: 3, maxRanks: 1, minEND: 5,
    combatEffect: null,
  },
  {
    id: 'ghost', name: 'Ghost', category: 'utility',
    description: 'The darkness is your friend. +20% to Sneak in low-light conditions per rank.',
    minLevel: 6, maxRanks: 2, minAGI: 8, minSkill: { skill: 'sneak', value: 60 },
    combatEffect: null,
  },
  {
    id: 'jack_of_all_trades', name: 'Jack of All Trades', category: 'utility',
    description: 'You\'ve always dabbled. +5 to all skills.',
    minLevel: 12, maxRanks: 1,
    combatEffect: null,
  },
  {
    id: 'leader', name: 'Leader', category: 'social',
    description: 'You inspire those around you. Nearby allies gain +1 to all SPECIAL stats.',
    minLevel: 9, maxRanks: 1, minCHA: 7,
    combatEffect: { combatNote: '+1 SPECIAL to nearby allies' },
  },
  {
    id: 'master_thief', name: 'Master Thief', category: 'utility',
    description: '+15 to both Sneak and Steal.',
    minLevel: 12, maxRanks: 1, minAGI: 7,
    combatEffect: null,
  },
  {
    id: 'medic', name: 'Medic', category: 'utility',
    description: '+10 to First Aid and Doctor per rank.',
    minLevel: 9, maxRanks: 2, minINT: 7,
    combatEffect: null,
  },
  {
    id: 'mr_fixit', name: 'Mr. Fixit', category: 'utility',
    description: '+10 to Repair and Science.',
    minLevel: 9, maxRanks: 1, minINT: 7,
    combatEffect: null,
  },
  {
    id: 'mutate', name: 'Mutate!', category: 'utility',
    description: 'One of your traits mutates into something else. Select a new trait to replace one you have.',
    minLevel: 9, maxRanks: 1,
    combatEffect: null,
  },
  {
    id: 'natural_chem_resistant', name: 'Natural Chem Resistant', category: 'utility',
    description: 'You are naturally immune to addiction. Chems can never addict you.',
    minLevel: 12, maxRanks: 1, minEND: 8,
    combatEffect: null,
  },
  {
    id: 'negotiator', name: 'Negotiator', category: 'social',
    description: '+10 to Barter and Speech per rank.',
    minLevel: 9, maxRanks: 2, minCHA: 7,
    combatEffect: null,
  },
  {
    id: 'night_vision', name: 'Night Vision', category: 'utility',
    description: 'Darkness is your friend. Reduces light-condition penalties by 20% per rank.',
    minLevel: 3, maxRanks: 2, minPER: 6,
    combatEffect: { combatNote: '−20% light penalty per rank' },
  },
  {
    id: 'pack_rat', name: 'Pack Rat', category: 'utility',
    description: 'You are an experienced scavenger. −25% item weight for carrying purposes.',
    minLevel: 3, maxRanks: 1, minSTR: 5,
    combatEffect: null,
  },
  {
    id: 'pathfinder', name: 'Pathfinder', category: 'survival',
    description: 'Travelling the wastes is second nature. −25% travel time per rank.',
    minLevel: 3, maxRanks: 2, minEND: 6, minSkill: { skill: 'outdoorsman', value: 40 },
    combatEffect: null,
  },
  {
    id: 'pickpocket', name: 'Pickpocket', category: 'utility',
    description: '+25% to Steal when picking pockets from behind.',
    minLevel: 6, maxRanks: 1, minAGI: 8,
    combatEffect: null,
  },
  {
    id: 'pilot', name: 'Pilot', category: 'utility',
    description: '+20% to Pilot skill checks. You can handle vehicles others cannot.',
    minLevel: 6, maxRanks: 2, minPER: 6, minAGI: 6,
    combatEffect: null,
  },
  {
    id: 'presence', name: 'Presence', category: 'social',
    description: '+10% to reaction rolls (social interactions) per rank.',
    minLevel: 3, maxRanks: 3, minCHA: 6,
    combatEffect: null,
  },
  {
    id: 'quick_pockets', name: 'Quick Pockets', category: 'utility',
    description: 'Inventory access costs 2 AP instead of 4.',
    minLevel: 3, maxRanks: 1, minAGI: 5,
    combatEffect: { attackAPDiscount: 0, combatNote: 'Inventory access: 4 AP → 2 AP' },
  },
  {
    id: 'ranger', name: 'Ranger', category: 'survival',
    description: '+15% to Outdoorsman per rank.',
    minLevel: 6, maxRanks: 3, minEND: 6,
    combatEffect: null,
  },
  {
    id: 'scout', name: 'Scout', category: 'utility',
    description: 'Your view range in all directions is doubled.',
    minLevel: 6, maxRanks: 1, minPER: 7,
    combatEffect: null,
  },
  {
    id: 'speaker', name: 'Speaker', category: 'social',
    description: '+20% to all Speech-based skill checks.',
    minLevel: 9, maxRanks: 1, minCHA: 8,
    combatEffect: null,
  },
  {
    id: 'strong_back', name: 'Strong Back', category: 'utility',
    description: '+50 lbs carry weight per rank.',
    minLevel: 3, maxRanks: 2, minSTR: 6, minEND: 6,
    combatEffect: null,
  },
  {
    id: 'swift_learner', name: 'Swift Learner', category: 'utility',
    description: '+5% bonus XP per rank whenever XP is awarded.',
    minLevel: 3, maxRanks: 3,
    combatEffect: null,
  },
  {
    id: 'tag', name: 'Tag!', category: 'utility',
    description: 'Choose an additional Tag skill, receiving a free +20% bonus.',
    minLevel: 9, maxRanks: 1,
    combatEffect: null,
  },
  {
    id: 'treasure_hunter', name: 'Treasure Hunter', category: 'utility',
    description: 'Your knack for finding loot improves the quality of random encounter finds.',
    minLevel: 12, maxRanks: 1, minLCK: 8,
    combatEffect: null,
  },
  // ─── RACIAL PERKS ──────────────────────────────────────────────────────────
  {
    id: 'glowing_one', name: 'Glowing One', category: 'racial',
    description: 'Ghoul only. You emit radiation, damaging enemies and healing nearby ghouls.',
    minLevel: 6, maxRanks: 1,
    requiresRace: ['ghoul'],
    combatEffect: { damageBonus: 2, combatNote: 'Emit radiation aura (heal allies, damage enemies)' },
  },
  {
    id: 'feral_reversion', name: 'Feral Reversion', category: 'racial',
    description: 'Ghoul only. Tap into your feral instincts for bonus melee damage and speed.',
    minLevel: 9, maxRanks: 1,
    requiresRace: ['ghoul'],
    combatEffect: { meleeDamageBonus: 4, attackAPDiscount: 1, combatNote: '+4 melee dmg, −1 AP melee (feral mode)' },
  },
  {
    id: 'super_mutant_upgrade', name: 'Super Mutant Upgrade', category: 'racial',
    description: 'Super Mutant only. Further mutation grants +1 STR and +1 END.',
    minLevel: 6, maxRanks: 2,
    requiresRace: ['superMutant'],
    combatEffect: { combatNote: '+1 STR, +1 END per rank' },
  },
  {
    id: 'cyborg_systems', name: 'Cyborg Systems', category: 'racial',
    description: 'Robot only. Upgrade your internal systems. +10% all DR, +5 AC.',
    minLevel: 6, maxRanks: 2,
    requiresRace: ['robot'],
    combatEffect: { damageResistBonus: 10, armorClassBonus: 5, combatNote: '+10% DR, +5 AC per rank' },
  },
  {
    id: 'deathclaw_rampage', name: 'Deathclaw Rampage', category: 'racial',
    description: 'Deathclaw only. When wounded below 50% HP, claw damage increases by 50% and AC bonus activates.',
    minLevel: 3, maxRanks: 1,
    requiresRace: ['deathclaw'],
    combatEffect: { meleeDamageBonus: 6, armorClassBonus: 5, combatNote: '+6 melee dmg, +5 AC when HP < 50%' },
  },
];

export function getPerkById(id: string): Perk | undefined {
  return PERKS.find(p => p.id === id);
}

export function getPerksForRace(race: string): Perk[] {
  return PERKS.filter(p => !p.requiresRace || p.requiresRace.includes(race as RaceType));
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
