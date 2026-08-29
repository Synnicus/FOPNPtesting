/**
 * Exhaustive automation inventory for the rule records in traits.ts and
 * perks.ts. This is deliberately independent of those modules so the audit can
 * be used by Node tooling without loading the application's path aliases.
 *
 * Classification semantics:
 * - automatic: the current rules code applies the effect without an extra
 *   player/GM decision.
 * - conditional: the current rules code applies it when its represented
 *   trigger/target/weapon condition is met.
 * - oneTime: an acquisition-time mutation or choice must be recorded once.
 * - contextualManual: the rule depends on fiction, GM adjudication, dialogue,
 *   world state, or another context the character/combat model does not own.
 * - missingSystem: the effect is mechanical, but no complete current rule path
 *   applies it. A combatNote or description alone is not automation.
 */
export type RuleAutomationClassification =
  | 'automatic'
  | 'conditional'
  | 'oneTime'
  | 'contextualManual'
  | 'missingSystem';

export type AuditedRuleKind = 'trait' | 'perk';

export interface RuleAutomationAuditRecord {
  kind: AuditedRuleKind;
  id: string;
  status: RuleAutomationClassification;
  reason: string;
  sourceSummary: string;
}

export const TRAIT_RECORD_IDS = [
  'fast_metabolism', 'small_frame', 'one_hander', 'finesse', 'kamikaze',
  'heavy_handed', 'fast_shot', 'bloody_mess', 'jinxed', 'good_natured',
  'chem_reliant', 'chem_resistant', 'night_person', 'skilled', 'gifted',
  'sex_appeal', 'glowing_one', 'tech_wizard', 'fear_the_reaper', 'vat_skin',
  'ham_fisted', 'bruiser', 'domesticated', 'rabid', 'tight_nuts',
  'targeting_computer', 'emp_shielding', 'beta_software',
] as const;

export const PERK_RECORD_IDS = [
  'action_boy_girl', 'adrenaline_rush', 'animal_friend', 'bend_the_rules',
  'better_criticals', 'bluff_master', 'bone_head', 'bonsai',
  'bonus_hth_attacks', 'bonus_hth_damage', 'bonus_move',
  'bonus_ranged_damage', 'bonus_rate_of_fire', 'bracing', 'break_the_rules',
  'brown_noser', 'brutish_hulk', 'cancerous_growth', 'cautious_nature',
  'comprehension', 'crazy_bomber', 'cult_of_personality', 'death_sense',
  'demolition_expert', 'die_hard', 'divine_favor', 'dodger',
  'driving_city_style', 'drunken_master', 'earlier_sequence', 'educated',
  'empathy', 'explorer', 'faster_healing', 'flexible', 'flower_child',
  'fortune_finder', 'gain_agility', 'gain_charisma', 'gain_endurance',
  'gain_intelligence', 'gain_luck', 'gain_perception', 'gain_strength',
  'gambler', 'ghost', 'gunner', 'harmless', 'healer', 'heave_ho',
  'here_and_now', 'hide_of_scars', 'hit_the_deck', 'hth_evade',
  'kama_sutra_master', 'karma_beacon', 'leadfoot', 'leader', 'lifegiver',
  'light_step', 'living_anatomy', 'loner', 'master_thief', 'master_trader',
  'medic', 'mental_block', 'more_criticals', 'mr_fixit', 'mutate',
  'mysterious_stranger', 'negotiator', 'night_vision', 'pack_rat',
  'pathfinder', 'pickpocket', 'presence', 'psychotic', 'pyromaniac',
  'quick_pockets', 'quick_recovery', 'rad_child', 'rad_resistance', 'ranger',
  'road_warrior', 'salesman', 'scout', 'scrounger', 'sharpshooter',
  'silent_death', 'silent_running', 'slayer', 'smooth_talker', 'snakeater',
  'sniper', 'speaker', 'stat', 'steady_arm', 'stonewall', 'strong_back',
  'stunt_devil', 'survivalist', 'swift_learner', 'tag', 'talon_of_fear',
  'team_player', 'thief', 'tough_hide', 'toughness', 'awareness', 'finesse',
  'gunslinger', 'penetrate', 'weapon_handling', 'fast_metabolism',
  'chem_resistant', 'natural_chem_resistant', 'jack_of_all_trades',
  'treasure_hunter', 'pilot', 'glowing_one', 'feral_reversion',
  'super_mutant_upgrade', 'cyborg_systems', 'deathclaw_rampage',
] as const;

