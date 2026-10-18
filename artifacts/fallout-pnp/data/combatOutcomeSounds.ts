export type CombatOutcomeSoundKind = 'miss' | 'critical';

export interface CombatOutcomeShot {
  hit: boolean;
  isCrit: boolean;
}

export interface CombatOutcomeSoundPlayer {
  volume: number;
  seekTo: (seconds: number) => Promise<void>;
  play: () => void;
}

export type CombatOutcomeSoundPlayers = Record<
  CombatOutcomeSoundKind,
  CombatOutcomeSoundPlayer
>;

export function getCombatOutcomeSoundKind(
  shots: readonly CombatOutcomeShot[],
): CombatOutcomeSoundKind | null {
  if (shots.some(shot => shot.hit && shot.isCrit)) return 'critical';
  if (shots.length > 0 && shots.every(shot => !shot.hit)) return 'miss';
  return null;
}

export function requestCombatOutcomeSound(
  kind: CombatOutcomeSoundKind,
  players: CombatOutcomeSoundPlayers,
  isCombatSoundsEnabled: () => boolean,
): void {
  if (!isCombatSoundsEnabled()) return;

  const player = players[kind];
  player.volume = 0.6;
  void player.seekTo(0)
    .then(() => {
      if (isCombatSoundsEnabled()) player.play();
    })
    .catch(() => {});
}
