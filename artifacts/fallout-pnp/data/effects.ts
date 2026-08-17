import type { ActiveEffect, Character, SPECIALStats } from '@/context/types';
import type { Chem, ChemStage } from './chems';
import { getChem } from './chems';

// ─── Effects framework — Fallout PnP 2.0 ──────────────────────────────────────
// Merges chems (data/chems.ts) into the character's ActiveEffect[] and provides
// aggregation for combat/derived code. Injuries stay in Character.injuries and
// are handled by data/injuries.ts; this module concerns temporary effects.

/**
 * AP cost to take/use a chem in combat. The manual ("Using An Item") states:
 * "Using an item takes 3 AP." Healing chems are the manual's explicit example
 * of an in-combat usable item.
 */
export const CHEM_AP_COST = 3;

const SPECIAL_KEYS: (keyof SPECIALStats)[] = [
  'strength',
  'perception',
  'endurance',
  'charisma',
  'intelligence',
  'agility',
  'luck',
];

function stageToEffectFields(stage: ChemStage): Partial<ActiveEffect> {
  const statMods: Partial<SPECIALStats> = { ...stage.statMods };
  const notes: string[] = [];
  if (stage.notes) notes.push(stage.notes);
  if (stage.hpHeal) notes.push(`Heals ${stage.hpHeal} HP (see roll)`);
  if (stage.hpDamage) notes.push(`Takes ${stage.hpDamage} HP damage (see roll)`);
  if (stage.radsRemoved) notes.push(`Removes ${stage.radsRemoved} rads`);
  if (stage.durationText) notes.push(`Duration: ${stage.durationText}`);

  return {
    statMods,
    acMod: stage.acMod,
    apMod: stage.apMod,
    drMod: stage.drMod,
    sequenceMod: stage.sequenceMod,
    radResistMod: stage.radResistMod,
    poisonResistMod: stage.poisonResistMod,
    healingRateMod: stage.healingRateMod,
    hpMod: hpModFromStage(stage),
    notes,
  };
}

function hpModFromStage(stage: ChemStage): number | undefined {
  if (stage.hpHeal) return stage.hpHeal;
  if (stage.hpDamage) return -stage.hpDamage;
  return undefined;
}

