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
  musicVolume: number;
  mutantGhoulRadiationRules: boolean;
  ghoulRadiationHealingOption: GhoulRadiationHealingOption;
}

export const DEFAULT_CAMPAIGN_OPTIONS: CampaignOptions = {
  visualTheme: 'western',
  systemSoundsEnabled: true,
  combatSoundsEnabled: true,
  musicEnabled: false,
  musicVolume: 0.5,
  mutantGhoulRadiationRules: false,
  ghoulRadiationHealingOption: 1,
};

export function normalizeCampaignOptions(value: unknown): CampaignOptions {
  const options = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const hasValidMusicVolume = typeof options.musicVolume === 'number'
    && Number.isFinite(options.musicVolume)
    && options.musicVolume >= 0
    && options.musicVolume <= 1;
  return {
    visualTheme: options.visualTheme === 'eastern' ? 'eastern' : 'western',
    systemSoundsEnabled: typeof options.systemSoundsEnabled === 'boolean'
      ? options.systemSoundsEnabled
      : DEFAULT_CAMPAIGN_OPTIONS.systemSoundsEnabled,
    combatSoundsEnabled: typeof options.combatSoundsEnabled === 'boolean'
      ? options.combatSoundsEnabled
      : DEFAULT_CAMPAIGN_OPTIONS.combatSoundsEnabled,
    // Older versions exposed a placeholder Music toggle but had no playback.
    // Its old default was on, so treat states without a saved volume as legacy
    // and keep Vault Radio off after upgrading.
    musicEnabled: hasValidMusicVolume && typeof options.musicEnabled === 'boolean'
      ? options.musicEnabled
      : DEFAULT_CAMPAIGN_OPTIONS.musicEnabled,
    musicVolume: hasValidMusicVolume
      ? options.musicVolume as number
      : DEFAULT_CAMPAIGN_OPTIONS.musicVolume,
    mutantGhoulRadiationRules: typeof options.mutantGhoulRadiationRules === 'boolean'
      ? options.mutantGhoulRadiationRules
      : DEFAULT_CAMPAIGN_OPTIONS.mutantGhoulRadiationRules,
    ghoulRadiationHealingOption: normalizeGhoulRadiationHealingOption(options.ghoulRadiationHealingOption),
  };
}
