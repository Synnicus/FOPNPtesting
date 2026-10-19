import type { AreaEffectKind, DamageType, TimedAreaEffect } from '../context/types.ts';
import { AMMO_TYPES, type AmmoDamageComponent, type AmmoType } from './ammo.ts';
import { resolveAmmoDamageComponents } from './attackResolution.ts';

export type AreaAttackKind =
  | 'explosion' | 'fragmentation' | 'concussion'
  | 'flamethrower' | 'gasInhaled' | 'gasContact'
  | 'electricity' | 'acid';

export type AreaAttackStatus =
  | 'alarm' | 'silentAlarm' | 'gasExposure' | 'poison'
  | 'spikes' | 'explosive';

/**
 * A component of a non-conventional attack.  The existing resolver accepts a
 * rolled `rawDamage`; these dice fields preserve the manual's source profile
 * so a weapon attack and its area outcome can use the same roll.
 */
export interface AreaAttackComponent {
  id?: string;
  kind: AreaAttackKind;
  damageDieCount: number;
  damageDie: number;
  damageBonus: number;
  damageType: DamageType;
  ammoIgnoresDT?: boolean;
  ammoDRModifier?: number;
  rangeUnit?: 'hex' | 'm';
  radius?: number;
  diameter?: number;
  notes?: readonly string[];
}

export interface AreaDamageProfile {
  id: string;
  name: string;
  rangeUnit: 'hex' | 'm';
  effects: readonly AreaAttackComponent[];
  notes?: readonly string[];
  nonBiologicalOnly?: boolean;
}

export interface AreaZoneEffect extends AreaAttackComponent {
  id: string;
  rawDamage: number;
}

export interface AreaDamageZone {
  id: string;
  label: string;
  minDistance: number;
  maxDistance: number;
  rangeUnit: 'hex' | 'm';
  effects: AreaZoneEffect[];
}

export type AreaProfileRangeOverrides = Record<string, Record<string, number>>;

export interface AreaTarget {
  id: string;
  name: string;
  endurance: number;
  gasInhaledResistance: number;
  gasContactResistance: number;
  electricityResistance: number;
  dt: number;
  dr: number;
  radiationResistance?: number;
  protectionByType?: Partial<Record<DamageType, { dt: number; dr: number }>>;
  damageResistanceCap?: number;
}

export interface AreaAttack {
  /** Unspecified gas canisters require the GM to select exposure before resolution. */
  requiresGasChoice?: boolean;
  kind: AreaAttackKind;
  rawDamage: number;
  /** Source dice for attacks whose damage is rolled by the caller. */
  damageDieCount?: number;
  damageDie?: number;
  damageBonus?: number;
  damageType?: DamageType;
  /** Radius/diameter metadata is retained for callers that select hexes. */
  radius?: number;
  diameter?: number;
  fragmentation?: AreaAttackComponent;
  concussion?: AreaAttackComponent;
  /** Non-damage outcomes remain explicit and are left for GM adjudication. */
  statuses?: readonly AreaAttackStatus[];
  notes?: readonly string[];
  /** Legacy input ignored: manual fire and acid persist until explicitly removed. */
  ongoingRounds?: number;
  /** Required for a missed flamethrower shot after the GM chooses its landing hex. */
  gmAdjudicatedLanding?: boolean;
  /** Optional custom-ammunition riders, independently rolled for every target. */
  components?: readonly AmmoDamageComponent[];
  ammoIgnoresDT?: boolean;
  ammoDRModifier?: number;
  /** Per-target zone assignment for a single atomic multi-zone application. */
  profileId?: string;
  targetZones?: Record<string, string>;
  zones?: AreaDamageZone[];
  sourceDeviceId?: string;
  nonBiologicalOnly?: boolean;
}

