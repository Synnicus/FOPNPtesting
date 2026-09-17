import type {
  BestiaryAttack,
  BestiaryCategory,
  BestiaryTemplate,
  Character,
  CharacterSkills,
  NaturalProtection,
  SPECIALStats,
  Weapon,
} from '../context/types.ts';
import { RESTORED_BESTIARY } from './legacyBestiary.ts';
export { RESTORED_BESTIARY };

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

interface ManualEntry {
  id: string;
  name: string;
  category?: 'beast' | 'mutant';
  description: string;
  hp: number;
  sequence: number;
  ap: number;
  xp: number;
  criticalChance: number;
  ac: number;
  protection: NaturalProtection;
  poison: number;
  radiation: number;
  gas: [number, number];
  attacks: BestiaryAttack[];
}

/**
 * Part V prints combat statistics, not SPECIAL attributes. These internal
 * values only support generic character-sheet calculations; manual AC, AP,
 * Sequence, attacks, and skills remain explicit and authoritative.
 */
function engineSpecial(sequence: number, maxAP: number): SPECIALStats {
  return {
    strength: 5,
    perception: Math.max(1, Math.ceil(sequence / 2)),
    endurance: 5,
    charisma: 1,
    intelligence: 1,
    agility: Math.max(1, (maxAP - 5) * 2),
    luck: 5,
  };
}

function manualTemplate(entry: ManualEntry): BestiaryTemplate {
  const averageHitChance = Math.round(
    entry.attacks.reduce((total, attack) => total + attack.hitChance, 0) / entry.attacks.length,
  );
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category ?? 'beast',
    description: entry.description,
    special: engineSpecial(entry.sequence, entry.ap),
    maxHp: entry.hp,
    armorClass: entry.ac,
    maxAP: entry.ap,
    sequence: entry.sequence,
    xpValue: entry.xp,
    criticalChance: entry.criticalChance,
    skills: { ...defaultSkills(), unarmed: averageHitChance },
    equippedWeaponId: entry.attacks[0]?.weaponId,
    naturalAttacks: entry.attacks,
    naturalProtection: entry.protection,
    poisonResistance: entry.poison,
    radiationResistance: entry.radiation,
    gasResistance: entry.gas[0],
    gasResistanceSecondary: entry.gas[1],
    electricityResistance: 0,
  };
}

const none = natural([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]);
const lesserMoleratProtection = natural([1, 0, 0, 0, 1], [5, 0, 0, 0, 5]);
const alienProtection = natural([10, 1, 5, 1, 10], [95, 10, 40, 10, 90]);
const radscorpionProtection = natural([1, 0, 4, 0, 1], [5, 0, 20, 0, 5]);

export const EXPECTED_MANUAL_BESTIARY_IDS = [
  'giant_rat', 'rad_rat',
  'lesser_molerat', 'greater_molerat',
  'lesser_pigrat', 'greater_pigrat',
  'giant_cockroaches', 'giant_ants', 'mantis',
  'brahmin',
  'floater', 'crawler', 'flailer', 'centaur',
  'lesser_radscorpion', 'greater_radscorpion',
  'grey_wolf', 'dire_wolf', 'coyote', 'feral_dog', 'dog',
  'deathclaw', 'spitting_plant',
  'gecko', 'fire_gecko', 'golden_gecko',
] as const;

