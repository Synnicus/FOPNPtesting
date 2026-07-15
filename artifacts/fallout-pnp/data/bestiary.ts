import { BestiaryTemplate } from '@/context/types';

export const BESTIARY_TEMPLATES: BestiaryTemplate[] = [
  // ─── Raiders ────────────────────────────────────────────────
  {
    id: 'bt_raider_scav',
    name: 'Raider Scavenger',
    category: 'Raiders',
    variant: 'Scavenger',
    maxHp: 20,
    evasion: 25,
    skills: { firearms: 30, melee: 25, unarmed: 20 },
    equippedWeaponId: 'w_357_mag',
    equippedBodyArmorId: 'a_leather',
    equippedHelmetId: 'a_leather_helm',
  },
  {
    id: 'bt_raider_vet',
    name: 'Veteran Psycho Raider',
    category: 'Raiders',
    variant: 'Veteran Psycho',
    maxHp: 35,
    evasion: 30,
    skills: { firearms: 45, melee: 40, unarmed: 35 },
    equippedWeaponId: 'w_assault_rifle',
    equippedBodyArmorId: 'a_metal',
    equippedHelmetId: 'a_metal_helm',
  },

  // ─── Ghouls ─────────────────────────────────────────────────
  {
    id: 'bt_ghoul_rotting',
    name: 'Rotting Ghoul',
    category: 'Ghouls',
    variant: 'Rotting',
    maxHp: 15,
    evasion: 20,
    skills: { firearms: 0, melee: 30, unarmed: 35 },
    equippedWeaponId: 'w_fists',
    equippedBodyArmorId: 'a_clothing',
    equippedHelmetId: 'a_none_head',
  },
  {
    id: 'bt_ghoul_reaver',
    name: 'Reaver Ghoul',
    category: 'Ghouls',
    variant: 'Reaver',
    maxHp: 30,
    evasion: 30,
    skills: { firearms: 10, melee: 45, unarmed: 50 },
    equippedWeaponId: 'w_spiked_knuckles',
    equippedBodyArmorId: 'a_leather',
    equippedHelmetId: 'a_none_head',
  },

  // ─── Super Mutants ──────────────────────────────────────────
  {
    id: 'bt_mutant_init',
    name: 'Super Mutant Initiate',
    category: 'Super Mutants',
    variant: 'Initiate',
    maxHp: 40,
    evasion: 20,
    skills: { firearms: 35, melee: 40, unarmed: 45 },
    equippedWeaponId: 'w_hunting_rifle',
    equippedBodyArmorId: 'a_metal',
    equippedHelmetId: 'a_none_head',
  },
  {
    id: 'bt_mutant_over',
    name: 'Super Mutant Overlord',
    category: 'Super Mutants',
    variant: 'Overlord',
    maxHp: 70,
    evasion: 25,
    skills: { firearms: 50, melee: 55, unarmed: 60 },
    equippedWeaponId: 'w_minigun',
    equippedBodyArmorId: 'a_combat',
    equippedHelmetId: 'a_combat_helm',
  },

  // ─── Deathclaws ─────────────────────────────────────────────
  {
    id: 'bt_dc_young',
    name: 'Young Deathclaw',
    category: 'Deathclaws',
    variant: 'Young',
    maxHp: 50,
    evasion: 35,
    skills: { firearms: 0, melee: 55, unarmed: 60 },
    equippedWeaponId: 'w_dc_gauntlet',
    equippedBodyArmorId: 'a_clothing',
    equippedHelmetId: 'a_none_head',
  },
  {
    id: 'bt_dc_alpha',
    name: 'Alpha Male Deathclaw',
    category: 'Deathclaws',
    variant: 'Alpha Male',
    maxHp: 90,
    evasion: 40,
    skills: { firearms: 0, melee: 75, unarmed: 80 },
    equippedWeaponId: 'w_dc_gauntlet',
    equippedBodyArmorId: 'a_clothing',
    equippedHelmetId: 'a_none_head',
  },
];

export const BESTIARY_CATEGORIES = ['Raiders', 'Ghouls', 'Super Mutants', 'Deathclaws'] as const;