/**
 * Manual mines and traps share the same area attack shape used by the AoE
 * resolver.  `rawDamage` is intentionally zero until the caller rolls the
 * source dice; this avoids replacing a printed 1d20/3d20 profile with an
 * approximation.  The source dice remain on the profile for weapon/AoE
 * parity and for callers that roll attacks centrally.
 *
 * The T45 manual entry specifies that targets within four hexes suffer
 * concussion, but does not print a concussion die; that component therefore
 * carries zero damage and an explicit note rather than inventing a value.
 */
export const MINE_TRAP_PROFILES: Readonly<Record<string, AreaAttack>> = {
  t13_antipersonnel_mine: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 1,
    damageDie: 20,
    damageBonus: 20,
    damageType: 'explosion',
    radius: 0,
    fragmentation: {
      kind: 'fragmentation',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'normal',
      radius: 1,
    },
    concussion: {
      kind: 'concussion',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'explosion',
      radius: 3,
    },
    statuses: ['explosive'],
    notes: ['Adjacent hexes take 1d6 fragmentation damage', 'Within 3 hexes take 1d6 concussion damage'],
  },
  t45_se_antivehicle_mine: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 3,
    damageDie: 20,
    damageBonus: 20,
    damageType: 'explosion',
    radius: 0,
    fragmentation: {
      kind: 'fragmentation',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'normal',
      radius: 2,
    },
    concussion: {
      kind: 'concussion',
      damageDieCount: 0,
      damageDie: 0,
      damageBonus: 0,
      damageType: 'explosion',
      radius: 4,
      notes: ['Manual specifies concussion within 4 hexes but does not print its damage die'],
    },
    statuses: ['explosive'],
    notes: ['Within 2 hexes take 1d6 fragmentation damage', 'Within 4 hexes take concussion damage'],
  },
  bullhorn_trap: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['alarm'],
    notes: ['Alarm sounds when the trigger is sprung; hearing range is GM-adjudicated'],
  },
  silent_alarm: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['silentAlarm'],
    notes: ['Alerts another room or area when triggered; recipient and awareness are GM-adjudicated'],
  },
  gas_trap: {
    requiresGasChoice: true,
    kind: 'gasInhaled',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    diameter: 5,
    statuses: ['gasExposure'],
    notes: ['Gas contents and resulting harm are determined by the GM'],
  },
  poison_needle: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['poison'],
    notes: ['Needle delivers poison; poison type, resistance, and duration are GM-adjudicated'],
  },
  pit_of_spikes: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 3,
    damageDie: 10,
    damageBonus: 0,
    damageType: 'normal',
    radius: 0,
    statuses: ['spikes'],
    notes: ['Victim takes 3d10 damage; the manual does not specify an area beyond the pit'],
  },
  explosive_trap: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'explosion',
    radius: 0,
    statuses: ['explosive'],
    notes: ['Bomb and any chained traps are GM-adjudicated; the manual specifies no damage profile'],
  },
  claymore_trap: {
    kind: 'explosion',
    rawDamage: 0,
    damageDieCount: 0,
    damageDie: 0,
    damageBonus: 0,
    damageType: 'explosion',
    radius: 0,
    statuses: ['alarm', 'explosive'],
    notes: ['Combines an explosive trap with a bullhorn alarm; alerts everyone within 200 meters. Blast damage is GM-adjudicated.'],
  },
} as const;