interface AuditGroup {
  status: RuleAutomationClassification;
  ids: readonly string[];
  reason: string;
  /** Use this where a record combines an automated rule with a manual gap. */
  reasons?: Readonly<Record<string, string>>;
}

const TRAIT_GROUPS: readonly AuditGroup[] = [
  {
    status: 'automatic',
    ids: [
      'small_frame', 'one_hander', 'finesse', 'kamikaze', 'gifted',
      'tech_wizard', 'ham_fisted', 'bruiser', 'domesticated',
      'targeting_computer',
    ],
    reason: 'The current effective-rules, derived-stat, or attack calculation consumes the complete represented numeric behavior without an additional choice or trigger.',
    reasons: {
      small_frame: 'Automatic: effective SPECIAL adds +1 Agility and carry-weight calculation switches to 15 × effective Strength.',
      one_hander: 'Automatic: the attack calculator applies +20% with one-handed weapons and −40% with two-handed weapons.',
      finesse: 'Automatic: the attack calculator adds +10% critical chance and applies the 0.7 post-DR damage multiplier.',
      kamikaze: 'Automatic: derived rules add +5 Sequence and remove agility-derived natural AC while preserving armor and other natural AC.',
      gifted: 'Automatic: effective SPECIAL adds +1 to every stat, effective skills apply −10%, and skill-points-per-level applies −5.',
      tech_wizard: 'Automatic: effective SPECIAL applies −1 Perception and effective skills add +15% to Science, Repair, and Lockpick.',
      ham_fisted: 'Automatic: tag-skill rules grant free Unarmed and effective skills apply the listed −20% penalties with a zero floor.',
      bruiser: 'Automatic: effective SPECIAL adds +2 Strength and effective derived AP applies the −2 AP penalty.',
      domesticated: 'Automatic: effective SPECIAL adds +1 Intelligence and the attack calculation applies −2 Melee Damage.',
      targeting_computer: 'Automatic: every attack receives +15% to-hit and its AP cost includes the +1 AP penalty.',
    },
  },
  {
    status: 'conditional',
    ids: ['fast_shot', 'night_person'],
    reason: 'The current rules code applies the complete represented numeric effect when its modeled weapon or time-of-day condition is present.',
    reasons: {
      fast_shot: 'Conditional: for ranged weapon attacks the calculator subtracts 1 AP and disables targeted shots; it deliberately has no HtH/Melee effect.',
      night_person: 'Conditional: the persisted day/night period applies the bounded ±1 Perception and Intelligence adjustment using racial limits.',
    },
  },
  {
    status: 'oneTime',
    ids: ['good_natured', 'skilled'],
    reason: 'This record has an acquisition-time skill adjustment; current effective-skill rules represent that adjustment exactly once rather than mutating it repeatedly.',
    reasons: {
      good_natured: 'One-time: effective skills represent the +20% First Aid/Doctor/Speech/Barter and −10% combat-skill starting adjustments without repeatedly changing saved skills.',
      skilled: 'One-time: effective skills represent the initial +10% to all skills; the ongoing +5 skill points per level and one-level-slower perk cadence are also automated.',
    },
  },
  {
    status: 'contextualManual',
    ids: ['bloody_mess', 'jinxed', 'sex_appeal', 'vat_skin'],
    reason: 'This is explicitly a GM/context-facing rule; the relevant fiction, nearby actors, calendar check, reaction, or critical-failure adjudication is not represented and must remain clearly manual.',
  },
  {
    status: 'conditional',
    ids: [],
    reason: 'The represented trigger is evaluated by the current rules engine.',
  },
  {
    status: 'oneTime',
    ids: [],
    reason: 'This rule is applied once when selected.',
  },
  {
    status: 'missingSystem',
    ids: [
      'fast_metabolism', 'heavy_handed', 'chem_reliant', 'chem_resistant',
      'glowing_one', 'fear_the_reaper', 'rabid', 'tight_nuts',
      'emp_shielding', 'beta_software',
    ],
    reason: 'The record has structured data or notes, but the complete manual benefit and drawback are not consumed by a current rules path; notes alone are not automation.',
    reasons: {
      fast_metabolism: 'Missing system: +2 Healing Rate is automated, but the required radiation- and poison-resistance starting-value override is not applied.',
      heavy_handed: 'Missing system: +4 Melee Damage and the 0.7 critical-damage multiplier are automated, but the 30% cripple/unconsciousness reduction is only displayed, not resolved.',
      glowing_one: 'Missing system: +50% Radiation Resistance is automated, but combat light-modifier elimination and the nearby-creature 10-rads/hour effect are not resolved.',
      fear_the_reaper: 'Missing system: human perk cadence is automated, but the mandatory monthly Luck-or-death check has no calendar/roll resolution.',
      beta_software: 'Missing system: tag-skill capacity gains +1 automatically, but the required Luck roll, automatic failure, and combat AP loss for each tag-skill use are not resolved.',
    },
  },
];

