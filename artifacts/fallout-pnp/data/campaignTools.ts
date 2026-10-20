import type {
  CampaignMap,
  CampaignMapMarkerIcon,
  CampaignTable,
} from '@/context/types';

export const MAX_CAMPAIGN_MAP_IMAGE_URI_LENGTH = 8_000_000;
export const MAX_CAMPAIGN_MAP_MARKER_ICONS = 24;
export const MAX_CAMPAIGN_MAP_MARKER_ICON_URI_LENGTH = 500_000;
export const MAX_CAMPAIGN_TOOL_ITEMS = 200;
const MAX_TABLE_QUANTITY = 200;

export interface CampaignTableRollResult {
  entryId: string;
  name: string;
  description: string;
  quantity: number;
}

export interface CampaignMapExportFile {
  filename: string;
  json: string;
}

export function createCampaignMapExport(map: CampaignMap): CampaignMapExportFile {
  const filename = `${map.name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'campaign-map'}.json`;
  return {
    filename,
    json: JSON.stringify({ format: 'fallout-pnp-map', version: 1, map }, null, 2),
  };
}

export async function exportCampaignMap(
  map: CampaignMap,
  platform: 'web' | 'native',
  handlers: {
    download: (file: CampaignMapExportFile) => void | Promise<void>;
    share: (file: CampaignMapExportFile) => void | Promise<void>;
  },
): Promise<void> {
  const file = createCampaignMapExport(map);
  await (platform === 'web' ? handlers.download : handlers.share)(file);
}

export function normalizeCampaignTable(value: unknown): CampaignTable | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const table = value as Partial<CampaignTable>;
  if (typeof table.id !== 'string' || !table.id || typeof table.name !== 'string') return null;
  const entries = Array.isArray(table.entries) ? table.entries.slice(0, MAX_CAMPAIGN_TOOL_ITEMS) : [];
  const rollCountMin = normalizePositiveInteger(table.rollCountMin, 1);
  const rollCountMax = Math.max(rollCountMin, normalizePositiveInteger(table.rollCountMax, rollCountMin));
  return {
    id: table.id.slice(0, 128),
    name: table.name.slice(0, 120),
    description: typeof table.description === 'string' ? table.description.slice(0, 2000) : '',
    rollCountMin,
    rollCountMax,
    entries: entries.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as CampaignTable['entries'][number];
      if (typeof item.id !== 'string' || typeof item.name !== 'string') return [];
      const quantityMin = normalizePositiveInteger(item.quantityMin, 1);
      return [{
        id: item.id.slice(0, 128) || `entry-${index}`,
        name: item.name.slice(0, 120),
        description: typeof item.description === 'string' ? item.description.slice(0, 2000) : '',
        weight: typeof item.weight === 'number' && Number.isFinite(item.weight)
          ? Math.min(1_000_000, Math.max(1, Math.floor(item.weight)))
          : 1,
        quantityMin,
        quantityMax: Math.max(quantityMin, normalizePositiveInteger(item.quantityMax, quantityMin)),
      }];
    }),
  };
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_TABLE_QUANTITY, Math.max(1, Math.floor(value)))
    : fallback;
}

function randomFraction(random: () => number): number {
  const value = random();
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(0.999999999999, value))
    : 0;
}

function rollInclusive(min: number, max: number, random: () => number): number {
  if (min >= max) return min;
  return min + Math.floor(randomFraction(random) * (max - min + 1));
}

export function rollEncounterTable(
  table: CampaignTable,
  random: () => number = Math.random,
): CampaignTableRollResult[] {
  if (table.entries.length === 0) return [];
  const selected = table.entries[Math.floor(randomFraction(random) * table.entries.length)];
  return [{ entryId: selected.id, name: selected.name, description: selected.description, quantity: 1 }];
}

export function rollLootTable(
  table: CampaignTable,
  random: () => number = Math.random,
): CampaignTableRollResult[] {
  if (table.entries.length === 0) return [];
  const drawCount = rollInclusive(table.rollCountMin ?? 1, table.rollCountMax ?? 1, random);
  const totalWeight = table.entries.reduce((total, entry) => total + Math.max(1, entry.weight), 0);
  const results: CampaignTableRollResult[] = [];
  for (let draw = 0; draw < drawCount; draw += 1) {
    let remainingWeight = randomFraction(random) * totalWeight;
    const selected = table.entries.find(entry => {
      remainingWeight -= Math.max(1, entry.weight);
      return remainingWeight < 0;
    }) ?? table.entries[table.entries.length - 1];
    results.push({
      entryId: selected.id,
      name: selected.name,
      description: selected.description,
      quantity: rollInclusive(selected.quantityMin ?? 1, selected.quantityMax ?? 1, random),
    });
  }
  return results;
}