const explosiveAmmoProfileDefinitions: Record<string, {
  rangeUnit: 'hex' | 'm';
  mainKind?: AreaAttackKind;
  mainDamageType?: DamageType;
  mainRadius?: number;
  mainNotes?: string[];
  extraEffects?: AreaAttackComponent[];
  nonBiologicalOnly?: boolean;
  notes?: string[];
}> = {
  rocket_explosive: { rangeUnit: 'm', mainKind: 'explosion', mainDamageType: 'explosion', notes: ['Blast radius is not specified in the manual. Set a campaign range before assigning targets.'] },
  rocket_ap: { rangeUnit: 'm', mainKind: 'explosion', mainDamageType: 'explosion', notes: ['Blast radius is not specified in the manual. Set a campaign range before assigning targets.'] },
  rocket_emp: { rangeUnit: 'm', mainKind: 'explosion', mainDamageType: 'explosion', nonBiologicalOnly: true, notes: ['Non-biological targets only. Blast radius is not specified in the manual.'] },
  tow_ii_rocket: {
    rangeUnit: 'm',
    mainKind: 'explosion',
    mainDamageType: 'explosion',
    notes: ['Damage is listed on the TOW-II Missile Defense System. Enter its resolved damage manually; set the campaign blast range.'],
  },
  '40mm_frag': {
    rangeUnit: 'm',
    mainKind: 'explosion',
    mainDamageType: 'explosion',
    extraEffects: [
      { id: 'concussion', kind: 'concussion', damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'explosion', notes: ['Concussion component'] },
      { id: 'fragmentation', kind: 'fragmentation', damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'normal', notes: ['Fragmentation component'] },
    ],
    notes: ['Manual lists concussion and fragmentation damage but does not specify their ranges. Set each range for this campaign.'],
  },
  '40mm_plasma': {
    rangeUnit: 'm',
    mainKind: 'explosion',
    mainDamageType: 'plasma',
    extraEffects: [
      { id: 'concussion', kind: 'concussion', damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'explosion', notes: ['Concussion component'] },
    ],
    notes: ['Manual does not specify the blast or concussion ranges. Set each range for this campaign.'],
  },
  '40mm_pulse': { rangeUnit: 'm', mainKind: 'explosion', mainDamageType: 'explosion', nonBiologicalOnly: true, notes: ['Non-biological targets only. Blast radius is not specified in the manual.'] },
  '51mm_explosive_mortar': {
    rangeUnit: 'm',
    mainKind: 'explosion',
    mainDamageType: 'explosion',
    mainRadius: 20,
    extraEffects: [
      { id: 'concussion', kind: 'concussion', damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'explosion', radius: 50, rangeUnit: 'm' },
    ],
    notes: ['10d10 within 20m; 1d6 concussion within 50m.'],
  },
  '51mm_gas_mortar': {
    rangeUnit: 'm',
    mainKind: 'gasInhaled',
    mainDamageType: 'normal',
    mainRadius: 100,
    notes: ['7d10 and unconsciousness within 100m; unconsciousness outcome remains GM-adjudicated.'],
  },
  '60mm_explosive_mortar': {
    rangeUnit: 'm',
    mainKind: 'explosion',
    mainDamageType: 'explosion',
    mainRadius: 20,
    extraEffects: [
      { id: 'concussion', kind: 'concussion', damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'explosion', radius: 50, rangeUnit: 'm' },
    ],
    notes: ['10d10 within 20m; 1d6 concussion within 50m.'],
  },
  '60mm_plasma_mortar': {
    rangeUnit: 'm',
    mainKind: 'explosion',
    mainDamageType: 'plasma',
    mainRadius: 20,
    notes: ['10d20 to everything within 20m.'],
  },
  '60mm_pulse_mortar': {
    rangeUnit: 'm',
    mainKind: 'explosion',
    mainDamageType: 'explosion',
    mainRadius: 20,
    nonBiologicalOnly: true,
    notes: ['20d20 to non-biological targets within 20m.'],
  },
};

function ammoDamageEffect(
  ammo: AmmoType | undefined,
  id: string,
  kind: AreaAttackKind,
  damageType: DamageType,
  radius?: number,
  rangeUnit?: 'hex' | 'm',
): AreaAttackComponent {
  return {
    id,
    kind,
    damageDieCount: ammo?.dmgDieCount ?? 0,
    damageDie: ammo?.dmgDie ?? 0,
    damageBonus: ammo?.dmgBonus ?? 0,
    damageType,
    ...(radius === undefined ? {} : { radius }),
    ...(rangeUnit ? { rangeUnit } : {}),
    ...(ammo?.ignoresDT ? { ammoIgnoresDT: true } : {}),
    ...(ammo?.drMod ? { ammoDRModifier: ammo.drMod } : {}),
  };
}

