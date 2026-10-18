export interface CombatImpactPlayer {
  volume: number;
  seekTo: (seconds: number) => Promise<void>;
  play: () => void;
}

export interface CombatImpactResult {
  damage: number;
  radiationExposure?: number;
}

export function hasDirectCombatDamage(damage: number): boolean {
  return damage > 0;
}

export function hasAreaCombatDamage(results: readonly CombatImpactResult[]): boolean {
  return results.some(result => result.damage > 0);
}

export function requestCombatImpact(
  player: CombatImpactPlayer,
  isCombatSoundsEnabled: () => boolean,
): void {
  if (!isCombatSoundsEnabled()) return;

  player.volume = 0.55;
  void player.seekTo(0)
    .then(() => {
      if (isCombatSoundsEnabled()) player.play();
    })
    .catch(() => {});
}