export function normalizeCampaignMap(value: unknown): CampaignMap | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const map = value as Partial<CampaignMap>;
  if (typeof map.id !== 'string' || !map.id || typeof map.name !== 'string') return null;
  const locations = Array.isArray(map.locations) ? map.locations.slice(0, MAX_CAMPAIGN_TOOL_ITEMS) : [];
  const party = Array.isArray(map.party) ? map.party.slice(0, MAX_CAMPAIGN_TOOL_ITEMS) : [];
  const markerIcons = Array.isArray(map.markerIcons)
    ? map.markerIcons.slice(0, MAX_CAMPAIGN_MAP_MARKER_ICONS)
    : [];
  const imageDataUri = typeof map.imageDataUri === 'string'
    && map.imageDataUri.length <= MAX_CAMPAIGN_MAP_IMAGE_URI_LENGTH
    && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(map.imageDataUri)
    ? map.imageDataUri
    : undefined;
  const imageWidth = validMapImageDimension(map.imageWidth) ? map.imageWidth : undefined;
  const imageHeight = validMapImageDimension(map.imageHeight) ? map.imageHeight : undefined;
  return {
    id: map.id.slice(0, 128),
    name: map.name.slice(0, 120),
    description: typeof map.description === 'string' ? map.description.slice(0, 2000) : '',
    imageDataUri,
    ...(imageWidth ? { imageWidth } : {}),
    ...(imageHeight ? { imageHeight } : {}),
    locations: locations.flatMap(location => {
      if (!location || typeof location !== 'object') return [];
      const item = location as CampaignMap['locations'][number];
      if (typeof item.id !== 'string' || typeof item.name !== 'string'
        || !validCoordinate(item.x) || !validCoordinate(item.y)) return [];
      return [{
        id: item.id.slice(0, 128),
        name: item.name.slice(0, 120),
        description: typeof item.description === 'string' ? item.description.slice(0, 2000) : '',
        ...(typeof item.iconId === 'string' && item.iconId ? { iconId: item.iconId.slice(0, 128) } : {}),
        x: item.x,
        y: item.y,
      }];
    }),
    ...(markerIcons.length > 0 ? {
      markerIcons: markerIcons.flatMap(icon => {
        if (!icon || typeof icon !== 'object') return [];
        const item = icon as CampaignMapMarkerIcon;
        if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string'
          || typeof item.imageDataUri !== 'string'
          || item.imageDataUri.length > MAX_CAMPAIGN_MAP_MARKER_ICON_URI_LENGTH
          || !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(item.imageDataUri)) return [];
        return [{
          id: item.id.slice(0, 128),
          name: item.name.slice(0, 80),
          imageDataUri: item.imageDataUri,
        }];
      }),
    } : {}),
    party: party.flatMap(marker => {
      if (!marker || typeof marker !== 'object') return [];
      const item = marker as CampaignMap['party'][number];
      if (typeof item.characterId !== 'string' || !validCoordinate(item.x) || !validCoordinate(item.y)) return [];
      return [{ characterId: item.characterId.slice(0, 128), x: item.x, y: item.y }];
    }),
  };
}

function validCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validMapImageDimension(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 20_000;
}

export function validCampaignTable(value: unknown): value is CampaignTable {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Partial<CampaignTable>;
  const validRangeValue = (item: unknown) =>
    item === undefined || (Number.isInteger(item) && Number(item) >= 1 && Number(item) <= MAX_TABLE_QUANTITY);
  if (!Array.isArray(raw.entries)
    || raw.entries.some(entry => !entry || typeof entry !== 'object'
      || !Number.isInteger(entry.weight) || entry.weight < 1
      || !validRangeValue(entry.quantityMin) || !validRangeValue(entry.quantityMax)
      || (entry.quantityMin !== undefined && entry.quantityMax !== undefined
        && entry.quantityMin > entry.quantityMax))
    || !validRangeValue(raw.rollCountMin) || !validRangeValue(raw.rollCountMax)
    || (raw.rollCountMin !== undefined && raw.rollCountMax !== undefined
      && raw.rollCountMin > raw.rollCountMax)) return false;
  const normalized = normalizeCampaignTable(value);
  return !!normalized
    && normalized.entries.length === raw.entries.length
    && new Set(normalized.entries.map(entry => entry.id)).size === normalized.entries.length;
}

export function validCampaignMap(value: unknown): value is CampaignMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Partial<CampaignMap>;
  if (raw.imageDataUri !== undefined
    && (typeof raw.imageDataUri !== 'string'
      || raw.imageDataUri.length > MAX_CAMPAIGN_MAP_IMAGE_URI_LENGTH
      || !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(raw.imageDataUri))) return false;
  if ((raw.imageWidth !== undefined && !validMapImageDimension(raw.imageWidth))
    || (raw.imageHeight !== undefined && !validMapImageDimension(raw.imageHeight))
    || (raw.markerIcons !== undefined && !Array.isArray(raw.markerIcons))
    || (raw.locations !== undefined && !Array.isArray(raw.locations))
    || (raw.locations ?? []).some(location => location?.iconId !== undefined
      && (typeof location.iconId !== 'string' || !location.iconId))) return false;
  const normalized = normalizeCampaignMap(value);
  const rawMarkerIcons = (raw.markerIcons ?? []) as NonNullable<CampaignMap['markerIcons']>;
  return !!normalized
    && Array.isArray((value as CampaignMap).locations)
    && normalized.locations.length === (value as CampaignMap).locations.length
    && Array.isArray((value as CampaignMap).party)
    && normalized.party.length === (value as CampaignMap).party.length
    && (normalized.markerIcons?.length ?? 0) === rawMarkerIcons.length
    && new Set((normalized.markerIcons ?? []).map(icon => icon.id)).size === rawMarkerIcons.length
    && new Set(normalized.locations.map(location => location.id)).size === normalized.locations.length;
}