/** Build an ActiveEffect for a given chem stage. */
export function makeChemEffect(chem: Chem, stageIdx: number): ActiveEffect {
  const idx = Math.max(0, Math.min(stageIdx, chem.stages.length - 1));
  const stage = chem.stages[idx];
  const fields = stageToEffectFields(stage);
  return {
    id: `${chem.id}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: 'chem',
    chemId: chem.id,
    name: chem.stages.length > 1 ? `${chem.name} (${stage.label})` : chem.name,
    stage: idx,
    description: chem.description,
    ...fields,
    isActive: true,
  };
}

/** True when the given chem effect has a subsequent stage to progress to. */
export function chemHasNextStage(effect: ActiveEffect, chem: Chem): boolean {
  const current = effect.stage ?? 0;
  return current + 1 < chem.stages.length;
}

/**
 * Advance a chem effect to its next stage (its after-effect), preserving the
 * effect id. Returns null when the chem has finished (no more stages).
 */
export function progressChemEffect(effect: ActiveEffect, chem: Chem): ActiveEffect | null {
  if (!chemHasNextStage(effect, chem)) return null;
  const nextIdx = (effect.stage ?? 0) + 1;
  const stage = chem.stages[nextIdx];
  const fields = stageToEffectFields(stage);
  return {
    id: effect.id,
    kind: 'chem',
    chemId: chem.id,
    name: chem.stages.length > 1 ? `${chem.name} (${stage.label})` : chem.name,
    stage: nextIdx,
    description: chem.description,
    ...fields,
    isActive: true,
  };
}

export interface AggregatedEffectModifiers {
  statMods: Partial<SPECIALStats>;
  acMod: number;
  apMod: number;
  drMod: number;
  sequenceMod: number;
  radResistMod: number;
  poisonResistMod: number;
  healingRateMod: number;
  notes: string[];
}

function emptyModifiers(): AggregatedEffectModifiers {
  return {
    statMods: {},
    acMod: 0,
    apMod: 0,
    drMod: 0,
    sequenceMod: 0,
    radResistMod: 0,
    poisonResistMod: 0,
    healingRateMod: 0,
    notes: [],
  };
}

/**
 * Aggregate all active effect modifiers on a character (for combat/derived use).
 * Only active effects are counted. Injuries are handled separately.
 */
export function computeEffectModifiers(
  char: Pick<Character, 'effects'>,
): AggregatedEffectModifiers {
  const agg = emptyModifiers();
  const effects = (char.effects ?? []).filter((e) => e.isActive);

  for (const effect of effects) {
    if (effect.statMods) {
      for (const key of SPECIAL_KEYS) {
        const delta = effect.statMods[key];
        if (typeof delta === 'number') {
          agg.statMods[key] = (agg.statMods[key] ?? 0) + delta;
        }
      }
    }
    agg.acMod += effect.acMod ?? 0;
    agg.apMod += effect.apMod ?? 0;
    agg.drMod += effect.drMod ?? 0;
    agg.sequenceMod += effect.sequenceMod ?? 0;
    agg.radResistMod += effect.radResistMod ?? 0;
    agg.poisonResistMod += effect.poisonResistMod ?? 0;
    agg.healingRateMod += effect.healingRateMod ?? 0;

    const label = effect.name;
    if (effect.notes && effect.notes.length) {
      for (const note of effect.notes) agg.notes.push(`${label}: ${note}`);
    }
  }

  return agg;
}

// ─── Effective SPECIAL (base + permanent Gain-X perks + active chem effects) ──

/** Gain X perks permanently raise a stat by +1 per rank (manual p. Perks). */
const GAIN_STAT_PERKS: Record<string, keyof SPECIALStats> = {
  gain_strength: 'strength',
  gain_perception: 'perception',
  gain_endurance: 'endurance',
  gain_charisma: 'charisma',
  gain_intelligence: 'intelligence',
  gain_agility: 'agility',
  gain_luck: 'luck',
};

/** Permanent SPECIAL bonuses from perks (Gain Strength etc.), +1 per rank. */
export function computePerkStatBonuses(
  char: Pick<Character, 'perks'>,
): Partial<SPECIALStats> {
  const out: Partial<SPECIALStats> = {};
  for (const cp of char.perks ?? []) {
    const stat = GAIN_STAT_PERKS[cp.perkId];
    if (stat) out[stat] = (out[stat] ?? 0) + cp.rank;
  }
  return out;
}

export interface EffectiveSpecial {
  /** Final stat values: base + perk bonuses + chem mods (min 1, NO upper cap —
   *  chems may temporarily push a stat past racial limits). */
  stats: SPECIALStats;
  /** Per-stat delta contributed by ACTIVE CHEM EFFECTS only (0 = untouched).
   *  Positive values should render green in the UI. */
  chemDelta: Partial<SPECIALStats>;
  /** True when any chem is currently modifying any stat. */
  hasChemMods: boolean;
}

/**
 * The character's working SPECIAL: base stats plus permanent Gain-X perks plus
 * temporary chem statMods. Chem boosts may exceed racial maximums by design;
 * the floor is 1. Base `char.special` is never mutated — effects revert simply
 * by ending (the delta disappears from this computation).
 */
export function effectiveSpecial(
  char: Pick<Character, 'special' | 'perks' | 'effects'>,
): EffectiveSpecial {
  const perkBonus = computePerkStatBonuses(char);
  const chem = computeEffectModifiers(char).statMods;
  const stats = { ...char.special };
  const chemDelta: Partial<SPECIALStats> = {};
  let hasChemMods = false;
  for (const key of SPECIAL_KEYS) {
    const withPerks = stats[key] + (perkBonus[key] ?? 0);
    const delta = chem[key] ?? 0;
    stats[key] = Math.max(1, withPerks + delta);
    if (delta !== 0) { chemDelta[key] = delta; hasChemMods = true; }
  }
  return { stats, chemDelta, hasChemMods };
}

/** Re-export so callers can resolve a chem from an effect in one import. */
export { getChem };
