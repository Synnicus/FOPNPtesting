import type { CatalogPortraitSettings } from '../context/types.ts';

export const MAX_CATALOG_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function decodedBase64Bytes(base64: string): number | null {
  if (!base64 || base64.length % 4 !== 0 || !/^[a-z0-9+/]*={0,2}$/i.test(base64)) return null;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

export function makeCatalogImageDataUri(
  mimeType: string | null | undefined,
  base64: string | null | undefined,
): string | null {
  const mime = mimeType?.toLowerCase() ?? '';
  const normalized = base64?.replace(/\s+/g, '') ?? '';
  const bytes = decodedBase64Bytes(normalized);
  if (!SUPPORTED_IMAGE_TYPES.has(mime) || bytes === null || bytes > MAX_CATALOG_IMAGE_BYTES) return null;
  return `data:${mime};base64,${normalized}`;
}

export function isCatalogImageDataUri(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match || !SUPPORTED_IMAGE_TYPES.has(match[1].toLowerCase())) return false;
  const bytes = decodedBase64Bytes(match[2].replace(/\s+/g, ''));
  return bytes !== null && bytes <= MAX_CATALOG_IMAGE_BYTES;
}

export function normalizeCatalogPortraitMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id, uri]) => id.length > 0 && id.length <= 128 && isCatalogImageDataUri(uri))
      .slice(0, 500),
  ) as Record<string, string>;
}

export function normalizeCatalogPortraitSettings(value: unknown): CatalogPortraitSettings | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.portraitFit === undefined && record.portraitOffset === undefined) return undefined;
  const offset = typeof record.portraitOffset === 'object' && record.portraitOffset !== null
    && !Array.isArray(record.portraitOffset)
    ? record.portraitOffset as Record<string, unknown>
    : {};
  const normalizeCoordinate = (coordinate: unknown) =>
    typeof coordinate === 'number' && Number.isFinite(coordinate)
      ? Math.max(0, Math.min(1, coordinate))
      : 0.5;
  return {
    portraitFit: record.portraitFit === 'contain' ? 'contain' : 'cover',
    portraitOffset: {
      x: normalizeCoordinate(offset.x),
      y: normalizeCoordinate(offset.y),
    },
  };
}

export function normalizeCatalogPortraitSettingsMap(
  value: unknown,
): Record<string, CatalogPortraitSettings> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id]) => id.length > 0 && id.length <= 128)
      .map(([id, settings]) => [id, normalizeCatalogPortraitSettings(settings)])
      .filter((entry): entry is [string, CatalogPortraitSettings] => entry[1] !== undefined)
      .slice(0, 500),
  );
}
