import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import {
  hasAreaCombatDamage,
  hasDirectCombatDamage,
  requestCombatImpact,
  type CombatImpactPlayer,
} from './combatImpact.ts';

const combatScreen = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const campaignOptionsModal = readFileSync(
  new URL('../components/CampaignOptionsModal.tsx', import.meta.url),
  'utf8',
);

function createPlayer(seekTo: () => Promise<void> = () => Promise.resolve()) {
  const calls = { seekTo: 0, play: 0 };
  const player: CombatImpactPlayer = {
    volume: 1,
    seekTo: async seconds => {
      assert.equal(seconds, 0);
      calls.seekTo += 1;
      await seekTo();
    },
    play: () => { calls.play += 1; },
  };
  return { player, calls };
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test('direct and area impacts require positive HP damage', () => {
  assert.equal(hasDirectCombatDamage(4), true);
  assert.equal(hasDirectCombatDamage(0), false);
  assert.equal(hasDirectCombatDamage(-1), false);

  assert.equal(hasAreaCombatDamage([]), false);
  assert.equal(hasAreaCombatDamage([{ damage: 0 }]), false);
  assert.equal(hasAreaCombatDamage([{ damage: 0, radiationExposure: 8 }]), false);
  assert.equal(hasAreaCombatDamage([{ damage: 0 }, { damage: 3 }]), true);
});

test('disabled Combat Sounds skips audio work; enabled Combat Sounds plays one impact', async () => {
  const muted = createPlayer();
  requestCombatImpact(muted.player, () => false);
  await flushPromises();
  assert.deepEqual(muted.calls, { seekTo: 0, play: 0 });

  const enabled = createPlayer();
  requestCombatImpact(enabled.player, () => true);
  await flushPromises();
  assert.equal(enabled.player.volume, 0.55);
  assert.deepEqual(enabled.calls, { seekTo: 1, play: 1 });
});

test('turning Combat Sounds off while the player seeks suppresses the pending impact', async () => {
  let resolveSeek!: () => void;
  let enabled = true;
  const { player, calls } = createPlayer(() => new Promise<void>(resolve => { resolveSeek = resolve; }));
  requestCombatImpact(player, () => enabled);

  enabled = false;
  resolveSeek();
  await flushPromises();

  assert.deepEqual(calls, { seekTo: 1, play: 0 });
});

test('combat impacts use only the saved Combat Sounds preference', async () => {
  for (const systemSoundsEnabled of [false, true]) {
    for (const musicEnabled of [false, true]) {
      for (const combatSoundsEnabled of [false, true]) {
        const { player, calls } = createPlayer();
        const preferences = { systemSoundsEnabled, musicEnabled, combatSoundsEnabled };
        requestCombatImpact(player, () => preferences.combatSoundsEnabled);
        await flushPromises();
        assert.equal(
          calls.play,
          combatSoundsEnabled ? 1 : 0,
          `system=${systemSoundsEnabled}, radio=${musicEnabled}, combat=${combatSoundsEnabled}`,
        );
      }
    }
  }
});

test('direct and area combat handlers request at most one impact for HP damage only', () => {
  assert.match(combatScreen, /if \(hasDirectCombatDamage\(totalDamage\)\) playCombatImpact\(\)/);
  assert.match(combatScreen, /if \(hasAreaCombatDamage\(areaAttackReceipt\.results\)\) playCombatImpact\(\)/);
  assert.match(combatScreen, /lastAreaImpactRequestId\.current === areaAttackReceipt\.requestId/);
  assert.match(combatScreen, /attackApplied\.current \|\|/);
  assert.match(combatScreen, /requestCombatImpact\(combatImpactPlayer, \(\) => combatSoundsEnabledRef\.current\)/);
  assert.match(combatScreen, /useAudioPlayer\(require\('\.\.\/\.\.\/assets\/combat-impact\.wav'\)\)/);
  assert.doesNotMatch(combatScreen, /systemSoundsEnabled|musicEnabled|musicVolume/);
});

test('audio options keep Combat Sounds and system sounds independent and open radio station selection', () => {
  assert.match(campaignOptionsModal, /label="System sounds"[\s\S]*?value=\{systemSoundsEnabled\}[\s\S]*?onValueChange=\{setSystemSoundsEnabled\}/);
  assert.match(campaignOptionsModal, /label="Combat Sounds"[\s\S]*?value=\{combatSoundsEnabled\}[\s\S]*?onValueChange=\{setCombatSoundsEnabled\}/);
  assert.match(campaignOptionsModal, /accessibilityLabel="Enable Radio"[\s\S]*?onPress=\{\(\) => setShowRadioStations\(true\)\}/);
  assert.match(campaignOptionsModal, /<RadioStationsModal[\s\S]*?visible=\{showRadioStations\}/);
  assert.doesNotMatch(campaignOptionsModal, /label="Enable Vault Radio"|vault-radio-toggle/);
});
