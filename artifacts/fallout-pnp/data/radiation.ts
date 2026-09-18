export const MAX_RADIATION = 1000;

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

export function resolveRadiationAddition(amount: number, resistance: number): number {
  const incoming = Math.max(0, Math.round(amount));
  const effectiveResistance = Math.max(0, Math.min(100, resistance));
  return Math.round(incoming * (1 - effectiveResistance / 100));
}

export function adjustRadiation(current: number, delta: number): number {
  return normalizeRadiation(normalizeRadiation(current) + Math.round(delta));
}