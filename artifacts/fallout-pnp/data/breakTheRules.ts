/** Break the Rules never applies to purchasing itself; that purchase activates it. */
export function breakTheRulesWaivesRequirements(
  pending: boolean | undefined,
  perkId: string,
): boolean {
  return pending === true && perkId !== 'break_the_rules';
}

/** Persisted Break the Rules state after a successful perk-point purchase. */
export function breakTheRulesPendingAfterPurchase(
  currentlyPending: boolean | undefined,
  purchasedPerkId: string,
): boolean | undefined {
  if (purchasedPerkId === 'break_the_rules') return true;
  return currentlyPending ? false : currentlyPending;
}