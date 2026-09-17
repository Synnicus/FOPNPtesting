/**
 * Static AC bonuses that always apply while a perk is owned.
 *
 * Keep situational bonuses (for example, bonuses that depend on current HP)
 * out of this table; combat resolves those separately.
 */
export const UNCONDITIONAL_ARMOR_CLASS_PERKS = {
  dodger: { armorClassBonus: 5 },
  tough_hide: { armorClassBonus: 15 },
  cyborg_systems: { armorClassBonus: 5 },
} as const;

export type UnconditionalArmorClassPerkId = keyof typeof UNCONDITIONAL_ARMOR_CLASS_PERKS;