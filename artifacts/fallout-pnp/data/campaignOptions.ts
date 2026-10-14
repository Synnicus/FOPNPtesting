export type CampaignVisualTheme = 'western' | 'eastern';

export interface CampaignOptions {
  visualTheme: CampaignVisualTheme;
  systemSoundsEnabled: boolean;
  musicEnabled: boolean;
}

export const DEFAULT_CAMPAIGN_OPTIONS: CampaignOptions = {
  visualTheme: 'western',
  systemSoundsEnabled: true,
  musicEnabled: true,
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
    musicEnabled: typeof options.musicEnabled === 'boolean'
      ? options.musicEnabled
      : DEFAULT_CAMPAIGN_OPTIONS.musicEnabled,
  };
}
