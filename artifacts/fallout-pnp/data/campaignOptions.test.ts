import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CAMPAIGN_OPTIONS,
  normalizeCampaignOptions,
} from './campaignOptions.ts';

test('campaign options provide stable Western and disabled-radio defaults', () => {
  assert.deepEqual(normalizeCampaignOptions({}), DEFAULT_CAMPAIGN_OPTIONS);
  assert.deepEqual(normalizeCampaignOptions(null), DEFAULT_CAMPAIGN_OPTIONS);
});

test('campaign options preserve explicit preferences and normalize invalid values', () => {
  assert.deepEqual(normalizeCampaignOptions({
    visualTheme: 'eastern',
    systemSoundsEnabled: false,
    combatSoundsEnabled: false,
    musicEnabled: false,
    musicVolume: 0.35,
  }), {
    visualTheme: 'eastern',
    systemSoundsEnabled: false,
    combatSoundsEnabled: false,
    musicEnabled: false,
    musicVolume: 0.35,
    mutantGhoulRadiationRules: false,
    ghoulRadiationHealingOption: 1,
  });
  assert.deepEqual(normalizeCampaignOptions({
    visualTheme: 'unknown',
    systemSoundsEnabled: 'off',
    combatSoundsEnabled: 'off',
    musicEnabled: null,
  }), DEFAULT_CAMPAIGN_OPTIONS);
});

test('legacy music placeholder is migrated to disabled Vault Radio with a safe volume', () => {
  assert.deepEqual(normalizeCampaignOptions({
    musicEnabled: true,
  }), DEFAULT_CAMPAIGN_OPTIONS);
  assert.deepEqual(normalizeCampaignOptions({
    musicEnabled: true,
    musicVolume: 0.72,
  }), {
    ...DEFAULT_CAMPAIGN_OPTIONS,
    musicEnabled: true,
    musicVolume: 0.72,
  });
  assert.deepEqual(normalizeCampaignOptions({
    musicEnabled: true,
    musicVolume: 1.5,
  }), DEFAULT_CAMPAIGN_OPTIONS);
});

test('campaign options persist the mutant radiation toggle and selected Ghoul rule', () => {
  assert.deepEqual(normalizeCampaignOptions({
    mutantGhoulRadiationRules: true,
    ghoulRadiationHealingOption: 3,
  }), {
    ...DEFAULT_CAMPAIGN_OPTIONS,
    mutantGhoulRadiationRules: true,
    ghoulRadiationHealingOption: 3,
  });
  assert.deepEqual(normalizeCampaignOptions({
    mutantGhoulRadiationRules: 'on',
    ghoulRadiationHealingOption: 9,
  }), DEFAULT_CAMPAIGN_OPTIONS);
});
