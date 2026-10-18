import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import {
  getCombatOutcomeSoundKind,
  requestCombatOutcomeSound,
  type CombatOutcomeSoundKind,
  type CombatOutcomeSoundPlayer,
  type CombatOutcomeSoundPlayers,
} from './combatOutcomeSounds.ts';

const combatScreen = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

function createPlayers() {
  const calls: Record<CombatOutcomeSoundKind, { seekTo: number; play: number }> = {
    miss: { seekTo: 0, play: 0 },
    critical: { seekTo: 0, play: 0 },
  };
  const players = Object.fromEntries(
    (['miss', 'critical'] as const).map(kind => {
      const player: CombatOutcomeSoundPlayer = {
        volume: 1,
        seekTo: async seconds => {
          assert.equal(seconds, 0);
          calls[kind].seekTo += 1;
        },
        play: () => { calls[kind].play += 1; },
      };
      return [kind, player];
    }),
  ) as CombatOutcomeSoundPlayers;
  return { players, calls };
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test('outcome cues distinguish misses and critical hits, not ordinary hits', () => {
  assert.equal(getCombatOutcomeSoundKind([{ hit: false, isCrit: false }]), 'miss');
  assert.equal(getCombatOutcomeSoundKind([{ hit: true, isCrit: false }]), null);
  assert.equal(getCombatOutcomeSoundKind([{ hit: true, isCrit: true }]), 'critical');
  assert.equal(
    getCombatOutcomeSoundKind([{ hit: true, isCrit: true }, { hit: false, isCrit: false }]),
    'critical',
  );
  assert.equal(
    getCombatOutcomeSoundKind([{ hit: true, isCrit: false }, { hit: false, isCrit: false }]),
    null,
  );
  assert.equal(getCombatOutcomeSoundKind([]), null);
});

test('each outcome cue is silent when Combat Sounds is off and plays only its own player when on', async () => {
  for (const kind of ['miss', 'critical'] as const) {
    const muted = createPlayers();
    requestCombatOutcomeSound(kind, muted.players, () => false);
    await flushPromises();
    assert.deepEqual(muted.calls[kind], { seekTo: 0, play: 0 });

    const enabled = createPlayers();
    requestCombatOutcomeSound(kind, enabled.players, () => true);
    await flushPromises();
    assert.equal(enabled.players[kind].volume, 0.6);
    assert.deepEqual(enabled.calls[kind], { seekTo: 1, play: 1 });
    const otherKind = kind === 'miss' ? 'critical' : 'miss';
    assert.deepEqual(enabled.calls[otherKind], { seekTo: 0, play: 0 });
  }
});

test('turning Combat Sounds off while an outcome cue is seeking suppresses playback', async () => {
  let resolveSeek!: () => void;
  let enabled = true;
  const { players, calls } = createPlayers();
  players.miss.seekTo = async () => new Promise<void>(resolve => { resolveSeek = resolve; });
  requestCombatOutcomeSound('miss', players, () => enabled);
  enabled = false;
  resolveSeek();
  await flushPromises();
  assert.deepEqual(calls.miss, { seekTo: 0, play: 0 });
});

test('combat screen plays one gated outcome cue per resolved attack receipt', () => {
  assert.match(combatScreen, /useAudioPlayer\(require\('\.\.\/\.\.\/assets\/combat-miss\.wav'\)\)/);
  assert.match(combatScreen, /useAudioPlayer\(require\('\.\.\/\.\.\/assets\/combat-critical-hit\.wav'\)\)/);
  assert.match(combatScreen, /getCombatOutcomeSoundKind\(shotResults\)/);
  assert.match(combatScreen, /requestCombatOutcomeSound\(kind, combatOutcomeSoundPlayers, \(\) => combatSoundsEnabledRef\.current\)/);
  assert.match(combatScreen, /outcomeSoundReceiptRef\.current === receipt/);
  assert.match(combatScreen, /requestCombatImpact\(combatImpactPlayer, \(\) => combatSoundsEnabledRef\.current\)/);
});
