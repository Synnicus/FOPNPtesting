import type {
  FactionReputation,
  FactionReputationKind,
  FactionReputationLogEntry,
} from '../context/types.ts';

export const MAX_FACTION_NAME_LENGTH = 120;
export const MAX_FACTION_TITLE_LENGTH = 100;
export const MAX_FACTION_REASON_LENGTH = 500;
export const MAX_FACTION_COUNT = 100;
export const MAX_FACTION_LOG_ENTRIES = 1000;

export interface FactionThresholdProfile {
  id: string;
  name: string;
  thresholds: readonly [number, number, number, number];
}

/** Thresholds are the minimum points for Fame/Infamy ranges 1–4 on the linked wiki. */
export const FACTION_THRESHOLD_PROFILES: readonly FactionThresholdProfile[] = [
  { id: 'boomers', name: 'Boomers', thresholds: [0, 8, 25, 50] },
  { id: 'brotherhood-of-steel', name: 'Brotherhood of Steel', thresholds: [0, 3, 10, 20] },
  { id: 'caesars-legion', name: "Caesar's Legion", thresholds: [0, 15, 50, 100] },
  { id: 'followers-of-the-apocalypse', name: 'Followers of the Apocalypse', thresholds: [0, 8, 25, 50] },
  { id: 'freeside', name: 'Freeside', thresholds: [0, 11, 35, 70] },
  { id: 'goodsprings', name: 'Goodsprings', thresholds: [0, 3, 8, 15] },
  { id: 'great-khans', name: 'Great Khans', thresholds: [0, 5, 15, 30] },
  { id: 'new-california-republic', name: 'New California Republic', thresholds: [0, 12, 40, 80] },
  { id: 'novac', name: 'Novac', thresholds: [0, 3, 10, 20] },
  { id: 'powder-gangers', name: 'Powder Gangers', thresholds: [0, 5, 15, 50] },
  { id: 'primm', name: 'Primm', thresholds: [0, 5, 15, 30] },
  { id: 'the-strip', name: 'The Strip', thresholds: [0, 6, 20, 40] },
  { id: 'white-glove-society', name: 'White Glove Society', thresholds: [0, 2, 5, 10] },
] as const;

export const DEFAULT_FACTION_THRESHOLD_PROFILE = 'great-khans';

/** Rows are Infamy ranges 1–4; columns are Fame ranges 1–4. */
export const FNV_REPUTATION_TITLES: readonly (readonly string[])[] = [
  ['Neutral', 'Accepted', 'Liked', 'Idolized'],
  ['Shunned', 'Mixed', 'Smiling Troublemaker', 'Good-Natured Rascal'],
  ['Hated', 'Sneering Punk', 'Unpredictable', 'Dark Hero'],
  ['Vilified', 'Merciful Thug', 'Soft-Hearted Devil', 'Wild Child'],
];

export function getFactionThresholdProfile(id: string): FactionThresholdProfile {
  return FACTION_THRESHOLD_PROFILES.find(profile => profile.id === id)
    ?? FACTION_THRESHOLD_PROFILES.find(profile => profile.id === DEFAULT_FACTION_THRESHOLD_PROFILE)!;
}

export function reputationRange(points: number, thresholds: readonly number[]): number {
  const amount = Number.isSafeInteger(points) && points >= 0 ? points : 0;
  let range = 0;
  for (let index = 1; index < 4; index += 1) {
    if (amount >= (thresholds[index] ?? Number.POSITIVE_INFINITY)) range = index;
  }
  return range;
}

export function factionReputationTitle(faction: Pick<
  FactionReputation,
  'fame' | 'infamy' | 'thresholdProfile' | 'customTitle'
>): string {
  const thresholds = getFactionThresholdProfile(faction.thresholdProfile).thresholds;
  const fameRange = reputationRange(faction.fame, thresholds);
  const infamyRange = reputationRange(faction.infamy, thresholds);
  const automatedTitle = FNV_REPUTATION_TITLES[infamyRange][fameRange];
  const customTitle = faction.customTitle?.trim();
  return customTitle ? `${customTitle} - ${automatedTitle}` : automatedTitle;
}

export function applyFactionReputationAdjustment(
  current: number,
  requestedChange: number,
): { total: number; appliedChange: number } | null {
  if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(requestedChange) || requestedChange === 0) {
    return null;
  }
  const total = Math.max(0, current + requestedChange);
  if (!Number.isSafeInteger(total)) return null;
  const appliedChange = total - current;
  return appliedChange === 0 ? null : { total, appliedChange };
}

