import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CAMPAIGN_OPTIONS,
  normalizeCampaignOptions,
} from './campaignOptions.ts';

test('campaign options provide stable Western and enabled-audio defaults', () => {
  assert.deepEqual(normalizeCampaignOptions({}), DEFAULT_CAMPAIGN_OPTIONS);
  assert.deepEqual(normalizeCampaignOptions(null), DEFAULT_CAMPAIGN_OPTIONS);
});

test('campaign options preserve explicit preferences and normalize invalid values', () => {
  assert.deepEqual(normalizeCampaignOptions({
    visualTheme: 'eastern',
    systemSoundsEnabled: false,
    musicEnabled: false,
  }), {
    visualTheme: 'eastern',
    systemSoundsEnabled: false,
    musicEnabled: false,
  });
  assert.deepEqual(normalizeCampaignOptions({
    visualTheme: 'unknown',
    systemSoundsEnabled: 'off',
    musicEnabled: null,
  }), DEFAULT_CAMPAIGN_OPTIONS);
});
