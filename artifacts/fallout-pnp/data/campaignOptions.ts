import {
  normalizeGhoulRadiationHealingOption,
  type GhoulRadiationHealingOption,
} from './radiation.ts';

export type CampaignVisualTheme = 'western' | 'eastern';

export interface CampaignOptions {
  visualTheme: CampaignVisualTheme;
  systemSoundsEnabled: boolean;
  combatSoundsEnabled: boolean;
  musicEnabled: boolean;
  mutantGhoulRadiationRules: boolean;
  ghoulRadiationHealingOption: GhoulRadiationHealingOption;
}

export const DEFAULT_CAMPAIGN_OPTIONS: CampaignOptions = {
  visualTheme: 'western',
  systemSoundsEnabled: true,
  combatSoundsEnabled: true,
  musicEnabled: true,
  mutantGhoulRadiationRules: false,
  ghoulRadiationHealingOption: 1,
};

export function normalizeCampaignOptions(value: unknown): CampaignOptions {
  const options = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  return {
    visualTheme: options.visualTheme === 'eastern' ? 'eastern' : 'western',
    systemSoundsEnabled: typeof options.systemSoundsEnabled === 'boolean'
      ? options.systemSoundsEnabled
      : DEFAULT_CAMPAIGN_OPTIONS.systemSoundsEnabled,
    combatSoundsEnabled: typeof options.combatSoundsEnabled === 'boolean'
      ? options.combatSoundsEnabled
      : DEFAULT_CAMPAIGN_OPTIONS.combatSoundsEnabled,
    musicEnabled: typeof options.musicEnabled === 'boolean'
      ? options.musicEnabled
      : DEFAULT_CAMPAIGN_OPTIONS.musicEnabled,
    mutantGhoulRadiationRules: typeof options.mutantGhoulRadiationRules === 'boolean'
      ? options.mutantGhoulRadiationRules
      : DEFAULT_CAMPAIGN_OPTIONS.mutantGhoulRadiationRules,
    ghoulRadiationHealingOption: normalizeGhoulRadiationHealingOption(options.ghoulRadiationHealingOption),
  };
}
