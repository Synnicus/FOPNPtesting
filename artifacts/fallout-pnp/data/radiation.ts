export const MAX_RADIATION = 1000;

export interface RadiationSicknessEffect {
  id: 'radiation-sickness';
  name: string;
  description: string;
  threshold: number;
}

export interface HardcoreRadiationRule {
  threshold: 0 | 150 | 300 | 500 | 750 | 1000;
  statMods: {
    strength?: number;
    endurance?: number;
    charisma?: number;
    agility?: number;
  };
  fatal: boolean;
}

export function normalizeRadiation(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_RADIATION, Math.round(value)))
    : 0;
}

export function radiationSicknessLabel(value: number): string {
  const radiation = normalizeRadiation(value);
  if (radiation >= 1000) return 'Fatal Radiation Sickness';
  if (radiation >= 800) return 'Deadly Radiation Sickness';
  if (radiation >= 600) return 'Critical Radiation Sickness';
  if (radiation >= 400) return 'Advanced Radiation Sickness';
  if (radiation >= 200) return 'Minor Radiation Sickness';
  return 'No Radiation Sickness';
}

/** Radiation sickness is derived from the meter, never stored or dismissed
 * independently, so imports and saves cannot contain a stale sickness stage. */
export function radiationSicknessEffect(value: number): RadiationSicknessEffect | null {
  const radiation = normalizeRadiation(value);
  const threshold = radiation >= 1000 ? 1000
    : radiation >= 800 ? 800
      : radiation >= 600 ? 600
        : radiation >= 400 ? 400
          : radiation >= 200 ? 200
            : null;
  if (threshold === null) return null;
  return {
    id: 'radiation-sickness',
    name: radiationSicknessLabel(radiation),
    threshold,
    description: `Automatically active at ${radiation} radiation. Lower radiation below ${threshold} to downgrade or clear this effect.`,
  };
}

/** Optional Hardcore house rules, kept separate from PnP 2.0 stages. */
export function hardcoreRadiationRule(value: number): HardcoreRadiationRule {
  const radiation = normalizeRadiation(value);
  if (radiation >= 1000) return {
    threshold: 1000,
    statMods: { strength: -3, agility: -3, endurance: -3, charisma: -2 },
    fatal: true,
  };
  if (radiation >= 750) return {
    threshold: 750,
    statMods: { strength: -3, agility: -3, endurance: -3, charisma: -2 },
    fatal: false,
  };
  if (radiation >= 500) return {
    threshold: 500,
    statMods: { strength: -2, agility: -2, endurance: -1 },
    fatal: false,
  };
  if (radiation >= 300) return {
    threshold: 300,
    statMods: { strength: -1, agility: -1 },
    fatal: false,
  };
  if (radiation >= 150) return {
    threshold: 150,
    statMods: { strength: -1 },
    fatal: false,
  };
  return { threshold: 0, statMods: {}, fatal: false };
}

export function formatHardcoreRadiationPenalties(value: number): string {
  const labels: Record<keyof HardcoreRadiationRule['statMods'], string> = {
    strength: 'STR', endurance: 'END', charisma: 'CHA', agility: 'AGI',
  };
  return Object.entries(hardcoreRadiationRule(value).statMods)
    .map(([key, modifier]) => `${labels[key as keyof typeof labels]} ${modifier}`)
    .join(' · ');
}

export function resolveRadiationAddition(amount: number, resistance: number): number {
  const incoming = Math.max(0, Math.round(amount));
  const effectiveResistance = Math.max(0, Math.min(100, resistance));
  return Math.round(incoming * (1 - effectiveResistance / 100));
}

export function adjustRadiation(current: number, delta: number): number {
  return normalizeRadiation(normalizeRadiation(current) + Math.round(delta));
}