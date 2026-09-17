import type {
  BestiaryTemplate,
  CharacterSkills,
  NaturalProtection,
} from '../context/types.ts';

const defaultSkills = (): CharacterSkills => ({
  smallGuns: 0, bigGuns: 0, energyWeapons: 0, meleeWeapons: 0, unarmed: 0, throwing: 0,
  firstAid: 0, doctor: 0, sneak: 0, lockpick: 0, steal: 0, traps: 0,
  science: 0, repair: 0, speech: 0, barter: 0, gambling: 0, outdoorsman: 0, pilot: 0,
});

const natural = (
  dt: [number, number, number, number, number],
  dr: [number, number, number, number, number],
): NaturalProtection => ({
  dtNormal: dt[0], dtLaser: dt[1], dtFire: dt[2], dtPlasma: dt[3], dtExplosion: dt[4],
  drNormal: dr[0], drLaser: dr[1], drFire: dr[2], drPlasma: dr[3], drExplosion: dr[4],
});

/**
 * Built-in human, ghoul, super-mutant, and robot templates from the catalog
 * that preceded the manual creature catalog. Sequence is the historical
 * perception value multiplied by two.
 */
const RESTORED_BESTIARY_ENTRIES: BestiaryTemplate[] = [
  {
    id: 'raider_scavenger', name: 'Raider Scavenger', category: 'human',
    description: 'A desperate wasteland raider scraping by on what they can steal.',
    special: { strength: 4, perception: 4, endurance: 4, charisma: 3, intelligence: 3, agility: 5, luck: 3 },
    maxHp: 22, armorClass: 10, maxAP: 8, sequence: 8,
    skills: { ...defaultSkills(), smallGuns: 35, meleeWeapons: 30, unarmed: 30, firstAid: 15, sneak: 25 },
    equippedWeaponId: 'zip_gun', inventoryWeaponIds: ['zip_gun', 'knife', 'molotov'], equippedBodyArmorId: 'leather_armor',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'raider_veteran', name: 'Veteran Raider', category: 'human',
    description: 'A battle-hardened raider who has survived countless wasteland conflicts.',
    special: { strength: 6, perception: 5, endurance: 5, charisma: 3, intelligence: 4, agility: 6, luck: 4 },
    maxHp: 40, armorClass: 20, maxAP: 9, sequence: 10,
    skills: { ...defaultSkills(), smallGuns: 60, meleeWeapons: 50, unarmed: 45, firstAid: 25, sneak: 35 },
    equippedWeaponId: 'assault_rifle', inventoryWeaponIds: ['assault_rifle', '10mm_pistol', 'machete', 'frag_grenade'], equippedBodyArmorId: 'metal_armor',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'raider_warlord', name: 'Raider Warlord', category: 'human',
    description: 'The brutal leader of a raider band. Feared and obeyed by all.',
    special: { strength: 8, perception: 6, endurance: 7, charisma: 5, intelligence: 5, agility: 6, luck: 5 },
    maxHp: 60, armorClass: 22, maxAP: 9, sequence: 12,
    skills: { ...defaultSkills(), smallGuns: 75, meleeWeapons: 65, unarmed: 60, bigGuns: 40, firstAid: 40, speech: 35 },
    equippedWeaponId: 'combat_shotgun', inventoryWeaponIds: ['combat_shotgun', 'desert_eagle', 'sledgehammer', 'frag_grenade'], equippedBodyArmorId: 'reaver_banding',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'tribal_warrior', name: 'Tribal Warrior', category: 'human',
    description: 'A wasteland tribesman skilled in primitive combat.',
    special: { strength: 6, perception: 6, endurance: 6, charisma: 4, intelligence: 3, agility: 7, luck: 5 },
    maxHp: 38, armorClass: 12, maxAP: 10, sequence: 12,
    skills: { ...defaultSkills(), meleeWeapons: 55, unarmed: 50, throwing: 40, sneak: 45, outdoorsman: 60 },
    equippedWeaponId: 'spear', inventoryWeaponIds: ['spear', 'knife', 'sharpened_pole_throwing'],
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'ncr_trooper', name: 'NCR Trooper', category: 'human',
    description: 'A disciplined soldier of the New California Republic.',
    special: { strength: 5, perception: 6, endurance: 5, charisma: 4, intelligence: 5, agility: 5, luck: 4 },
    maxHp: 42, armorClass: 22, maxAP: 8, sequence: 12,
    skills: { ...defaultSkills(), smallGuns: 65, meleeWeapons: 40, firstAid: 45, speech: 35, outdoorsman: 40 },
    equippedWeaponId: 'assault_rifle', inventoryWeaponIds: ['assault_rifle', 'vp91z_m9_fs_9mm_beretta_pistol', 'combat_knife', 'frag_grenade'], equippedBodyArmorId: 'combat_armor', equippedHelmetId: 'combat_helmet',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'brotherhood_paladin', name: 'Brotherhood Paladin', category: 'human',
    description: 'An elite soldier of the Brotherhood of Steel in full power armor.',
    special: { strength: 7, perception: 6, endurance: 7, charisma: 4, intelligence: 6, agility: 5, luck: 5 },
    maxHp: 70, armorClass: 35, maxAP: 8, sequence: 12,
    skills: { ...defaultSkills(), smallGuns: 80, energyWeapons: 70, meleeWeapons: 65, repair: 60, science: 50 },
    equippedWeaponId: 'laser_rifle', inventoryWeaponIds: ['laser_rifle', 'laser_pistol', 'super_sledge', 'pulse_grenade'], equippedBodyArmorId: 'brotherhood_power_armor', equippedHelmetId: 'power_helmet',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'enclave_soldier', name: 'Enclave Soldier', category: 'human',
    description: 'A highly trained soldier of the remnant Enclave government.',
    special: { strength: 6, perception: 7, endurance: 6, charisma: 3, intelligence: 6, agility: 6, luck: 4 },
    maxHp: 65, armorClass: 30, maxAP: 9, sequence: 14,
    skills: { ...defaultSkills(), smallGuns: 80, energyWeapons: 75, meleeWeapons: 55, science: 60, repair: 55 },
    equippedWeaponId: 'plasma_rifle', inventoryWeaponIds: ['plasma_rifle', 'plasma_pistol', 'combat_knife', 'plasma_grenade'], equippedBodyArmorId: 'adv_power_armor', equippedHelmetId: 'power_helmet',
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  },

  {
    id: 'feral_ghoul', name: 'Feral Ghoul', category: 'ghoul',
    description: 'A ghoul that has lost its mind to radiation and feral instinct.',
    special: { strength: 5, perception: 6, endurance: 6, charisma: 1, intelligence: 1, agility: 7, luck: 4 },
    maxHp: 30, armorClass: 10, maxAP: 10, sequence: 12,
    skills: { ...defaultSkills(), unarmed: 55, meleeWeapons: 45, sneak: 30 },
    equippedWeaponId: 'unarmed',
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'ghoul_roamer', name: 'Ghoul Roamer', category: 'ghoul',
    description: 'A feral ghoul that has survived long enough to become particularly dangerous.',
    special: { strength: 6, perception: 7, endurance: 7, charisma: 1, intelligence: 2, agility: 7, luck: 5 },
    maxHp: 45, armorClass: 12, maxAP: 10, sequence: 14,
    skills: { ...defaultSkills(), unarmed: 70, meleeWeapons: 55, sneak: 40 },
    equippedWeaponId: 'unarmed',
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'glowing_one', name: 'Glowing One', category: 'ghoul',
    description: 'An irradiated ghoul that glows with deadly radiation.',
    special: { strength: 5, perception: 7, endurance: 9, charisma: 1, intelligence: 2, agility: 6, luck: 5 },
    maxHp: 55, armorClass: 10, maxAP: 9, sequence: 14,
    skills: { ...defaultSkills(), unarmed: 60, meleeWeapons: 50 },
    equippedWeaponId: 'unarmed',
    radiationResistance: 100, gasResistance: 0, electricityResistance: 0,
  },
  {
    id: 'reaver_ghoul', name: 'Reaver Ghoul', category: 'ghoul',
    description: 'An organized and armed ghoul still capable of using weapons.',
    special: { strength: 5, perception: 8, endurance: 7, charisma: 3, intelligence: 6, agility: 6, luck: 5 },
    maxHp: 50, armorClass: 15, maxAP: 9, sequence: 16,
    skills: { ...defaultSkills(), smallGuns: 50, meleeWeapons: 45, unarmed: 40, firstAid: 30, science: 30 },
    equippedWeaponId: 'hunting_rifle', inventoryWeaponIds: ['hunting_rifle', '10mm_pistol', 'knife', 'molotov'], equippedBodyArmorId: 'superior_ghoul_armor',
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
  },

  {
    id: 'super_mutant_grunt', name: 'Super Mutant', category: 'mutant',
    description: 'A standard FEV-enhanced super mutant. Strong and hard to kill.',
    special: { strength: 9, perception: 5, endurance: 9, charisma: 2, intelligence: 3, agility: 5, luck: 4 },
    maxHp: 65, armorClass: 10, maxAP: 8, sequence: 10,
    skills: { ...defaultSkills(), smallGuns: 50, bigGuns: 40, meleeWeapons: 55, unarmed: 60, firstAid: 20 },
    equippedWeaponId: 'assault_rifle', inventoryWeaponIds: ['assault_rifle', 'super_sledge', 'frag_grenade'], equippedBodyArmorId: 'mutant_plate_armor',
    naturalProtection: natural([0, 0, 0, 0, 0], [25, 15, 15, 15, 15]),
    radiationResistance: 10, gasResistance: 10, electricityResistance: 0,
  },
  {
    id: 'super_mutant_brute', name: 'Super Mutant Brute', category: 'mutant',
    description: 'A larger, meaner super mutant that uses big guns without penalty.',
    special: { strength: 11, perception: 5, endurance: 11, charisma: 2, intelligence: 3, agility: 4, luck: 4 },
    maxHp: 90, armorClass: 10, maxAP: 7, sequence: 10,
    skills: { ...defaultSkills(), smallGuns: 55, bigGuns: 65, meleeWeapons: 70, unarmed: 70 },
    equippedWeaponId: 'minigun', inventoryWeaponIds: ['minigun', 'super_sledge', 'frag_grenade'], equippedBodyArmorId: 'mutant_plate_armor',
    naturalProtection: natural([0, 0, 0, 0, 0], [30, 20, 20, 20, 20]),
    radiationResistance: 15, gasResistance: 15, electricityResistance: 0,
  },
  {
    id: 'super_mutant_overlord', name: 'Super Mutant Overlord', category: 'mutant',
    description: 'An ancient and powerful super mutant commander.',
    special: { strength: 12, perception: 7, endurance: 12, charisma: 4, intelligence: 6, agility: 6, luck: 6 },
    maxHp: 120, armorClass: 15, maxAP: 9, sequence: 14,
    skills: { ...defaultSkills(), smallGuns: 75, bigGuns: 80, energyWeapons: 65, meleeWeapons: 80, unarmed: 80 },
    equippedWeaponId: 'bozar', inventoryWeaponIds: ['bozar', 'super_sledge', 'plasma_grenade'], equippedBodyArmorId: 'spiked_mutant_plate_armor',
    naturalProtection: natural([0, 0, 0, 0, 0], [35, 25, 25, 25, 25]),
    radiationResistance: 20, gasResistance: 20, electricityResistance: 0,
  },
  {
    id: 'nightkin', name: 'Nightkin', category: 'mutant',
    description: 'Elite super mutants that use Stealth Boys. Highly dangerous ambush predators.',
    special: { strength: 10, perception: 6, endurance: 10, charisma: 2, intelligence: 5, agility: 8, luck: 5 },
    maxHp: 80, armorClass: 20, maxAP: 11, sequence: 12,
    skills: { ...defaultSkills(), smallGuns: 60, meleeWeapons: 75, unarmed: 70, sneak: 80 },
    equippedWeaponId: 'super_sledge', inventoryWeaponIds: ['super_sledge', 'plasma_pistol'], equippedBodyArmorId: 'mutant_plate_armor',
    naturalProtection: natural([0, 0, 0, 0, 0], [25, 20, 15, 20, 15]),
    radiationResistance: 10, gasResistance: 10, electricityResistance: 0,
  },

  {
    id: 'protectron', name: 'Protectron', category: 'robot',
    description: 'A pre-war service robot repurposed for combat. Slow but durable.',
    special: { strength: 6, perception: 7, endurance: 9, charisma: 1, intelligence: 5, agility: 3, luck: 2 },
    maxHp: 55, armorClass: 15, maxAP: 6, sequence: 14,
    skills: { ...defaultSkills(), unarmed: 45, energyWeapons: 50 },
    equippedWeaponId: 'laser_pistol',
    naturalProtection: natural([6, 4, 4, 2, 6], [40, 40, 30, 20, 40]),
    radiationResistance: 100, gasResistance: 100, poisonResistance: 100, electricityResistance: -50,
  },
  {
    id: 'mr_handy', name: 'Mr. Handy', category: 'robot',
    description: 'A hovering household robot with a buzzsaw and torch attachment.',
    special: { strength: 5, perception: 8, endurance: 7, charisma: 5, intelligence: 7, agility: 7, luck: 3 },
    maxHp: 50, armorClass: 20, maxAP: 10, sequence: 16,
    skills: { ...defaultSkills(), meleeWeapons: 55, energyWeapons: 40, repair: 70, science: 60 },
    equippedWeaponId: 'ripper',
    naturalProtection: natural([5, 3, 3, 2, 5], [35, 35, 25, 15, 35]),
    radiationResistance: 100, gasResistance: 100, poisonResistance: 100, electricityResistance: -50,
  },
  {
    id: 'sentry_bot', name: 'Sentry Bot', category: 'robot',
    description: 'A heavily armed military robot. Minigun and rocket launcher equipped.',
    special: { strength: 10, perception: 9, endurance: 11, charisma: 1, intelligence: 5, agility: 5, luck: 3 },
    maxHp: 100, armorClass: 20, maxAP: 8, sequence: 18,
    skills: { ...defaultSkills(), bigGuns: 80, smallGuns: 70, energyWeapons: 60 },
    equippedWeaponId: 'minigun',
    naturalProtection: natural([12, 8, 8, 6, 12], [50, 50, 40, 30, 50]),
    radiationResistance: 100, gasResistance: 100, poisonResistance: 100, electricityResistance: -50,
  },
  {
    id: 'eyebot', name: 'Eyebot', category: 'robot',
    description: 'A small floating surveillance drone with a laser.',
    special: { strength: 3, perception: 12, endurance: 3, charisma: 1, intelligence: 6, agility: 12, luck: 5 },
    maxHp: 20, armorClass: 25, maxAP: 14, sequence: 24,
    skills: { ...defaultSkills(), energyWeapons: 55 },
    equippedWeaponId: 'laser_pistol',
    naturalProtection: natural([2, 1, 1, 1, 2], [20, 20, 15, 10, 20]),
    radiationResistance: 100, gasResistance: 100, poisonResistance: 100, electricityResistance: -50,
  },
];

/** Legacy humans, ghouls, and super mutants calculate AC from visible sources.
 * Robots retain their historical printed AC as a chassis/creature statistic. */
export const RESTORED_BESTIARY: BestiaryTemplate[] = RESTORED_BESTIARY_ENTRIES.map(template => (
  template.category === 'robot'
    ? template
    : { ...template, armorClass: 0, usesDerivedArmorClass: true }
));