/** Built-in launched area ammunition with manual values retained verbatim. */
export const EXPLOSIVE_AMMO_AREA_PROFILES: readonly AreaDamageProfile[] =
  Object.entries(explosiveAmmoProfileDefinitions).map(([ammoId, definition]) => {
    const ammo = AMMO_TYPES.find(candidate => candidate.id === ammoId);
    const main = ammoDamageEffect(
      ammo,
      'main',
      definition.mainKind ?? 'explosion',
      definition.mainDamageType ?? 'explosion',
      definition.mainRadius,
      definition.rangeUnit,
    );
    const effects = [
      main,
      ...(definition.extraEffects ?? []).map(effect => ({
        ...effect,
        rangeUnit: effect.rangeUnit ?? definition.rangeUnit,
      })),
    ];
    return {
      id: `ammo:${ammoId}`,
      name: ammo?.name ?? ammoId,
      rangeUnit: definition.rangeUnit,
      effects,
      notes: [
        ...(definition.notes ?? []),
        ...(ammo?.notes ? [ammo.notes] : []),
      ],
      ...(definition.nonBiologicalOnly ? { nonBiologicalOnly: true } : {}),
    };
  });

const MINE_TRAP_AOE_PROFILE_IDS = new Set([
  't13_antipersonnel_mine',
  't45_se_antivehicle_mine',
  'explosive_trap',
  'claymore_trap',
]);

export function createMineTrapAreaDamageProfiles(): AreaDamageProfile[] {
  return [...MINE_TRAP_AOE_PROFILE_IDS].flatMap(id => {
    const attack = MINE_TRAP_PROFILES[id];
    if (!attack) return [];
    const components: AreaAttackComponent[] = [
      {
        id: 'main',
        kind: attack.kind,
        damageDieCount: attack.damageDieCount ?? 0,
        damageDie: attack.damageDie ?? 0,
        damageBonus: attack.damageBonus ?? 0,
        damageType: attack.damageType ?? 'explosion',
        rangeUnit: 'hex',
        ...(attack.radius === undefined || id === 'explosive_trap' || id === 'claymore_trap'
          ? {}
          : { radius: attack.radius }),
        ...(attack.notes?.length ? { notes: attack.notes } : {}),
      },
      ...(['fragmentation', 'concussion'] as const).flatMap(key => {
        const component = attack[key];
        return component ? [{
          ...component,
          id: key,
          rangeUnit: component.rangeUnit ?? 'hex',
        }] : [];
      }),
    ];
    return [{
      id: `trap:${id}`,
      name: ({
        t13_antipersonnel_mine: 'T13 Antipersonnel Mine',
        t45_se_antivehicle_mine: 'T45-SE Antivehicle Mine',
        explosive_trap: 'Explosive Trap',
        claymore_trap: 'Claymore Trap',
      } as Record<string, string>)[id] ?? catalogAreaProfileLabel(id),
      rangeUnit: 'hex',
      effects: components,
      ...(attack.notes ? { notes: attack.notes } : {}),
    }];
  });
}

export const MINE_TRAP_AOE_PROFILES = createMineTrapAreaDamageProfiles();