const PERK_GROUPS: readonly AuditGroup[] = [
  {
    status: 'automatic',
    ids: [
      'action_boy_girl', 'bonus_hth_attacks', 'bonus_hth_damage', 'bonus_ranged_damage',
      'bonus_rate_of_fire', 'brutish_hulk', 'dodger', 'earlier_sequence',
      'faster_healing', 'gain_agility', 'gain_charisma', 'gain_endurance',
      'gain_intelligence', 'gain_luck', 'gain_perception', 'gain_strength',
      'lifegiver', 'more_criticals', 'pack_rat', 'pyromaniac', 'toughness',
      'finesse', 'penetrate', 'weapon_handling', 'cyborg_systems',
    ],
    reason: 'The current derived/combat rules consume this numeric record directly, including ranks, without requiring an unrepresented choice.',
    reasons: {
      action_boy_girl: 'Automatic: effective derived stats add +1 maximum AP for each Action Boy/Girl rank.',
    },
  },
  {
    status: 'conditional',
    ids: [
      'adrenaline_rush', 'better_criticals', 'die_hard', 'hide_of_scars',
      'hit_the_deck', 'night_vision', 'slayer', 'sniper', 'gunslinger',
      'steady_arm', 'deathclaw_rampage', 'drunken_master',
    ],
    reason: 'The current combat path evaluates the represented HP, attack, weapon, lighting, or damage-type trigger; effects apply only in that modeled context.',
    reasons: {
      drunken_master: 'Conditional: effective skills add +20% Unarmed only while the character has Drunk/Intoxicated condition and owns Drunken Master.',
    },
  },
  {
    status: 'oneTime',
    ids: [
      'driving_city_style', 'gambler', 'here_and_now', 'master_thief',
      'master_trader', 'medic', 'mr_fixit', 'mutate', 'negotiator', 'salesman',
      'speaker', 'stat', 'tag', 'thief',
    ],
    reason: 'The manual/current record calls for an immediate skill, XP, trait, tag, or statistic change at acquisition; it must be recorded once rather than recomputed each render.',
  },
  {
    status: 'contextualManual',
    ids: [
      'animal_friend', 'bluff_master', 'bonsai', 'brown_noser',
      'cautious_nature', 'crazy_bomber', 'cult_of_personality', 'divine_favor',
      'empathy', 'explorer', 'fortune_finder', 'kama_sutra_master',
      'karma_beacon', 'mysterious_stranger', 'presence', 'ranger', 'scout',
      'scrounger', 'smooth_talker', 'team_player', 'awareness',
      'treasure_hunter',
    ],
    reason: 'This record depends on GM adjudication or unmodeled dialogue, reaction, encounter, loot, party, calendar, or narrative context; it is intentionally described as manual, not automated.',
  },
  {
    status: 'missingSystem',
    ids: [
      'bend_the_rules', 'bone_head', 'bonus_move', 'bracing',
      'break_the_rules', 'cancerous_growth', 'comprehension', 'death_sense',
      'demolition_expert', 'educated', 'flexible',
      'flower_child', 'ghost', 'gunner', 'harmless', 'healer', 'heave_ho',
      'hth_evade', 'leadfoot', 'leader', 'light_step', 'living_anatomy',
      'loner', 'mental_block', 'pathfinder', 'pickpocket', 'psychotic',
      'quick_pockets', 'quick_recovery', 'rad_child', 'rad_resistance',
      'road_warrior', 'sharpshooter', 'silent_death', 'silent_running',
      'snakeater', 'stonewall', 'strong_back', 'stunt_devil', 'survivalist',
      'swift_learner', 'talon_of_fear', 'tough_hide', 'fast_metabolism',
      'chem_resistant', 'natural_chem_resistant', 'jack_of_all_trades', 'pilot',
      'glowing_one', 'feral_reversion', 'super_mutant_upgrade',
    ],
    reason: 'This is a mechanical rule, but its full effect or trigger is not represented by a current rules path; a description or combatNote by itself is not automation.',
  },
];