export function parseFactionReputationAdjustment(input: string): number | null {
  const value = input.trim();
  if (!/^[+-]?\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount !== 0 ? amount : null;
}

export function isFactionReputationLogEntry(value: unknown): value is FactionReputationLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string'
    && entry.id.length > 0
    && entry.id.length <= 128
    && (entry.kind === 'fame' || entry.kind === 'infamy')
    && typeof entry.change === 'number'
    && Number.isSafeInteger(entry.change)
    && entry.change !== 0
    && typeof entry.reason === 'string'
    && entry.reason.trim().length > 0
    && entry.reason.length <= MAX_FACTION_REASON_LENGTH
    && typeof entry.createdAt === 'number'
    && Number.isFinite(entry.createdAt)
    && entry.createdAt >= 0;
}

function replayFactionLog(log: readonly FactionReputationLogEntry[]) {
  let fame = 0;
  let infamy = 0;
  const validLog: FactionReputationLogEntry[] = [];
  for (const entry of log) {
    const current = entry.kind === 'fame' ? fame : infamy;
    const updated = applyFactionReputationAdjustment(current, entry.change);
    if (!updated) continue;
    if (entry.kind === 'fame') fame = updated.total;
    else infamy = updated.total;
    validLog.push({ ...entry, change: updated.appliedChange, reason: entry.reason.trim() });
  }
  return { fame, infamy, log: validLog };
}

export function normalizeFactionReputations(value: unknown): FactionReputation[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const result: FactionReputation[] = [];
  for (const candidate of value) {
    if (!isFactionReputation(candidate) || seenIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);
    const replayed = replayFactionLog(candidate.log);
    result.push({
      ...candidate,
      name: candidate.name.trim(),
      customTitle: candidate.customTitle?.trim() || undefined,
      ...replayed,
    });
    if (result.length >= MAX_FACTION_COUNT) break;
  }
  return result;
}

export function isFactionReputation(value: unknown): value is FactionReputation {
  if (typeof value !== 'object' || value === null) return false;
  const faction = value as Record<string, unknown>;
  if (
    typeof faction.id !== 'string'
    || faction.id.length === 0
    || faction.id.length > 128
    || typeof faction.name !== 'string'
    || faction.name.trim().length === 0
    || faction.name.length > MAX_FACTION_NAME_LENGTH
    || typeof faction.thresholdProfile !== 'string'
    || !FACTION_THRESHOLD_PROFILES.some(profile => profile.id === faction.thresholdProfile)
    || typeof faction.fame !== 'number'
    || !Number.isSafeInteger(faction.fame)
    || faction.fame < 0
    || typeof faction.infamy !== 'number'
    || !Number.isSafeInteger(faction.infamy)
    || faction.infamy < 0
    || (faction.customTitle !== undefined
      && (typeof faction.customTitle !== 'string' || faction.customTitle.length > MAX_FACTION_TITLE_LENGTH))
    || !Array.isArray(faction.log)
    || faction.log.length > MAX_FACTION_LOG_ENTRIES
    || !faction.log.every(isFactionReputationLogEntry)
  ) return false;

  const log = faction.log as FactionReputationLogEntry[];
  if (new Set(log.map(entry => entry.id)).size !== log.length) return false;
  const replayed = replayFactionLog(log);
  return replayed.log.length === log.length
    && replayed.fame === faction.fame
    && replayed.infamy === faction.infamy;
}

export function isFactionReputationList(value: unknown): value is FactionReputation[] {
  if (!Array.isArray(value) || value.length > MAX_FACTION_COUNT || !value.every(isFactionReputation)) return false;
  const factions = value as FactionReputation[];
  return new Set(factions.map(faction => faction.id)).size === factions.length;
}

export function removeFactionReputationLogEntry(
  faction: FactionReputation,
  entryId: string,
): FactionReputation | null {
  const index = faction.log.findIndex(entry => entry.id === entryId);
  if (index < 0) return null;
  const replayed = replayFactionLog([...faction.log.slice(0, index), ...faction.log.slice(index + 1)]);
  return { ...faction, ...replayed };
}

export function factionReputationTotalFor(
  faction: FactionReputation,
  kind: FactionReputationKind,
): number {
  return kind === 'fame' ? faction.fame : faction.infamy;
}
