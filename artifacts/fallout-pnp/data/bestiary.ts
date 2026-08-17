import { BestiaryTemplate, CharacterSkills, NaturalProtection, SPECIALStats, BestiaryCategory } from '@/context/types';

const defaultSkills = (): CharacterSkills => ({
  smallGuns: 0, bigGuns: 0, energyWeapons: 0, meleeWeapons: 0, unarmed: 0, throwing: 0,
  firstAid: 0, doctor: 0, sneak: 0, lockpick: 0, steal: 0, traps: 0,
  science: 0, repair: 0, speech: 0, barter: 0, gambling: 0, outdoorsman: 0, pilot: 0,
});

// Natural DT/DR helper: per-type DT and DR arrays [normal, laser, fire, plasma, explosion].
const natural = (
  dt: [number, number, number, number, number],
  dr: [number, number, number, number, number],
): NaturalProtection => ({
  dtNormal: dt[0], dtLaser: dt[1], dtFire: dt[2], dtPlasma: dt[3], dtExplosion: dt[4],
  drNormal: dr[0], drLaser: dr[1], drFire: dr[2], drPlasma: dr[3], drExplosion: dr[4],
});

export const BUILT_IN_BESTIARY: BestiaryTemplate[] = [
  // ─── HUMAN ──────────────────────────────────────────────────────────────────
  {
    id: 'raider_scavenger', name: 'Raider Scavenger', category: 'human',
    description: 'A desperate wasteland raider scraping by on what they can steal.',
    special: { strength: 4, perception: 4, endurance: 4, charisma: 3, intelligence: 3, agility: 5, luck: 3 },
    maxHp: 22, armorClass: 10, maxAP: 8,
    skills: { ...defaultSkills(), smallGuns: 35, meleeWeapons: 30, unarmed: 30, firstAid: 15, sneak: 25 },
    equippedWeaponId: 'pipe_pistol', equippedBodyArmorId: 'leather_armor',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'raider_veteran', name: 'Veteran Raider', category: 'human',
    description: 'A battle-hardened raider who has survived countless wasteland conflicts.',
    special: { strength: 6, perception: 5, endurance: 5, charisma: 3, intelligence: 4, agility: 6, luck: 4 },
    maxHp: 40, armorClass: 20, maxAP: 9,
    skills: { ...defaultSkills(), smallGuns: 60, meleeWeapons: 50, unarmed: 45, firstAid: 25, sneak: 35 },
    equippedWeaponId: 'assault_rifle', equippedBodyArmorId: 'metal_armor',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'raider_warlord', name: 'Raider Warlord', category: 'human',
    description: 'The brutal leader of a raider band. Feared and obeyed by all.',
    special: { strength: 8, perception: 6, endurance: 7, charisma: 5, intelligence: 5, agility: 6, luck: 5 },
    maxHp: 60, armorClass: 22, maxAP: 9,
    skills: { ...defaultSkills(), smallGuns: 75, meleeWeapons: 65, unarmed: 60, bigGuns: 40, firstAid: 40, speech: 35 },
    equippedWeaponId: 'combat_shotgun', equippedBodyArmorId: 'reaver_banding',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'tribal_warrior', name: 'Tribal Warrior', category: 'human',
    description: 'A wasteland tribesman skilled in primitive combat.',
    special: { strength: 6, perception: 6, endurance: 6, charisma: 4, intelligence: 3, agility: 7, luck: 5 },
    maxHp: 38, armorClass: 12, maxAP: 10,
    skills: { ...defaultSkills(), meleeWeapons: 55, unarmed: 50, throwing: 40, sneak: 45, outdoorsman: 60 },
    equippedWeaponId: 'spear',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'ncr_trooper', name: 'NCR Trooper', category: 'human',
    description: 'A disciplined soldier of the New California Republic.',
    special: { strength: 5, perception: 6, endurance: 5, charisma: 4, intelligence: 5, agility: 5, luck: 4 },
    maxHp: 42, armorClass: 22, maxAP: 8,
    skills: { ...defaultSkills(), smallGuns: 65, meleeWeapons: 40, firstAid: 45, speech: 35, outdoorsman: 40 },
    equippedWeaponId: 'assault_rifle', equippedBodyArmorId: 'combat_armor', equippedHelmetId: 'combat_helmet',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'brotherhood_paladin', name: 'Brotherhood Paladin', category: 'human',
    description: 'An elite soldier of the Brotherhood of Steel in full power armor.',
    special: { strength: 7, perception: 6, endurance: 7, charisma: 4, intelligence: 6, agility: 5, luck: 5 },
    maxHp: 70, armorClass: 35, maxAP: 8,
    skills: { ...defaultSkills(), smallGuns: 80, energyWeapons: 70, meleeWeapons: 65, repair: 60, science: 50 },
    equippedWeaponId: 'laser_rifle', equippedBodyArmorId: 'brotherhood_power_armor', equippedHelmetId: 'power_helmet',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'enclave_soldier', name: 'Enclave Soldier', category: 'human',
    description: 'A highly trained soldier of the remnant Enclave government.',
    special: { strength: 6, perception: 7, endurance: 6, charisma: 3, intelligence: 6, agility: 6, luck: 4 },
    maxHp: 65, armorClass: 30, maxAP: 9,
    skills: { ...defaultSkills(), smallGuns: 80, energyWeapons: 75, meleeWeapons: 55, science: 60, repair: 55 },
    equippedWeaponId: 'plasma_rifle', equippedBodyArmorId: 'adv_power_armor', equippedHelmetId: 'adv_power_helmet',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },

  // ─── GHOUL ──────────────────────────────────────────────────────────────────
  {
    id: 'feral_ghoul', name: 'Feral Ghoul', category: 'ghoul',
    description: 'A ghoul that has lost its mind to radiation and feral instinct.',
    special: { strength: 5, perception: 6, endurance: 6, charisma: 1, intelligence: 1, agility: 7, luck: 4 },
    maxHp: 30, armorClass: 10, maxAP: 10,
    skills: { ...defaultSkills(), unarmed: 55, meleeWeapons: 45, sneak: 30 },
    equippedWeaponId: 'unarmed',
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'ghoul_roamer', name: 'Ghoul Roamer', category: 'ghoul',
    description: 'A feral ghoul that has survived long enough to become particularly dangerous.',
    special: { strength: 6, perception: 7, endurance: 7, charisma: 1, intelligence: 2, agility: 7, luck: 5 },
    maxHp: 45, armorClass: 12, maxAP: 10,
    skills: { ...defaultSkills(), unarmed: 70, meleeWeapons: 55, sneak: 40 },
    equippedWeaponId: 'unarmed',
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'glowing_one', name: 'Glowing One', category: 'ghoul',
    description: 'An irradiated ghoul that glows with deadly radiation.',
    special: { strength: 5, perception: 7, endurance: 9, charisma: 1, intelligence: 2, agility: 6, luck: 5 },
    maxHp: 55, armorClass: 10, maxAP: 9,
    skills: { ...defaultSkills(), unarmed: 60, meleeWeapons: 50 },
    equippedWeaponId: 'unarmed',
    radiationResistance: 100, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'reaver_ghoul', name: 'Reaver Ghoul', category: 'ghoul',
    description: 'An organized and armed ghoul still capable of using weapons.',
    special: { strength: 5, perception: 8, endurance: 7, charisma: 3, intelligence: 6, agility: 6, luck: 5 },
    maxHp: 50, armorClass: 15, maxAP: 9,
    skills: { ...defaultSkills(), smallGuns: 50, meleeWeapons: 45, unarmed: 40, firstAid: 30, science: 30 },
    equippedWeaponId: 'hunting_rifle', equippedBodyArmorId: 'superior_ghoul_armor',
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
  },

  // ─── MUTANT ──────────────────────────────────────────────────────────────────
  {
    id: 'super_mutant_grunt', name: 'Super Mutant', category: 'mutant',
    description: 'A standard FEV-enhanced super mutant. Strong and hard to kill.',
    special: { strength: 9, perception: 5, endurance: 9, charisma: 2, intelligence: 3, agility: 5, luck: 4 },
    maxHp: 65, armorClass: 10, maxAP: 8,
    skills: { ...defaultSkills(), smallGuns: 50, bigGuns: 40, meleeWeapons: 55, unarmed: 60, firstAid: 20 },
    equippedWeaponId: 'assault_rifle', equippedBodyArmorId: 'mutant_plate_armor',
    // Super mutants have thick FEV-toughened hide (matches premade mutant NP 0/25).
    naturalProtection: natural([0, 0, 0, 0, 0], [25, 15, 15, 15, 15]),
    radiationResistance: 10, gasResistance: 10, electricityResistance: 0,
  },
  {
    id: 'super_mutant_brute', name: 'Super Mutant Brute', category: 'mutant',
    description: 'A larger, meaner super mutant that uses big guns without penalty.',
    special: { strength: 11, perception: 5, endurance: 11, charisma: 2, intelligence: 3, agility: 4, luck: 4 },
    maxHp: 90, armorClass: 10, maxAP: 7,
    skills: { ...defaultSkills(), smallGuns: 55, bigGuns: 65, meleeWeapons: 70, unarmed: 70 },
    equippedWeaponId: 'minigun', equippedBodyArmorId: 'mutant_plate_armor',
    naturalProtection: natural([0, 0, 0, 0, 0], [30, 20, 20, 20, 20]),
    radiationResistance: 15, gasResistance: 15, electricityResistance: 0,
  },
  {
    id: 'super_mutant_overlord', name: 'Super Mutant Overlord', category: 'mutant',
    description: 'An ancient and powerful super mutant commander.',
    special: { strength: 12, perception: 7, endurance: 12, charisma: 4, intelligence: 6, agility: 6, luck: 6 },
    maxHp: 120, armorClass: 15, maxAP: 9,
    skills: { ...defaultSkills(), smallGuns: 75, bigGuns: 80, energyWeapons: 65, meleeWeapons: 80, unarmed: 80 },
    equippedWeaponId: 'bozar', equippedBodyArmorId: 'spiked_mutant_plate_armor',
    naturalProtection: natural([0, 0, 0, 0, 0], [35, 25, 25, 25, 25]),
    radiationResistance: 20, gasResistance: 20, electricityResistance: 0,
  },
  {
    id: 'nightkin', name: 'Nightkin', category: 'mutant',
    description: 'Elite super mutants that use Stealth Boys. Highly dangerous ambush predators.',
    special: { strength: 10, perception: 6, endurance: 10, charisma: 2, intelligence: 5, agility: 8, luck: 5 },
    maxHp: 80, armorClass: 20, maxAP: 11,
    skills: { ...defaultSkills(), smallGuns: 60, meleeWeapons: 75, unarmed: 70, sneak: 80 },
    equippedWeaponId: 'super_sledge', equippedBodyArmorId: 'mutant_plate_armor',
    naturalProtection: natural([0, 0, 0, 0, 0], [25, 20, 15, 20, 15]),
    radiationResistance: 10, gasResistance: 10, electricityResistance: 0,
  },
  {
    id: 'centaur_creature', name: 'Centaur', category: 'mutant',
    description: 'A horrific FEV multi-headed creature. Dangerous at range with acid spit.',
    special: { strength: 6, perception: 6, endurance: 7, charisma: 1, intelligence: 2, agility: 4, luck: 4 },
    maxHp: 40, armorClass: 12, maxAP: 7,
    skills: { ...defaultSkills(), unarmed: 45, meleeWeapons: 35 },
    equippedWeaponId: 'centaur_spit',
    // FEV/alien-family flesh: resistant to conventional weapons (manual alien family).
    naturalProtection: natural([2, 0, 1, 0, 2], [40, 5, 15, 5, 40]),
    radiationResistance: 30, gasResistance: 40, electricityResistance: 0,
  },
  {
    id: 'floater_creature', name: 'Floater', category: 'mutant',
    description: 'A floating FEV gas-bag creature. Immune to floor traps and most gases. Highly resistant to conventional weapons.',
    special: { strength: 6, perception: 7, endurance: 7, charisma: 1, intelligence: 2, agility: 9, luck: 5 },
    maxHp: 38, armorClass: 20, maxAP: 12,
    skills: { ...defaultSkills(), unarmed: 55 },
    equippedWeaponId: 'floater_bite',
    // Manual Floater: DT 10/1/5/1/10, DR 95%/10%/40%/10%/90%; PR 95, RR 100, GR 100/100.
    naturalProtection: natural([10, 1, 5, 1, 10], [90, 10, 40, 10, 90]),
    radiationResistance: 100, gasResistance: 100, electricityResistance: 0,
  },

  // ─── ROBOT ──────────────────────────────────────────────────────────────────
  {
    id: 'protectron', name: 'Protectron', category: 'robot',
    description: 'A pre-war service robot repurposed for combat. Slow but durable.',
    special: { strength: 6, perception: 7, endurance: 9, charisma: 1, intelligence: 5, agility: 3, luck: 2 },
    maxHp: 55, armorClass: 15, maxAP: 6,
    skills: { ...defaultSkills(), unarmed: 45, energyWeapons: 50 },
    equippedWeaponId: 'laser_pistol',
    // Metal chassis: solid natural DT/DR.
    naturalProtection: natural([6, 4, 4, 2, 6], [40, 40, 30, 20, 40]),
    radiationResistance: 100, gasResistance: 100, electricityResistance: -50,
  },
  {
    id: 'mr_handy', name: 'Mr. Handy', category: 'robot',
    description: 'A hovering household robot with a buzzsaw and torch attachment.',
    special: { strength: 5, perception: 8, endurance: 7, charisma: 5, intelligence: 7, agility: 7, luck: 3 },
    maxHp: 50, armorClass: 20, maxAP: 10,
    skills: { ...defaultSkills(), meleeWeapons: 55, energyWeapons: 40, repair: 70, science: 60 },
    equippedWeaponId: 'ripper',
    naturalProtection: natural([5, 3, 3, 2, 5], [35, 35, 25, 15, 35]),
    radiationResistance: 100, gasResistance: 100, electricityResistance: -50,
  },
  {
    id: 'sentry_bot', name: 'Sentry Bot', category: 'robot',
    description: 'A heavily armed military robot. Minigun and rocket launcher equipped.',
    special: { strength: 10, perception: 9, endurance: 11, charisma: 1, intelligence: 5, agility: 5, luck: 3 },
    maxHp: 100, armorClass: 20, maxAP: 8,
    skills: { ...defaultSkills(), bigGuns: 80, smallGuns: 70, energyWeapons: 60 },
    equippedWeaponId: 'minigun',
    // Heavy military armor plating.
    naturalProtection: natural([12, 8, 8, 6, 12], [50, 50, 40, 30, 50]),
    radiationResistance: 100, gasResistance: 100, electricityResistance: -50,
  },
  {
    id: 'eyebot', name: 'Eyebot', category: 'robot',
    description: 'A small floating surveillance drone with a laser.',
    special: { strength: 2, perception: 12, endurance: 3, charisma: 1, intelligence: 6, agility: 12, luck: 5 },
    maxHp: 20, armorClass: 25, maxAP: 14,
    skills: { ...defaultSkills(), energyWeapons: 55 },
    equippedWeaponId: 'laser_pistol',
    // Small light drone chassis.
    naturalProtection: natural([2, 1, 1, 1, 2], [20, 20, 15, 10, 20]),
    radiationResistance: 100, gasResistance: 100, electricityResistance: -50,
  },

  // ─── BEAST ──────────────────────────────────────────────────────────────────
  {
    id: 'young_deathclaw', name: 'Young Deathclaw', category: 'beast',
    description: 'A juvenile Deathclaw, still deadly despite its size.',
    special: { strength: 9, perception: 8, endurance: 9, charisma: 1, intelligence: 3, agility: 11, luck: 5 },
    maxHp: 60, armorClass: 22, maxAP: 14,
    skills: { ...defaultSkills(), unarmed: 70, meleeWeapons: 50, sneak: 40, outdoorsman: 60 },
    equippedWeaponId: 'deathclaw_claw',
    // Manual Deathclaw hide: DT 4/0/4/0/4, DR 40%/0/40%/0/40%; scaled down slightly for a juvenile.
    naturalProtection: natural([3, 0, 3, 0, 3], [30, 0, 30, 0, 30]),
    radiationResistance: 60, gasResistance: 40, electricityResistance: 10,
  },
  {
    id: 'alpha_deathclaw', name: 'Alpha Deathclaw', category: 'beast',
    description: 'The fearsome pack leader of a Deathclaw nest.',
    special: { strength: 13, perception: 12, endurance: 13, charisma: 2, intelligence: 5, agility: 13, luck: 6 },
    maxHp: 120, armorClass: 30, maxAP: 16,
    skills: { ...defaultSkills(), unarmed: 90, meleeWeapons: 80, sneak: 50, outdoorsman: 75 },
    equippedWeaponId: 'deathclaw_claw',
    // Full manual Deathclaw values: DT 4/0/4/0/4, DR 40%/0/40%/0/40%.
    naturalProtection: natural([4, 0, 4, 0, 4], [40, 0, 40, 0, 40]),
    radiationResistance: 60, gasResistance: 40, electricityResistance: 10,
  },
  {
    id: 'deathclaw_mother', name: 'Deathclaw Mother', category: 'beast',
    description: 'A massive female Deathclaw guarding her eggs. Extraordinarily dangerous.',
    special: { strength: 14, perception: 11, endurance: 14, charisma: 2, intelligence: 6, agility: 11, luck: 7 },
    maxHp: 150, armorClass: 28, maxAP: 14,
    skills: { ...defaultSkills(), unarmed: 95, meleeWeapons: 85, sneak: 45, outdoorsman: 80 },
    equippedWeaponId: 'deathclaw_claw',
    // Massive matriarch — slightly above the manual's standard Deathclaw hide.
    naturalProtection: natural([5, 0, 5, 0, 5], [45, 0, 45, 0, 45]),
    radiationResistance: 60, gasResistance: 40, electricityResistance: 10,
  },
  {
    id: 'wasteland_dog', name: 'Wasteland Dog', category: 'beast',
    description: 'A pack dog of the wasteland. Dangerous in numbers.',
    special: { strength: 4, perception: 8, endurance: 5, charisma: 5, intelligence: 3, agility: 9, luck: 5 },
    maxHp: 22, armorClass: 15, maxAP: 12,
    skills: { ...defaultSkills(), unarmed: 45, sneak: 40, outdoorsman: 50 },
    equippedWeaponId: 'dog_bite',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'vicious_dog', name: 'Vicious Dog', category: 'beast',
    description: 'A feral, radiation-affected dog. More aggressive and resilient than a normal wasteland dog.',
    special: { strength: 5, perception: 9, endurance: 6, charisma: 4, intelligence: 3, agility: 10, luck: 5 },
    maxHp: 30, armorClass: 18, maxAP: 13,
    skills: { ...defaultSkills(), unarmed: 55, sneak: 45, outdoorsman: 60 },
    equippedWeaponId: 'dog_bite',
    radiationResistance: 5, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'molerat_common', name: 'Molerat', category: 'beast',
    description: 'A common wasteland molerat. Fast burrowers that attack in packs.',
    special: { strength: 4, perception: 6, endurance: 6, charisma: 1, intelligence: 2, agility: 7, luck: 4 },
    maxHp: 18, armorClass: 10, maxAP: 10,
    skills: { ...defaultSkills(), unarmed: 40, sneak: 35, outdoorsman: 50 },
    equippedWeaponId: 'molerat_bite',
    // Manual Lesser Molerat: DT 1/0/0/0/1, DR 5%/0/0/0/5%; PR 50, RR 25.
    naturalProtection: natural([1, 0, 0, 0, 1], [5, 0, 0, 0, 5]),
    radiationResistance: 25, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'giant_molerat', name: 'Giant Molerat', category: 'beast',
    description: 'An oversized molerat, likely a pack leader. Can cause knockdown.',
    special: { strength: 6, perception: 7, endurance: 8, charisma: 1, intelligence: 2, agility: 6, luck: 4 },
    maxHp: 35, armorClass: 12, maxAP: 9,
    skills: { ...defaultSkills(), unarmed: 55, sneak: 30, outdoorsman: 55 },
    equippedWeaponId: 'molerat_bite',
    // Manual Greater Molerat: DT 4/1/0/0/0, DR 20%/5%/0/0/20%; PR 60, RR 25.
    naturalProtection: natural([4, 1, 0, 0, 0], [20, 5, 0, 0, 20]),
    radiationResistance: 25, gasResistance: 25, electricityResistance: 0,
  },
  {
    id: 'yaoguai_common', name: 'Yao Guai', category: 'beast',
    description: 'A mutated black bear. Ferocious melee predator with huge claws.',
    special: { strength: 9, perception: 7, endurance: 9, charisma: 1, intelligence: 3, agility: 8, luck: 5 },
    maxHp: 70, armorClass: 18, maxAP: 11,
    skills: { ...defaultSkills(), unarmed: 65, meleeWeapons: 50, outdoorsman: 65 },
    equippedWeaponId: 'yaoguai_claw',
    // Thick mutated-bear hide (comparable to the manual's Dire Wolf DT 5, DR 40%).
    naturalProtection: natural([3, 0, 0, 0, 2], [30, 0, 0, 0, 20]),
    radiationResistance: 20, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'alpha_yaoguai', name: 'Alpha Yao Guai', category: 'beast',
    description: 'A massive, dominant yao guai. Extremely powerful.',
    special: { strength: 11, perception: 8, endurance: 11, charisma: 1, intelligence: 4, agility: 9, luck: 6 },
    maxHp: 100, armorClass: 20, maxAP: 12,
    skills: { ...defaultSkills(), unarmed: 80, meleeWeapons: 65, outdoorsman: 75 },
    equippedWeaponId: 'yaoguai_claw',
    naturalProtection: natural([5, 0, 0, 0, 3], [40, 0, 0, 0, 25]),
    radiationResistance: 25, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'radscorpion_common', name: 'Radscorpion', category: 'beast',
    description: 'A giant radiation-mutated scorpion. Claw and venomous sting.',
    special: { strength: 8, perception: 8, endurance: 10, charisma: 1, intelligence: 2, agility: 7, luck: 5 },
    maxHp: 55, armorClass: 20, maxAP: 10,
    skills: { ...defaultSkills(), unarmed: 60, meleeWeapons: 50, outdoorsman: 60 },
    equippedWeaponId: 'scorpion_claw',
    // Manual Lesser Radscorpion: DT 1/0/4/0/1, DR 5%/0/20%/0/5%; PR 100, RR 25, GR 30/100.
    naturalProtection: natural([1, 0, 4, 0, 1], [5, 0, 20, 0, 5]),
    radiationResistance: 25, gasResistance: 30, electricityResistance: 0,
  },
  {
    id: 'giant_radscorpion', name: 'Giant Radscorpion', category: 'beast',
    description: 'An enormous, heavily-armored radscorpion. Chitin is nearly impenetrable.',
    special: { strength: 11, perception: 9, endurance: 13, charisma: 1, intelligence: 2, agility: 6, luck: 5 },
    maxHp: 100, armorClass: 30, maxAP: 9,
    skills: { ...defaultSkills(), unarmed: 80, meleeWeapons: 65, outdoorsman: 70 },
    equippedWeaponId: 'scorpion_claw',
    // Greater/Giant Radscorpion: heavier chitin (manual base DT 1/0/4/0/1 DR 5/0/20/0/5,
    // scaled up for the largest specimens whose shell is nearly impenetrable).
    naturalProtection: natural([4, 0, 8, 0, 4], [25, 0, 40, 0, 25]),
    radiationResistance: 80, gasResistance: 40, electricityResistance: 0,
  },
  {
    id: 'brahmin_creature', name: 'Brahmin', category: 'beast',
    description: 'A two-headed mutant cow. Usually docile but can gore if threatened.',
    special: { strength: 7, perception: 4, endurance: 8, charisma: 3, intelligence: 2, agility: 4, luck: 4 },
    maxHp: 45, armorClass: 5, maxAP: 7,
    skills: { ...defaultSkills(), unarmed: 35, outdoorsman: 45 },
    equippedWeaponId: 'brahmin_horn',
    // Manual Brahmin: DT 2/0/0/0/2, DR 10%/0/0/0/10%; PR 20, RR 30, GR 0/10.
    naturalProtection: natural([2, 0, 0, 0, 2], [10, 0, 0, 0, 10]),
    radiationResistance: 30, gasResistance: 0, electricityResistance: 0,
  },
];

export const BESTIARY_CATEGORIES: { id: BestiaryCategory; label: string; icon: string }[] = [
  { id: 'human', label: 'Human', icon: 'user' },
  { id: 'ghoul', label: 'Ghoul', icon: 'cloud' },
  { id: 'mutant', label: 'Mutant', icon: 'zap' },
  { id: 'robot', label: 'Robot', icon: 'cpu' },
  { id: 'beast', label: 'Beast', icon: 'feather' },
  { id: 'custom', label: 'Custom', icon: 'plus-circle' },
];

export function getBestiaryById(id: string): BestiaryTemplate | undefined {
  return BUILT_IN_BESTIARY.find(t => t.id === id);
}