const LEGACY_PERK_IDS = new Set([
  'finesse', 'gunslinger', 'penetrate', 'weapon_handling', 'fast_metabolism',
  'chem_resistant', 'natural_chem_resistant', 'jack_of_all_trades',
  'treasure_hunter', 'pilot', 'glowing_one', 'feral_reversion',
  'super_mutant_upgrade', 'cyborg_systems', 'deathclaw_rampage',
]);

function buildAudit(
  kind: AuditedRuleKind,
  expectedIds: readonly string[],
  groups: readonly AuditGroup[],
): Readonly<Record<string, RuleAutomationAuditRecord>> {
  const expected = new Set(expectedIds);
  if (expected.size !== expectedIds.length) {
    throw new Error(`Duplicate ${kind} id in audit authority list`);
  }

  const out: Record<string, RuleAutomationAuditRecord> = {};
  for (const group of groups) {
    for (const id of group.ids) {
      if (!expected.has(id)) throw new Error(`Unknown ${kind} audit id: ${id}`);
      if (out[id]) throw new Error(`Duplicate ${kind} audit classification: ${id}`);
      const legacy = kind === 'perk' && LEGACY_PERK_IDS.has(id);
      out[id] = Object.freeze({
        kind,
        id,
        status: group.status,
        reason: group.reasons?.[id] ?? group.reason,
        sourceSummary: legacy
          ? `Current PERKS compatibility record "${id}"; not claimed as a verbatim Fallout PnP 2.0 manual perk.`
          : `Fallout PnP 2.0 manual rule, summarized by the current ${kind === 'trait' ? 'TRAITS' : 'PERKS'} record "${id}".`,
      });
    }
  }

  const missing = expectedIds.filter(id => !out[id]);
  if (missing.length) throw new Error(`Unclassified ${kind} audit ids: ${missing.join(', ')}`);
  return Object.freeze(out);
}

export const TRAIT_AUTOMATION_AUDIT = buildAudit('trait', TRAIT_RECORD_IDS, TRAIT_GROUPS);
export const PERK_AUTOMATION_AUDIT = buildAudit('perk', PERK_RECORD_IDS, PERK_GROUPS);

export const RULE_AUTOMATION_AUDIT: readonly RuleAutomationAuditRecord[] =
  Object.freeze([
    ...TRAIT_RECORD_IDS.map(id => TRAIT_AUTOMATION_AUDIT[id]),
    ...PERK_RECORD_IDS.map(id => PERK_AUTOMATION_AUDIT[id]),
  ]);

export function getRuleAutomationAudit(
  kind: 'trait',
  id: string,
): RuleAutomationAuditRecord | undefined;
export function getRuleAutomationAudit(
  kind: 'perk',
  id: string,
): RuleAutomationAuditRecord | undefined;
export function getRuleAutomationAudit(
  kind: AuditedRuleKind,
  id: string,
): RuleAutomationAuditRecord | undefined {
  return kind === 'trait' ? TRAIT_AUTOMATION_AUDIT[id] : PERK_AUTOMATION_AUDIT[id];
}