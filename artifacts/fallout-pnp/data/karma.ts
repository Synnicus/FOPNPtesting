import type { KarmaLogEntry } from '../context/types.ts';

export const MIN_KARMA = -1000;
export const MAX_KARMA = 1000;
export const MAX_KARMA_REASON_LENGTH = 500;

export type KarmaGroup = 'Very Good' | 'Good' | 'Neutral' | 'Evil' | 'Very Evil';

export interface KarmaTitleRow {
  positive: string;
  neutral: string;
  negative: string;
}

export const KARMA_TITLE_ROWS: readonly KarmaTitleRow[] = [
  { positive: 'Wasteland Guardian', neutral: 'Wasteland Dweller', negative: 'Wasteland Delinquent' },
  { positive: 'Wasteland Martyr', neutral: 'Wasteland Renegade', negative: 'Wasteland Outlaw' },
  { positive: 'Sentinel', neutral: 'Seeker', negative: 'Opportunist' },
  { positive: 'Defender', neutral: 'Wanderer', negative: 'Plunderer' },
  { positive: 'Dignitary', neutral: 'Citizen', negative: 'Fat Cat' },
  { positive: 'Peacekeeper', neutral: 'Adventurer', negative: 'Marauder' },
  { positive: 'Ranger of the Wastes', neutral: 'Vagabond of the Wastes', negative: 'Pirate of the Wastes' },
  { positive: 'Protector', neutral: 'Mercenary', negative: 'Reaver' },
  { positive: 'Urban Avenger', neutral: 'Urban Ranger', negative: 'Urban Invader' },
  { positive: 'Exemplar', neutral: 'Observer', negative: "Ne'er-do-well" },
  { positive: 'Capital Crusader', neutral: 'Capital Councilor', negative: 'Capital Crimelord' },
  { positive: 'Paladin', neutral: 'Keeper', negative: 'Defiler' },
  { positive: 'Wasteland Legend', neutral: 'Wasteland Descendant', negative: 'Wasteland Boogeyman' },
  { positive: 'Ambassador of Peace', neutral: 'Pinnacle of Survival', negative: 'Harbinger of War' },
  { positive: 'Urban Legend', neutral: 'Urban Myth', negative: 'Urban Superstition' },
  { positive: 'Hero of the Wastes', neutral: 'Strider of the Wastes', negative: 'Villain of the Wastes' },
  { positive: 'Paragon', neutral: 'Beholder', negative: 'Fiend' },
  { positive: 'Wasteland Savior', neutral: 'Wasteland Watcher', negative: 'Wasteland Destroyer' },
  { positive: 'Saint', neutral: 'Super-Human', negative: 'Evil Incarnate' },
  { positive: 'Last, Best Hope of Humanity', neutral: 'Paradigm of Humanity', negative: 'Scourge of Humanity' },
  { positive: 'Restorer of Faith', neutral: 'Soldier of Fortune', negative: 'Architect of Doom' },
  { positive: 'Model of Selflessness', neutral: 'Profiteer', negative: 'Bringer of Sorrow' },
  { positive: 'Shepherd', neutral: 'Egocentric', negative: 'Deceiver' },
  { positive: 'Friend of the People', neutral: 'Loner', negative: 'Consort of Discord' },
  { positive: 'Champion of Justice', neutral: 'Hero for Hire', negative: 'Stuff of Nightmares' },
  { positive: 'Symbol of Order', neutral: 'Model of Apathy', negative: 'Agent of Chaos' },
  { positive: 'Herald of Tranquility', neutral: 'Person of Refinement', negative: 'Instrument of Ruin' },
  { positive: 'Lightbringer', neutral: 'Moneygrubber', negative: 'Soultaker' },
  { positive: 'Earthly Angel', neutral: 'Gray Stranger', negative: "Demon's Spawn" },
  { positive: 'Messiah', neutral: 'True Mortal', negative: 'Devil' },
];

export function clampKarma(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_KARMA, Math.min(MAX_KARMA, Math.trunc(value)));
}

export function karmaGroupFor(value: number): KarmaGroup {
  const karma = clampKarma(value);
  if (karma >= 750) return 'Very Good';
  if (karma >= 250) return 'Good';
  if (karma <= -750) return 'Very Evil';
  if (karma <= -250) return 'Evil';
  return 'Neutral';
}

export function karmaTitleFor(level: number, value: number): string {
  const validLevel = Number.isFinite(level) ? Math.trunc(level) : 1;
  const rowIndex = Math.max(0, Math.min(KARMA_TITLE_ROWS.length - 1, validLevel - 1));
  const row = KARMA_TITLE_ROWS[rowIndex];
  const group = karmaGroupFor(value);
  if (group === 'Very Good' || group === 'Good') return row.positive;
  if (group === 'Very Evil' || group === 'Evil') return row.negative;
  return row.neutral;
}

export function parseKarmaAdjustment(input: string): number | null {
  const value = input.trim();
  if (!/^[+-]?\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount !== 0 ? amount : null;
}

export function applyKarmaAdjustment(
  currentValue: number,
  requestedChange: number,
): { karma: number; appliedChange: number } | null {
  if (!Number.isSafeInteger(requestedChange) || requestedChange === 0) return null;
  const current = clampKarma(currentValue);
  const karma = clampKarma(current + requestedChange);
  const appliedChange = karma - current;
  return appliedChange === 0 ? null : { karma, appliedChange };
}

export function isKarmaLogEntry(value: unknown): value is KarmaLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string'
    && entry.id.length > 0
    && entry.id.length <= 128
    && typeof entry.reason === 'string'
    && entry.reason.trim().length > 0
    && entry.reason.length <= MAX_KARMA_REASON_LENGTH
    && typeof entry.change === 'number'
    && Number.isSafeInteger(entry.change)
    && entry.change !== 0
    && entry.change >= MIN_KARMA - MAX_KARMA
    && entry.change <= MAX_KARMA - MIN_KARMA
    && typeof entry.createdAt === 'number'
    && Number.isFinite(entry.createdAt)
    && entry.createdAt >= 0;
}

export function normalizeKarmaFields(input: {
  karma?: unknown;
  karmaLog?: unknown;
}): { karma: number; karmaLog: KarmaLogEntry[] } {
  const karmaLog: KarmaLogEntry[] = [];
  let karma = 0;
  const savedEntries = Array.isArray(input.karmaLog) ? input.karmaLog : [];
  for (const value of savedEntries) {
    if (!isKarmaLogEntry(value)) continue;
    const adjustment = applyKarmaAdjustment(karma, value.change);
    if (!adjustment) continue;
    karma = adjustment.karma;
    karmaLog.push({
      ...value,
      change: adjustment.appliedChange,
      reason: value.reason.trim(),
    });
  }
  return { karma, karmaLog };
}
