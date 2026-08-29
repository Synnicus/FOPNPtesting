export interface RefundablePerk {
  perkId: string;
  rank: number;
  takenAtLevel?: number;
}

export interface PerkRefundResult<T extends RefundablePerk> {
  perks: T[];
  refundedPoints: number;
}

/** Remove every rank and all acquisition metadata for one perk. */
export function refundPerk<T extends RefundablePerk>(
  perks: readonly T[],
  perkId: string,
): PerkRefundResult<T> {
  const removed = perks.find(perk => perk.perkId === perkId);
  return {
    perks: perks.filter(perk => perk.perkId !== perkId),
    refundedPoints: removed?.rank ?? 0,
  };
}