export function catalogAreaProfileLabel(id: string): string {
  return id
    .split('_')
    .map(part => part.length ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

export const ALL_BUILT_IN_AREA_DAMAGE_PROFILES: readonly AreaDamageProfile[] = [
  ...EXPLOSIVE_AMMO_AREA_PROFILES,
  ...MINE_TRAP_AOE_PROFILES,
];

export function areaProfileRange(profile: AreaDamageProfile, effect: AreaAttackComponent, overrides: AreaProfileRangeOverrides): number | undefined {
  return effect.radius ?? overrides[profile.id]?.[effect.id ?? 'main'];
}

export function missingAreaProfileRanges(profile: AreaDamageProfile, overrides: AreaProfileRangeOverrides): AreaAttackComponent[] {
  return profile.effects.filter(effect => areaProfileRange(profile, effect, overrides) === undefined);
}

export function buildAreaDamageZones(
  profile: AreaDamageProfile,
  overrides: AreaProfileRangeOverrides,
  rawDamageByEffect: Record<string, number>,
): AreaDamageZone[] {
  const effects = profile.effects.flatMap(effect => {
    const id = effect.id ?? 'main';
    const maxDistance = areaProfileRange(profile, effect, overrides);
    if (maxDistance === undefined) return [];
    return [{ ...effect, id, maxDistance, rawDamage: Math.max(0, rawDamageByEffect[id] ?? 0) }];
  });
  const thresholds = [...new Set(effects.map(effect => effect.maxDistance))].sort((a, b) => a - b);
  return thresholds.map((maxDistance, index) => {
    const minDistance = index === 0 ? 0 : thresholds[index - 1] + 1;
    const label = maxDistance === 0
      ? `Center (0 ${profile.rangeUnit})`
      : minDistance === 0
        ? `0–${maxDistance} ${profile.rangeUnit}`
        : minDistance === maxDistance
          ? `${maxDistance} ${profile.rangeUnit}`
          : `${minDistance}–${maxDistance} ${profile.rangeUnit}`;
    return {
      id: `${profile.id}:zone:${maxDistance}`,
      label,
      minDistance,
      maxDistance,
      rangeUnit: profile.rangeUnit,
      effects: effects
        .filter(effect => effect.maxDistance >= maxDistance)
        .map(({ maxDistance: _maxDistance, ...effect }) => effect),
    };
  });
}

export function normalizeAreaProfileRangeOverrides(value: unknown): AreaProfileRangeOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: AreaProfileRangeOverrides = {};
  for (const [profileId, rawValues] of Object.entries(value)) {
    if (!profileId || !rawValues || typeof rawValues !== 'object' || Array.isArray(rawValues)) continue;
    const values: Record<string, number> = {};
    for (const [effectId, rawRange] of Object.entries(rawValues)) {
      if (effectId && typeof rawRange === 'number' && Number.isInteger(rawRange) && rawRange >= 0 && rawRange <= 100000) {
        values[effectId] = rawRange;
      }
    }
    if (Object.keys(values).length) normalized[profileId] = values;
  }
  return normalized;
}

export function isValidAreaProfileRangeOverrides(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([profileId, rawValues]) =>
    !!profileId
    && !!rawValues
    && typeof rawValues === 'object'
    && !Array.isArray(rawValues)
    && Object.entries(rawValues).every(([effectId, rawRange]) =>
      !!effectId && typeof rawRange === 'number' && Number.isInteger(rawRange) && rawRange >= 0 && rawRange <= 100000),
  );
}

export interface AreaResolution {
  targetId: string;
  targetName: string;
  damage: number;
  resisted: boolean;
  resistanceRoll?: number;
  enduranceRoll?: number;
  unconsciousRounds: number;
  ongoing?: {
    kind: AreaEffectKind;
    persistent: true;
    damageDieCount: number;
    damageDie: number;
    damageBonus: number;
    damageType: DamageType;
  };
  /** Structured trap/status outcomes; omitted on legacy manually-created receipts. */
  statuses?: AreaAttackStatus[];
  notes: string[];
  componentBreakdown?: string[];
  radiationExposure?: number;
  zoneId?: string;
  zoneLabel?: string;
}

export type PercentRoller = () => number;
export type DieRoller = (sides: number) => number;

function applyProtection(rawDamage: number, dt: number, dr: number): number {
  const afterDT = Math.max(0, rawDamage - dt);
  return Math.max(0, Math.round(afterDT * (1 - dr / 100)));
}

function exposureResistance(kind: AreaAttackKind, target: AreaTarget): number {
  if (kind === 'gasInhaled') return target.gasInhaledResistance;
  if (kind === 'gasContact') return target.gasContactResistance;
  return 0;
}

