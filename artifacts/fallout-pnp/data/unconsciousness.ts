export const DEFAULT_MANUAL_UNCONSCIOUS_ROUNDS = 1;

export function setUnconsciousness<
  T extends { isKnockedOut: boolean; knockOutRoundsLeft: number },
>(character: T, rounds: number = DEFAULT_MANUAL_UNCONSCIOUS_ROUNDS): T {
  const normalizedRounds = Math.max(0, Math.round(rounds));
  return {
    ...character,
    isKnockedOut: normalizedRounds > 0,
    knockOutRoundsLeft: normalizedRounds,
  };
}

export function clearUnconsciousness<
  T extends { isKnockedOut: boolean; knockOutRoundsLeft: number },
>(character: T): T {
  return {
    ...character,
    isKnockedOut: false,
    knockOutRoundsLeft: 0,
  };
}