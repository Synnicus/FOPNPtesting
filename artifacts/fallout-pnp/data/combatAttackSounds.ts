import type { DamageType, WeaponCategory } from '../context/types.ts';

export type CombatAttackSoundFamily = 'firearm' | 'blade' | 'blunt' | 'laser' | 'blast' | 'throw';

export interface CombatAttackSoundWeapon {
  category: WeaponCategory;
  damageType: DamageType;
  name: string;
}

const BLADED_WEAPON_NAME =
  /\b(?:blade|knife|sword|shiv|machete|cleaver|axe|ax|spear|scalpel|ripper|chainsaw|shredder|lacerator|claw|mandible|thorn)\b/i;

const SOUND_INTERVAL_MS: Record<CombatAttackSoundFamily, number> = {
  firearm: 270,
  blade: 410,
  blunt: 350,
  laser: 330,
  blast: 700,
  throw: 460,
};

export function getCombatAttackSoundFamily(
  weapon: CombatAttackSoundWeapon | null,
  isMeleeOrUnarmed = false,
  isExplosiveAttack = false,
): CombatAttackSoundFamily | null {
  if (isExplosiveAttack || weapon?.damageType === 'explosion') return 'blast';
  if (!weapon) return isMeleeOrUnarmed ? 'blunt' : null;

  if (weapon.category === 'energyWeapons') return 'laser';
  if (weapon.category === 'smallGuns' || weapon.category === 'bigGuns') return 'firearm';

  if (weapon.category === 'throwing') {
    return BLADED_WEAPON_NAME.test(weapon.name) ? 'blade' : 'throw';
  }

  if (weapon.category === 'natural' && !isMeleeOrUnarmed) return null;
  if (
    weapon.category === 'meleeWeapons'
    || weapon.category === 'unarmed'
    || weapon.category === 'natural'
  ) {
    return BLADED_WEAPON_NAME.test(weapon.name) ? 'blade' : 'blunt';
  }

  // A custom non-energy-category weapon may still explicitly deal energy damage.
  if (weapon.damageType === 'laser' || weapon.damageType === 'plasma') return 'laser';
  return null;
}

export function getCombatAttackSoundIntervalMs(family: CombatAttackSoundFamily): number {
  return SOUND_INTERVAL_MS[family];
}

export function getCombatAttackSoundShotCount(input: {
  isBurst: boolean;
  burstShots: number;
  doubleShotActive: boolean;
}): number {
  if (input.isBurst) {
    const shots = Number.isFinite(input.burstShots) ? Math.floor(input.burstShots) : 1;
    return Math.max(1, shots);
  }
  return input.doubleShotActive ? 2 : 1;
}