export function resolveAreaTarget(
  attack: AreaAttack,
  target: AreaTarget,
  rollPercent: PercentRoller = () => Math.floor(Math.random() * 100) + 1,
  rollDie: DieRoller = sides => Math.floor(Math.random() * sides) + 1,
): AreaResolution {
  if (attack.requiresGasChoice) throw new Error('GM must select the gas payload/exposure before applying the trap.');
  const notes: string[] = [...(attack.notes ?? [])];
  const statuses = [...(attack.statuses ?? [])];
  if (statuses.length) notes.push(`Status requires GM adjudication: ${statuses.join(', ')}`);
  const resistance = Math.max(0, Math.min(100, exposureResistance(attack.kind, target)));
  let resistanceRoll: number | undefined;
  let resisted = false;
  if (resistance > 0) {
    resistanceRoll = rollPercent();
    resisted = resistanceRoll <= resistance;
    notes.push(`${attack.kind === 'electricity' ? 'Electricity' : 'Gas'} resistance ${resistance}%: rolled ${resistanceRoll} — ${resisted ? 'resisted' : 'failed'}`);
  }

  if (attack.kind === 'gasInhaled' || attack.kind === 'gasContact') {
    notes.push(attack.kind === 'gasInhaled' ? 'Inhaled exposure' : 'Contact exposure');
    return {
      targetId: target.id, targetName: target.name,
      damage: resisted ? 0 : Math.max(0, attack.rawDamage),
      resisted, resistanceRoll, unconsciousRounds: 0, statuses, notes,
    };
  }

  let protectedDamage = attack.kind === 'electricity'
    ? Math.max(0, Math.round(attack.rawDamage * (1 - Math.min(100, target.electricityResistance) / 100)))
    : applyProtection(attack.rawDamage, attack.kind === 'concussion' ? 0 : target.dt, target.dr);
  let componentBreakdown: string[] | undefined;
  let radiationExposure = 0;
  if (attack.components?.length) {
    const componentResult = resolveAmmoDamageComponents({
      components: attack.components,
      rollDie,
      radiationResistance: target.radiationResistance ?? 0,
      resolveProtection: damageType => {
        const typed = target.protectionByType?.[damageType] ?? { dt: target.dt, dr: target.dr };
        return {
          damageThreshold: attack.ammoIgnoresDT ? 0 : typed.dt,
          damageResistance: Math.max(0, Math.min(target.damageResistanceCap ?? 90, typed.dr + (attack.ammoDRModifier ?? 0))),
        };
      },
    });
    protectedDamage += componentResult.totalHpDamage;
    radiationExposure = componentResult.totalRadiation;
    componentBreakdown = componentResult.components.map(component =>
      component.component.type === 'radiation'
        ? `${component.component.label}: ${component.rawDamage} radiation → ${component.finalRadiation ?? 0} unapplied exposure`
        : `${component.component.label} (${component.component.type}): ${component.rawDamage} → ${component.finalHp ?? 0} HP`);
    notes.push(...componentBreakdown);
    if (radiationExposure > 0) notes.push(`Radiation exposure not yet applied: ${radiationExposure}`);
  }
  let enduranceRoll: number | undefined;
  let unconsciousRounds = 0;
  if (attack.kind === 'electricity') {
    enduranceRoll = rollDie(10);
    notes.push(`Electricity resistance ${target.electricityResistance}% reduced ${attack.rawDamage} to ${protectedDamage} damage`);
    if (enduranceRoll > target.endurance) {
      unconsciousRounds = rollDie(10);
      notes.push(`Endurance ${target.endurance}: rolled ${enduranceRoll} — unconscious ${unconsciousRounds} rounds`);
    } else {
      notes.push(`Endurance ${target.endurance}: rolled ${enduranceRoll} — remained conscious`);
    }
  }

  let ongoing: AreaResolution['ongoing'];
  if (attack.kind === 'flamethrower' || attack.kind === 'acid') {
    ongoing = {
      kind: attack.kind === 'acid' ? 'acid' : 'fire',
      persistent: true,
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'fire',
    };
    notes.push(ongoing.kind === 'fire'
      ? 'On fire: 1d6/round until a full round is spent rolling to extinguish it'
      : 'Covered in acid: 1d6/round until washed off with an appropriate material');
  }
  if (attack.kind === 'flamethrower' && attack.gmAdjudicatedLanding) {
    notes.push('Miss landing/scatter chosen by GM; target lies in the adjudicated firestream');
  }
  if (attack.kind === 'concussion') notes.push('Concussion ignores DT; DR still applies');

  return {
    targetId: target.id, targetName: target.name, damage: protectedDamage,
    resisted, resistanceRoll, enduranceRoll, unconsciousRounds, ongoing, statuses, notes,
    componentBreakdown, radiationExposure,
  };
}

