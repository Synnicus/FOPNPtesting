import type { Character, Weapon } from '../context/types.ts';

/** Resolves the defender's displayed held weapon in active-hand priority order. */
export function resolveDefenderHandWeapon(
  character: Pick<Character, 'rightHandWeaponId' | 'equippedWeaponId' | 'leftHandWeaponId'>,
  weapons: readonly Weapon[],
): Weapon | null {
  return [
    character.rightHandWeaponId,
    character.equippedWeaponId,
    character.leftHandWeaponId,
  ]
    .map(id => id ? weapons.find(weapon => weapon.id === id) : undefined)
    .find((weapon): weapon is Weapon => !!weapon) ?? null;
}