export const MANUAL_BESTIARY: BestiaryTemplate[] = [
  manualTemplate({
    id: 'giant_rat', name: 'Giant Rat',
    description: 'Large pack-hunting wasteland rat.',
    hp: 10, sequence: 6, ap: 6, xp: 25, criticalChance: 3, ac: 5,
    protection: none, poison: 50, radiation: 20, gas: [0, 0],
    attacks: [
      { weaponId: 'giant_rat_claw', hitChance: 75 },
      { weaponId: 'giant_rat_bite', hitChance: 70, notes: 'Poison Type A' },
    ],
  }),
  manualTemplate({
    id: 'rad_rat', name: 'Rad Rat',
    description: 'Radioactive rat whose claws and bite transfer radiation.',
    hp: 10, sequence: 6, ap: 6, xp: 35, criticalChance: 3, ac: 5,
    protection: none, poison: 60, radiation: 100, gas: [0, 50],
    attacks: [
      { weaponId: 'giant_rat_claw', hitChance: 75, notes: 'Successful hit adds 10 rads' },
      { weaponId: 'rad_rat_bite', hitChance: 70, notes: 'Successful hit adds 10 rads' },
    ],
  }),
  manualTemplate({
    id: 'lesser_molerat', name: 'Lesser Molerat',
    description: 'Small cave-dwelling molerat.',
    hp: 15, sequence: 7, ap: 7, xp: 100, criticalChance: 3, ac: 9,
    protection: lesserMoleratProtection, poison: 50, radiation: 25, gas: [0, 0],
    attacks: [
      { weaponId: 'lesser_molerat_claw', hitChance: 80 },
      { weaponId: 'lesser_molerat_bite', hitChance: 75, notes: 'Poison Type A' },
    ],
  }),
  manualTemplate({
    id: 'greater_molerat', name: 'Greater Molerat',
    description: 'Large and heavily protected molerat.',
    hp: 30, sequence: 9, ap: 9, xp: 400, criticalChance: 5, ac: 12,
    protection: natural([4, 1, 0, 0, 4], [20, 5, 0, 0, 20]),
    poison: 60, radiation: 25, gas: [0, 25],
    attacks: [
      { weaponId: 'greater_molerat_claw', hitChance: 90 },
      { weaponId: 'greater_molerat_bite', hitChance: 90, notes: 'Poison Type B' },
    ],
  }),
  manualTemplate({
    id: 'lesser_pigrat', name: 'Lesser Pigrat',
    description: 'Large, territorial rat-pig hybrid.',
    hp: 20, sequence: 7, ap: 7, xp: 200, criticalChance: 4, ac: 10,
    protection: natural([1, 0, 0, 0, 0], [5, 0, 0, 0, 5]),
    poison: 50, radiation: 30, gas: [0, 10],
    attacks: [
      { weaponId: 'lesser_pigrat_claw', hitChance: 75 },
      { weaponId: 'lesser_pigrat_bite', hitChance: 75, notes: 'Poison Type A' },
    ],
  }),
  manualTemplate({
    id: 'greater_pigrat', name: 'Greater Pigrat',
    description: 'Large and exceptionally dangerous pigrat.',
    hp: 30, sequence: 9, ap: 9, xp: 450, criticalChance: 6, ac: 14,
    protection: natural([4, 0, 2, 0, 4], [25, 0, 10, 0, 25]),
    poison: 70, radiation: 45, gas: [0, 20],
    attacks: [
      { weaponId: 'greater_pigrat_claw', hitChance: 90 },
      { weaponId: 'greater_pigrat_bite', hitChance: 75, notes: 'Poison Type B' },
    ],
  }),
  manualTemplate({
    id: 'giant_cockroaches', name: 'Giant Cockroaches',
    description: 'Cluster-forming mutant cockroaches.',
    hp: 15, sequence: 6, ap: 6, xp: 50, criticalChance: 4, ac: 5,
    protection: natural([3, 0, 0, 0, 0], [30, 0, 0, 0, 0]),
    poison: 100, radiation: 95, gas: [80, 100],
    attacks: [{ weaponId: 'cockroach_mandible', hitChance: 60, notes: 'Poison Type B' }],
  }),
  manualTemplate({
    id: 'giant_ants', name: 'Giant Ants',
    description: 'Overgrown radioactive ants that hunt in groups.',
    hp: 15, sequence: 6, ap: 6, xp: 50, criticalChance: 3, ac: 2,
    protection: none, poison: 100, radiation: 60, gas: [60, 90],
    attacks: [{ weaponId: 'giant_ant_mandibles', hitChance: 60, notes: 'Poison Type A' }],
  }),
  manualTemplate({
    id: 'mantis', name: 'Mantis',
    description: 'Giant mutant praying mantis.',
    hp: 10, sequence: 7, ap: 7, xp: 50, criticalChance: 2, ac: 5,
    protection: none, poison: 75, radiation: 80, gas: [60, 90],
    attacks: [
      { weaponId: 'mantis_mandible', hitChance: 70, notes: 'Poison Type B' },
      { weaponId: 'mantis_claw', hitChance: 75 },
    ],
  }),
  manualTemplate({
    id: 'brahmin', name: 'Brahmin',
    description: 'Two-headed mutant cattle, usually docile unless threatened.',
    hp: 40, sequence: 6, ap: 6, xp: 50, criticalChance: 2, ac: 5,
    protection: natural([2, 0, 0, 0, 2], [10, 0, 0, 0, 10]),
    poison: 20, radiation: 30, gas: [0, 10],
    attacks: [{ weaponId: 'brahmin_horn', hitChance: 75 }],
  }),
  manualTemplate({
    id: 'floater', name: 'Floater', category: 'mutant',
    description: 'Floating alien creature that attacks with a spiked stalk.',
    hp: 60, sequence: 9, ap: 9, xp: 500, criticalChance: 8, ac: 20,
    protection: alienProtection, poison: 80, radiation: 80, gas: [100, 90],
    attacks: [{ weaponId: 'floater_stalk', hitChance: 80 }],
  }),
  manualTemplate({
    id: 'crawler', name: 'Crawler', category: 'mutant',
    description: 'Ground-dwelling relative of the floater with a heavy stalk.',
    hp: 60, sequence: 9, ap: 9, xp: 600, criticalChance: 7, ac: 20,
    protection: alienProtection, poison: 90, radiation: 80, gas: [100, 100],
    attacks: [{ weaponId: 'crawler_stalk', hitChance: 90 }],
  }),
  manualTemplate({
    id: 'flailer', name: 'Flailer', category: 'mutant',
    description: 'Bipedal alien creature with flailing tentacles and sharp teeth.',
    hp: 60, sequence: 9, ap: 9, xp: 750, criticalChance: 8, ac: 25,
    protection: alienProtection, poison: 95, radiation: 100, gas: [100, 100],
    attacks: [
      { weaponId: 'flailer_flail', hitChance: 90 },
      { weaponId: 'flailer_bite', hitChance: 90, notes: 'Poison Type D' },
    ],
  }),
  manualTemplate({
    id: 'centaur', name: 'Centaur', category: 'mutant',
    description: 'Twisted multi-limbed alien creature.',
    hp: 60, sequence: 9, ap: 9, xp: 750, criticalChance: 8, ac: 25,
    protection: alienProtection, poison: 50, radiation: 80, gas: [40, 70],
    attacks: [{ weaponId: 'centaur_swing', hitChance: 90 }],
  }),
  manualTemplate({
    id: 'lesser_radscorpion', name: 'Lesser Radscorpion',
    description: 'Large mutated scorpion with a venomous tail.',
    hp: 25, sequence: 8, ap: 8, xp: 200, criticalChance: 4, ac: 7,
    protection: radscorpionProtection, poison: 100, radiation: 25, gas: [30, 100],
    attacks: [{ weaponId: 'lesser_radscorpion_tail', hitChance: 70, notes: 'Poison Type D' }],
  }),
  manualTemplate({
    id: 'greater_radscorpion', name: 'Greater Radscorpion',
    description: 'Larger and deadlier mutated scorpion.',
    hp: 35, sequence: 8, ap: 8, xp: 400, criticalChance: 5, ac: 10,
    protection: radscorpionProtection, poison: 100, radiation: 50, gas: [50, 100],
    attacks: [{ weaponId: 'greater_radscorpion_tail', hitChance: 80, notes: 'Poison Type D' }],
  }),
  manualTemplate({
    id: 'grey_wolf', name: 'Grey Wolf',
    description: 'Social pack-hunting wolf.',
    hp: 20, sequence: 6, ap: 6, xp: 100, criticalChance: 5, ac: 5,
    protection: none, poison: 25, radiation: 15, gas: [0, 0],
    attacks: [
      { weaponId: 'grey_wolf_bite', hitChance: 80 },
      { weaponId: 'grey_wolf_claw', hitChance: 70 },
    ],
  }),
  manualTemplate({
    id: 'dire_wolf', name: 'Dire Wolf',
    description: 'Huge and exceptionally dangerous wolf.',
    hp: 60, sequence: 9, ap: 9, xp: 700, criticalChance: 7, ac: 9,
    protection: natural([5, 0, 0, 0, 0], [40, 0, 0, 0, 0]),
    poison: 40, radiation: 20, gas: [0, 0],
    attacks: [
      { weaponId: 'dire_wolf_bite', hitChance: 90 },
      { weaponId: 'dire_wolf_claw', hitChance: 80, notes: 'Roll against EN to avoid knockdown' },
    ],
  }),
  manualTemplate({
    id: 'coyote', name: 'Coyote',
    description: 'Solitary wasteland scavenger and hunter.',
    hp: 20, sequence: 6, ap: 6, xp: 100, criticalChance: 5, ac: 3,
    protection: none, poison: 20, radiation: 10, gas: [0, 0],
    attacks: [{ weaponId: 'coyote_bite', hitChance: 70 }],
  }),
  manualTemplate({
    id: 'feral_dog', name: 'Feral Dog',
    description: 'Wild dog that roams in packs.',
    hp: 20, sequence: 6, ap: 6, xp: 100, criticalChance: 4, ac: 3,
    protection: none, poison: 20, radiation: 10, gas: [0, 0],
    attacks: [{ weaponId: 'feral_dog_bite', hitChance: 70 }],
  }),
  manualTemplate({
    id: 'dog', name: 'Dog',
    description: 'Loyal domesticated canine.',
    hp: 20, sequence: 6, ap: 6, xp: 100, criticalChance: 3, ac: 5,
    protection: none, poison: 18, radiation: 8, gas: [0, 0],
    attacks: [{ weaponId: 'dog_bite', hitChance: 80, notes: 'Roll against DEX to avoid knockdown' }],
  }),
  manualTemplate({
    id: 'deathclaw', name: 'Deathclaw',
    description: 'Large, intelligent mutated lizard with foot-long claws.',
    hp: 70, sequence: 10, ap: 10, xp: 800, criticalChance: 9, ac: 25,
    protection: natural([4, 0, 4, 0, 4], [40, 0, 40, 0, 40]),
    poison: 80, radiation: 60, gas: [0, 40],
    attacks: [
      { weaponId: 'deathclaw_claw', hitChance: 90 },
      { weaponId: 'deathclaw_bite', hitChance: 80 },
    ],
  }),
  manualTemplate({
    id: 'spitting_plant', name: 'Spitting Plant',
    description: 'Immobile carnivorous plant that launches sharp thorns.',
    hp: 50, sequence: 8, ap: 8, xp: 100, criticalChance: 2, ac: 5,
    protection: none, poison: 100, radiation: 95, gas: [100, 100],
    attacks: [{ weaponId: 'spitting_plant_thorn', hitChance: 75 }],
  }),
  manualTemplate({
    id: 'gecko', name: 'Gecko',
    description: 'Large desert-dwelling mutant lizard.',
    hp: 30, sequence: 7, ap: 7, xp: 150, criticalChance: 2, ac: 5,
    protection: natural([1, 0, 0, 0, 0], [10, 0, 0, 0, 0]),
    poison: 80, radiation: 75, gas: [0, 10],
    attacks: [
      { weaponId: 'gecko_claw', hitChance: 75 },
      { weaponId: 'gecko_bite', hitChance: 70 },
    ],
  }),
  manualTemplate({
    id: 'fire_gecko', name: 'Fire Gecko',
    description: 'More resilient gecko with a poisonous bite.',
    hp: 40, sequence: 9, ap: 9, xp: 300, criticalChance: 4, ac: 8,
    protection: natural([3, 0, 3, 0, 2], [30, 0, 30, 0, 10]),
    poison: 80, radiation: 80, gas: [0, 20],
    attacks: [
      { weaponId: 'gecko_claw', hitChance: 75 },
      { weaponId: 'fire_gecko_bite', hitChance: 80, notes: 'Poison Type B' },
    ],
  }),
  manualTemplate({
    id: 'golden_gecko', name: 'Golden Gecko',
    description: 'Large, highly resistant gecko.',
    hp: 50, sequence: 9, ap: 9, xp: 400, criticalChance: 5, ac: 10,
    protection: natural([5, 0, 5, 0, 2], [50, 0, 50, 0, 10]),
    poison: 100, radiation: 100, gas: [0, 50],
    attacks: [
      { weaponId: 'golden_gecko_claw', hitChance: 90 },
      { weaponId: 'golden_gecko_bite', hitChance: 85 },
    ],
  }),
];

