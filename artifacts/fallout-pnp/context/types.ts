export type DamageType = 'normal' | 'bio' | 'energy';
export type WeaponCategory = 'firearm' | 'energy' | 'melee' | 'unarmed';
export type ArmorSlot = 'body' | 'helmet';
export type CharacterType = 'pc' | 'npc';
export type SkillType = 'firearms' | 'melee' | 'unarmed';

export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  damageType: DamageType;
  damageDieCount: number;
  damageDie: number;
  damageBonus: number;
  burstLimit: number; // 0 = single shot only
  skill: SkillType;
  isCustom: boolean;
}

export interface Armor {
  id: string;
  name: string;
  slot: ArmorSlot;
  dtNormal: number;
  dtBio: number;
  dtEnergy: number;
  isCustom: boolean;
}

export interface CharacterSkills {
  firearms: number;
  melee: number;
  unarmed: number;
}

export interface Character {
  id: string;
  name: string;
  type: CharacterType;
  maxHp: number;
  currentHp: number;
  evasion: number;
  skills: CharacterSkills;
  equippedWeaponId: string | null;
  equippedBodyArmorId: string | null;
  equippedHelmetId: string | null;
  portrait: string | null; // base64 data URI
}

export interface BestiaryTemplate {
  id: string;
  name: string;
  category: string;
  variant: string;
  maxHp: number;
  evasion: number;
  skills: CharacterSkills;
  equippedWeaponId: string | null;
  equippedBodyArmorId: string | null;
  equippedHelmetId: string | null;
}

export interface ShotResult {
  index: number;
  penalty: number;
  attackTotal: number;
  hit: boolean;
  margin: number;
  cpsEarned: number;
}
