export const MAX_RADIATION = 1000;

export interface RadiationSicknessEffect {
  id: 'radiation-sickness';
  name: string;
  description: string;
  threshold: number;
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

export function resolveRadiationAddition(amount: number, resistance: number): number {
  const incoming = Math.max(0, Math.round(amount));
  const effectiveResistance = Math.max(0, Math.min(100, resistance));
  return Math.round(incoming * (1 - effectiveResistance / 100));
}

export function adjustRadiation(current: number, delta: number): number {
  return normalizeRadiation(normalizeRadiation(current) + Math.round(delta));
}