export const BUILT_IN_BESTIARY: BestiaryTemplate[] = [
  ...MANUAL_BESTIARY,
  ...RESTORED_BESTIARY,
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
  return BUILT_IN_BESTIARY.find(template => template.id === id);
}

export function spawnBestiaryTemplate(
  template: BestiaryTemplate,
  allWeapons: readonly Weapon[],
  name: string,
  id: string,
): Character {
  const naturalAttacks = template.naturalAttacks ?? [];
  const equippedWeaponId = template.equippedWeaponId ?? naturalAttacks[0]?.weaponId;
  const secondaryNaturalWeaponId = naturalAttacks[1]?.weaponId;
  const inventoryIds = Array.from(new Set([
    ...(equippedWeaponId ? [equippedWeaponId] : []),
    ...(secondaryNaturalWeaponId ? [secondaryNaturalWeaponId] : []),
    ...(template.inventoryWeaponIds ?? []),
  ]));
  for (const weaponId of new Set([...inventoryIds, ...naturalAttacks.map(attack => attack.weaponId)])) {
    if (!allWeapons.some(weapon => weapon.id === weaponId)) {
      throw new Error(`${template.name} references missing weapon: ${weaponId}`);
    }
  }
  const equippedWeapon = allWeapons.find(weapon => weapon.id === equippedWeaponId);

  return {
    id,
    name,
    type: 'npc',
    race: template.category === 'robot' ? 'robot' : 'customRace',
    level: 1,
    xp: 0,
    special: { ...template.special },
    maxHp: template.maxHp,
    currentHp: template.maxHp,
    armorClass: template.armorClass,
    usesDerivedArmorClass: template.usesDerivedArmorClass,
    tempAC: 0,
    maxAP: template.maxAP,
    currentAP: template.maxAP,
    position: 'standing',
    sequence: template.sequence,
    manualDerivedStats: {
      armorClass: template.armorClass,
      maxAP: template.maxAP,
      sequence: template.sequence,
      criticalChance: template.criticalChance,
      baseMaxHp: template.maxHp,
    },
    skills: { ...template.skills },
    taggedSkills: [],
    unspentSkillPoints: 0,
    perks: [],
    radiationResistance: template.radiationResistance,
    gasResistance: template.gasResistance,
    gasResistanceSecondary: template.gasResistanceSecondary,
    poisonResistance: template.category === 'robot' ? 100 : (template.poisonResistance ?? 0),
    electricityResistance: template.electricityResistance,
    naturalProtection: template.naturalProtection ? { ...template.naturalProtection } : undefined,
    equippedWeaponId,
    rightHandWeaponId: equippedWeaponId,
    leftHandWeaponId: secondaryNaturalWeaponId
      ?? (equippedWeapon?.hands === 2 ? equippedWeaponId : undefined),
    inventoryWeaponIds: inventoryIds.length > 0 ? inventoryIds : undefined,
    equippedBodyArmorId: template.equippedBodyArmorId,
    equippedHelmetId: template.equippedHelmetId,
    naturalAttacks: naturalAttacks.map(attack => ({ ...attack })),
    bestiaryTemplateId: template.id,
    xpValue: template.xpValue,
    weaponAmmoStates: inventoryIds
      .map(weaponId => allWeapons.find(weapon => weapon.id === weaponId))
      .filter((weapon): weapon is Weapon => !!weapon && weapon.magazineSize > 0)
      .map(weapon => ({
        weaponId: weapon.id,
        currentAmmo: weapon.magazineSize,
        conditionBoxes: 0,
      })),
    injuries: [],
    isKnockedOut: false,
    knockOutRoundsLeft: 0,
    conditions: [],
  };
}