export function resolveAreaZoneTarget(
  zone: AreaDamageZone,
  target: AreaTarget,
  rollPercent: PercentRoller = () => Math.floor(Math.random() * 100) + 1,
  rollDie: DieRoller = sides => Math.floor(Math.random() * sides) + 1,
): AreaResolution {
  const results = zone.effects.map(effect => resolveAreaTarget({
    kind: effect.kind,
    rawDamage: effect.rawDamage,
    damageType: effect.damageType,
    notes: effect.notes,
    ammoIgnoresDT: effect.ammoIgnoresDT,
    ammoDRModifier: effect.ammoDRModifier,
  }, target, rollPercent, rollDie));
  const first = results[0];
  const notes = results.flatMap((result, index) =>
    result.notes.map(note => zone.effects[index] ? `${zone.effects[index].id}: ${note}` : note));
  if (!results.length) {
    return {
      targetId: target.id,
      targetName: target.name,
      damage: 0,
      resisted: false,
      unconsciousRounds: 0,
      statuses: [],
      notes: ['No damage components are configured for this zone.'],
      zoneId: zone.id,
      zoneLabel: zone.label,
    };
  }
  return {
    targetId: target.id,
    targetName: target.name,
    damage: results.reduce((sum, result) => sum + result.damage, 0),
    resisted: results.every(result => result.resisted),
    resistanceRoll: first?.resistanceRoll,
    enduranceRoll: results.find(result => result.enduranceRoll !== undefined)?.enduranceRoll,
    unconsciousRounds: Math.max(0, ...results.map(result => result.unconsciousRounds)),
    ongoing: results.find(result => result.ongoing)?.ongoing,
    statuses: [...new Set(results.flatMap(result => result.statuses ?? []))],
    notes,
    componentBreakdown: results.flatMap(result => result.componentBreakdown ?? []),
    radiationExposure: results.reduce((sum, result) => sum + (result.radiationExposure ?? 0), 0),
    zoneId: zone.id,
    zoneLabel: zone.label,
  };
}

export function formatAreaResolution(result: AreaResolution): string {
  const parts = [`${result.targetName}: ${result.damage} damage`];
  if (result.zoneLabel) parts.push(result.zoneLabel);
  if (result.resisted) parts.push('resisted');
  if (result.unconsciousRounds > 0) parts.push(`unconscious ${result.unconsciousRounds} rounds`);
  if (result.radiationExposure) parts.push(`${result.radiationExposure} radiation exposure (not yet applied)`);
  if (result.statuses?.length) parts.push(result.statuses.join(', '));
  if (result.ongoing) parts.push(`${result.ongoing.kind} (1d6/round until removed)`);
  if (result.notes.length) parts.push(result.notes.join('; '));
  return parts.join(' · ');
}

export function countdownStatus(roundsLeft: number, isActive: boolean): { roundsLeft: number; isActive: boolean } {
  if (!isActive) return { roundsLeft: Math.max(0, roundsLeft), isActive: false };
  const next = Math.max(0, roundsLeft - 1);
  return { roundsLeft: next, isActive: next > 0 };
}

export function advanceAreaEffect(effect: TimedAreaEffect): TimedAreaEffect | null {
  if (effect.persistent) return effect.removeAfterTick ? null : effect;
  const roundsLeft = Math.max(0, (effect.roundsLeft ?? 0) - 1);
  return roundsLeft > 0 ? { ...effect, roundsLeft } : null;
}