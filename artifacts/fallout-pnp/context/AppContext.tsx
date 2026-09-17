import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, CharacterPerk, InitiativeEntry, Injury, PositionType, SPECIALStats, Weapon, Armor, WeaponAmmoState, ActiveEffect, BestiaryTemplate } from '@/context/types';
import { BUILT_IN_WEAPONS, getWeaponHands } from '@/data/weapons';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { calcBaseSkills, calcMaxHP } from '@/data/derived';
import { clampConditionBoxes, CONDITION_BOXES_MAX } from '@/data/condition';
import { computeModEffects } from '@/data/mods';
import { resolveHpChange } from '@/data/conditions';
import { getRaceById } from '@/data/races';
import { resolveArmorAwareSheet } from '@/data/armorEffects';
import { sortInitiativeEntries, syncInitiativeEntrySheet } from '@/data/initiativeSync';
import { RESTORED_BESTIARY } from '@/data/bestiary';

// Effective max AP for a character: derived max plus active chem apMod
// (Jet grants +2 AP, etc.). Floor 1 so a crashing chem never zeroes AP.
// When a knocked-out combatant's own turn begins, one KO turn elapses; they
// wake once the counter runs out (position stays prone until they Get Up).
import { computeEffectModifiers, effectiveSpecial } from '@/data/effects';
import { advanceAreaEffect, AreaAttack, AreaResolution, resolveAreaTarget } from '@/data/areaEffects';
import { consolidatePoisonedEffects } from '@/data/poisonEffects';
import { clearUnconsciousness, setUnconsciousness } from '@/data/unconsciousness';
function koTick<T extends { isKnockedOut: boolean; knockOutRoundsLeft: number }>(c: T): T {
  if (!c.isKnockedOut) return c;
  const left = Math.max(0, (c.knockOutRoundsLeft ?? 0) - 1);
  return { ...c, knockOutRoundsLeft: left, isKnockedOut: left > 0 };
}

function statusTick(c: Character, allArmor: Armor[]): { character: Character; damage: number } {
  const knocked = koTick(c);
  let damage = 0;
  const areaEffects = (knocked.areaEffects ?? []).flatMap(effect => {
    const raw = Array.from({ length: effect.damageDieCount }, () => Math.floor(Math.random() * effect.damageDie) + 1)
      .reduce((sum, roll) => sum + roll, effect.damageBonus);
    const body = knocked.equippedBodyArmorId ? allArmor.find(a => a.id === knocked.equippedBodyArmorId) : undefined;
    const helmet = knocked.equippedHelmetId ? allArmor.find(a => a.id === knocked.equippedHelmetId) : undefined;
    const cap = effect.damageType.charAt(0).toUpperCase() + effect.damageType.slice(1);
    const dt = ((body?.[`dt${cap}` as keyof Armor] as number) ?? 0) + ((helmet?.[`dt${cap}` as keyof Armor] as number) ?? 0);
    const dr = Math.min(90, ((body?.[`dr${cap}` as keyof Armor] as number) ?? 0) + ((helmet?.[`dr${cap}` as keyof Armor] as number) ?? 0));
    const naturalDT = (knocked.naturalProtection?.[`dt${cap}` as keyof typeof knocked.naturalProtection] as number) ?? 0;
    const naturalDR = (knocked.naturalProtection?.[`dr${cap}` as keyof typeof knocked.naturalProtection] as number) ?? 0;
    const afterDT = Math.max(0, raw - dt - naturalDT);
    damage += Math.max(0, Math.round(afterDT * (1 - Math.min(90, dr + naturalDR) / 100)));
    const advanced = advanceAreaEffect(effect);
    return advanced ? [advanced] : [];
  });
  return {
    character: { ...knocked, currentHp: Math.max(0, knocked.currentHp - damage), areaEffects },
    damage,
  };
}

function resolveCharacterArmorSheet(c: Character, allArmor: readonly Armor[], includeTempAC = false) {
  const race = getRaceById(c.race);
  return resolveArmorAwareSheet({
    special: c.special,
    skills: c.skills,
    taggedSkills: c.taggedSkills,
    traits: c.traits,
    perks: c.perks,
    conditions: c.conditions,
    effects: c.effects,
    raceBounds: race ? { min: race.specialMin, max: race.specialMax } : undefined,
    nightPersonPeriod: c.nightPersonPeriod,
    racialNaturalArmorClass: race?.naturalACBonus,
    naturalArmorClass: c.naturalProtection?.armorClass,
    manualDerivedStats: c.manualDerivedStats,
    usesDerivedArmorClass: c.usesDerivedArmorClass,
    tempAC: includeTempAC ? c.tempAC : 0,
    radiationResistance: c.radiationResistance,
    gasResistance: c.gasResistance,
    poisonResistance: c.poisonResistance,
    electricityResistance: c.electricityResistance,
    equippedBodyArmorId: c.equippedBodyArmorId,
    equippedHelmetId: c.equippedHelmetId,
    allArmor,
  });
}

function charMaxAP(c: Character, allArmor: readonly Armor[]): number {
  return resolveCharacterArmorSheet(c, allArmor).maxAP;
}

/** Effective magazine size after mod magazineMult (extended/drum mags etc.). */
function effectiveMagazineSize(weapon: Weapon): number {
  if (weapon.magazineSize <= 0) return weapon.magazineSize;
  const eff = computeModEffects(weapon.mods ?? []);
  return Math.round(weapon.magazineSize * (eff.magazineMult ?? 1));
}

// v4 — new damage types (N/L/F/P/E), DR added to armor, pilot skill, custom bestiary
const STORAGE_KEY = '@fallout_pnp_v4';

interface AppState {
  characters: Character[];
  customWeapons: Weapon[];
  customArmor: Armor[];
  customBestiaryTemplates: BestiaryTemplate[];
  initiativeEntries: InitiativeEntry[];
  currentRound: number;
  combatActive: boolean;
  activeEntryId: string | null;
  /** Ephemeral receipt for the last atomic AoE transaction. */
  areaAttackReceipt?: { requestId: string; results: AreaResolution[] };
  /** true once weapon conditionBoxes use the manual's FILLED 0–10 semantics
   *  (legacy saves stored 0–5 "remaining boxes"). */
  conditionSemanticsV2?: boolean;
}

/** One-time migration: legacy conditionBoxes counted REMAINING boxes (0–5,
 *  5 = pristine). New semantics count FILLED boxes (0–10, 0 = pristine).
 *  Map remaining r → filled (5 − r) × 2. */
function migrateConditionSemantics(parsed: AppState): AppState {
  if (parsed.conditionSemanticsV2) return parsed;
  const migrate = (c: Character): Character => ({
    ...c,
    weaponAmmoStates: (c.weaponAmmoStates ?? []).map(s => ({
      ...s,
      conditionBoxes: Math.max(0, Math.min(10, (5 - Math.max(0, Math.min(5, s.conditionBoxes ?? 5))) * 2)),
    })),
  });
  return { ...parsed, characters: (parsed.characters ?? []).map(migrate), conditionSemanticsV2: true };
}

function reconcileInitiativeCharacters(parsed: AppState): AppState {
  const characters = (parsed.characters ?? []).map(character => ({
    ...character,
    // Migrate finite fire/acid saves from the earlier implementation to the
    // manual lifecycle: both persist until their explicit removal action.
    areaEffects: (character.areaEffects ?? []).map(effect =>
      effect.kind === 'fire' || effect.kind === 'acid'
        ? { ...effect, persistent: true, roundsLeft: undefined, removeAfterTick: false }
        : effect),
  }));
  return {
    ...parsed,
    characters,
    initiativeEntries: (parsed.initiativeEntries ?? []).map(entry => {
      const character = characters.find(c => c.id === entry.characterId);
      if (!character) return entry;
      return {
        ...entry,
        currentHp: character.currentHp,
        maxHp: character.maxHp,
        position: character.position,
        currentAP: character.isKnockedOut ? 0 : entry.currentAP,
      };
    }),
  };
}

/** Add only newly introduced zero/default fields to persisted/imported data. */
function normalizeArmorEffectsData(parsed: AppState): AppState {
  const normalizeArmor = (armor: Armor): Armor => armor.effects
    ? armor
    : { ...armor, effects: { special: {}, skills: {} } };
  const normalizeCharacter = (character: Character): Character => {
    let normalized = typeof character.poisonResistance === 'number'
      ? character
      : { ...character, poisonResistance: 0 };
    const effects = consolidatePoisonedEffects(normalized.effects ?? []);
    if (effects.length !== (normalized.effects ?? []).length
      || effects.some((effect, index) => effect !== normalized.effects?.[index])) {
      normalized = { ...normalized, effects };
    }
    // Break the Rules had no implemented effect before this flag existed, so
    // an older owner necessarily still has the one-time selection available.
    if (
      normalized.breakTheRulesPending === undefined
      && (normalized.perks ?? []).some(perk => perk.perkId === 'break_the_rules')
    ) {
      normalized = { ...normalized, breakTheRulesPending: true };
    }
    // Existing spawned bestiary saves predate the explicit derived-AC policy.
    // Use durable template identity so edited/renamed humanoids migrate safely
    // without changing a coincidentally similar custom NPC.
    if (normalized.type === 'npc' && normalized.usesDerivedArmorClass === undefined) {
      const template = RESTORED_BESTIARY.find(candidate => (
        candidate.usesDerivedArmorClass && candidate.id === normalized.bestiaryTemplateId
      ));
      if (template) normalized = { ...normalized, usesDerivedArmorClass: true };
    }
    if (normalized.race === 'robot' && normalized.poisonResistance !== 100) {
      normalized = { ...normalized, poisonResistance: 100 };
    }
    if (normalized.type === 'npc' && normalized.bestiaryTemplateId) {
      const template = RESTORED_BESTIARY.find(candidate => candidate.id === normalized.bestiaryTemplateId);
      if (template?.category === 'robot' && (normalized.race !== 'robot' || normalized.poisonResistance !== 100)) {
        normalized = { ...normalized, race: 'robot', poisonResistance: 100 };
      }
    }
    return normalized;
  };
  const normalizeTemplate = (template: BestiaryTemplate): BestiaryTemplate => ({
    ...template,
    poisonResistance: template.poisonResistance ?? 0,
    sequence: template.sequence ?? template.special.perception * 2,
  });

  return {
    ...parsed,
    characters: (parsed.characters ?? []).map(normalizeCharacter),
    customArmor: (parsed.customArmor ?? []).map(normalizeArmor),
    customBestiaryTemplates: (parsed.customBestiaryTemplates ?? []).map(normalizeTemplate),
  };
}

function normalizePersistedState(parsed: AppState): AppState {
  return normalizeArmorEffectsData(migrateConditionSemantics(parsed));
}

interface AppContextValue extends AppState {
  allWeapons: Weapon[];
  allArmor: Armor[];

  addCharacter: (char: Character) => void;
  updateCharacter: (char: Character) => void;
  deleteCharacter: (id: string) => void;
  cloneCharacter: (id: string) => void;

  applyDamage: (characterId: string, damage: number) => void;
  healCharacter: (characterId: string, amount: number) => void;
  spendAP: (characterId: string, amount: number) => boolean;
  restoreAP: (characterId: string, amount?: number) => void;
  setPosition: (characterId: string, position: PositionType) => void;
  setKnockedOut: (characterId: string, rounds: number) => void;
  applyAreaAttack: (attack: AreaAttack, characterIds: string[]) => string;
  markAreaEffectForRemoval: (characterId: string, effectId: string) => void;
  removeAreaEffect: (characterId: string, effectId: string) => void;
  addTempAC: (characterId: string, ac: number) => void;
  clearTempAC: (characterId: string) => void;

  spendAmmo: (characterId: string, weaponId: string, shots: number) => boolean;
  reloadWeapon: (characterId: string, weaponId: string) => void;
  jamWeapon: (characterId: string, weaponId: string) => void;
  setWeaponCondition: (characterId: string, weaponId: string, filledBoxes: number) => void;
  setAmmoType: (characterId: string, weaponId: string, ammoTypeId: string | undefined) => void;
  equipWeapon: (characterId: string, weaponId: string, hand?: 'left' | 'right' | 'both') => void;
  setActiveWeapon: (characterId: string, weaponId: string) => void;

  addEffect: (characterId: string, effect: ActiveEffect) => void;
  removeEffect: (characterId: string, effectId: string) => void;
  applyChem: (characterId: string, effect: ActiveEffect) => void;

  addInjury: (characterId: string, injury: Injury) => void;
  removeInjury: (characterId: string, injuryId: string) => void;
  toggleInjury: (characterId: string, injuryId: string) => void;

  startCombat: (entries: InitiativeEntry[]) => void;
  endCombat: () => void;
  addInitiativeEntry: (entry: InitiativeEntry) => void;
  removeInitiativeEntry: (id: string) => void;
  updateInitiativeEntry: (entry: InitiativeEntry) => void;
  moveInitiativeEntry: (id: string, direction: 'up' | 'down') => void;
  nextTurn: () => void;
  nextRound: () => void;
  setActiveEntry: (id: string) => void;

  addCustomWeapon: (w: Weapon) => void;
  updateCustomWeapon: (w: Weapon) => void;
  deleteCustomWeapon: (id: string) => void;
  addCustomArmor: (a: Armor) => void;
  updateCustomArmor: (a: Armor) => void;
  deleteCustomArmor: (id: string) => void;

  addCustomBestiaryTemplate: (t: BestiaryTemplate) => void;
  removeCustomBestiaryTemplate: (id: string) => void;

  exportCampaign: () => string;
  importCampaign: (json: string) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const defaultState: AppState = {
  characters: [],
  customWeapons: [],
  customArmor: [],
  customBestiaryTemplates: [],
  initiativeEntries: [],
  currentRound: 1,
  combatActive: false,
  activeEntryId: null,
};

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/*
// Rebase variant retained below for reference while the incoming AoE flow is
// resolved; shared armor-aware behavior is applied to the active provider.
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = normalizePersistedState(JSON.parse(raw) as AppState);
          setState({ ...defaultState, ...parsed });
        } catch (_) {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  // ─── Character CRUD ─────────────────────────────────────────────────────────

  const addCharacter = useCallback((char: Character) => {
    setState(s => ({ ...s, characters: [...s.characters, char] }));
  }, []);

  const updateCharacter = useCallback((char: Character) => {
    setState(s => {
      const sheet = resolveCharacterArmorSheet(char, [...BUILT_IN_ARMOR, ...s.customArmor]);
      const normalized = { ...char, currentAP: Math.min(char.currentAP, sheet.maxAP) };
      return {
        ...s,
        characters: s.characters.map(c => c.id === char.id ? normalized : c),
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry =>
          entry.characterId === char.id ? syncInitiativeEntrySheet(entry, sheet) : entry
        )),
      };
    });
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.filter(c => c.id !== id),
      initiativeEntries: s.initiativeEntries.filter(e => e.characterId !== id),
    }));
  }, []);

  const cloneCharacter = useCallback((id: string) => {
    setState(s => {
      const src = s.characters.find(c => c.id === id);
      if (!src) return s;
      return { ...s, characters: [...s.characters, { ...src, id: genId(), name: `${src.name} (Clone)` }] };
    });
  }, []);

  // ─── Combat Stats ────────────────────────────────────────────────────────────

  const applyDamage = useCallback((characterId: string, damage: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, currentHp: Math.max(0, c.currentHp - damage) }
        : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
        ? { ...e, currentHp: Math.max(0, e.currentHp - damage) }
        : e),
    }));
  }, []);

  const healCharacter = useCallback((characterId: string, amount: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const nextHp = resolveHpChange(char, Math.max(0, amount));
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId ? { ...c, currentHp: nextHp } : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, currentHp: Math.min(e.maxHp, nextHp) }
          : e),
      };
    });
  }, []);

  const spendAP = useCallback((characterId: string, amount: number): boolean => {
    let success = false;
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char || char.currentAP < amount) { success = false; return s; }
      success = true;
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId
          ? { ...c, currentAP: c.currentAP - amount }
          : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, currentAP: e.currentAP - amount }
          : e),
      };
    });
    return success;
  }, []);

  const restoreAP = useCallback((characterId: string, amount?: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const maxAP = charMaxAP(char, [...BUILT_IN_ARMOR, ...s.customArmor]);
      const currentAP = amount !== undefined ? Math.min(maxAP, char.currentAP + amount) : maxAP;
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId ? { ...c, currentAP } : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, maxAP, currentAP: amount !== undefined ? Math.min(maxAP, e.currentAP + amount) : maxAP }
          : e),
      };
    });
  }, []);

  // Knock a character unconscious for N of their own turns. 0 rounds wakes them.
  const setKnockedOut = useCallback((characterId: string, rounds: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? setUnconsciousness(c, rounds)
        : c),
    }));
  }, []);

  const setPosition = useCallback((characterId: string, position: PositionType) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, position } : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId ? { ...e, position } : e),
    }));
  }, []);

  const addTempAC = useCallback((characterId: string, ac: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, tempAC: c.tempAC + ac } : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId ? { ...e, tempAC: e.tempAC + ac } : e),
    }));
  }, []);

  const clearTempAC = useCallback((characterId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, tempAC: 0 } : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId ? { ...e, tempAC: 0 } : e),
    }));
  }, []);

  // ─── Weapon Ammo ────────────────────────────────────────────────────────────

  const spendAmmo = useCallback((characterId: string, weaponId: string, shots: number): boolean => {
    let success = false;
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) { success = false; return s; }
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon || weapon.magazineSize === 0) { success = true; return s; }
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const current = existing ? existing.currentAmmo : effectiveMagazineSize(weapon);
      if (current < shots) { success = false; return s; }
      success = true;
      const newStates: WeaponAmmoState[] = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: current - shots, conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0), ammoTypeId: existing?.ammoTypeId });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
    return success;
  }, []);

  const reloadWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon) return s;
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: effectiveMagazineSize(weapon), conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0), ammoTypeId: existing?.ammoTypeId });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Ammo type (loaded round) ─────────────────────────────────────────────────
  const setAmmoType = useCallback((characterId: string, weaponId: string, ammoTypeId: string | undefined) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({
        weaponId,
        currentAmmo: existing?.currentAmmo ?? (weapon ? effectiveMagazineSize(weapon) : 0),
        conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0),
        ammoTypeId,
      });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Weapon equip / switch (hand slots + inventory) ───────────────────────────
  const equipWeapon = useCallback((characterId: string, weaponId: string, hand: 'left' | 'right' | 'both' = 'both') => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon) return s;
      const hands = getWeaponHands(weapon);
      // Two-handed weapons always occupy both hands regardless of the request.
      const useBoth = hands === 2 || hand === 'both';
      let leftHandWeaponId = char.leftHandWeaponId;
      let rightHandWeaponId = char.rightHandWeaponId;
      if (useBoth) {
        leftHandWeaponId = weaponId;
        rightHandWeaponId = weaponId;
      } else {
        // Placing a 1-handed weapon in one hand: if the OTHER hand currently
        // holds a two-handed weapon (same id in both hands), it must be
        // stowed — clear it so the 1H weapon doesn't share hands with a 2H.
        const otherId = hand === 'left' ? rightHandWeaponId : leftHandWeaponId;
        const otherWeapon = otherId ? [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === otherId) : undefined;
        const otherIsTwoHanded = otherWeapon ? getWeaponHands(otherWeapon) === 2 : false;
        // Also never let a 1-handed weapon occupy both hand slots — if the
        // other hand already holds this same weapon id, clear it.
        if (hand === 'left') {
          leftHandWeaponId = weaponId;
          if (otherIsTwoHanded || rightHandWeaponId === weaponId) rightHandWeaponId = undefined;
        } else {
          rightHandWeaponId = weaponId;
          if (otherIsTwoHanded || leftHandWeaponId === weaponId) leftHandWeaponId = undefined;
        }
      }
      // Keep the inventory (max 5, ids incl. equipped) in sync.
      const inv = (char.inventoryWeaponIds ?? (char.equippedWeaponId ? [char.equippedWeaponId] : []));
      const inventoryWeaponIds = inv.includes(weaponId) ? inv : [...inv, weaponId].slice(0, 5);
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId
          ? { ...c, equippedWeaponId: weaponId, leftHandWeaponId, rightHandWeaponId, inventoryWeaponIds }
          : c),
      };
    });
  }, []);

  // Switch the ACTIVE weapon between weapons already held in the hands —
  // does not touch hand assignments or inventory.
  const setActiveWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => {
        if (c.id !== characterId) return c;
        const held = [c.leftHandWeaponId, c.rightHandWeaponId, c.equippedWeaponId];
        if (!held.includes(weaponId)) return c;
        return { ...c, equippedWeaponId: weaponId };
      }),
    }));
  }, []);

  // ─── Active effects (chems) ───────────────────────────────────────────────────
  const addEffect = useCallback((characterId: string, effect: ActiveEffect) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => {
        if (c.id !== characterId) return c;
        const effects = c.effects ?? [];
        if (!effect.poisonType) return { ...c, effects: [...effects, effect] };
        return { ...c, effects: consolidatePoisonedEffects([...effects, effect]) };
      }),
    }));
  }, []);

  const removeEffect = useCallback((characterId: string, effectId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, effects: (c.effects ?? []).filter(e => e.id !== effectId) }
        : c),
    }));
  }, []);

  // Apply a chem: add its ActiveEffect and immediately resolve any HP heal/damage
  // (hpMod on the effect: positive heals, negative damages).
  const applyChem = useCallback((characterId: string, effect: ActiveEffect) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => {
        if (c.id !== characterId) return c;
        const hpMod = effect.hpMod ?? 0;
        let currentHp = c.currentHp;
        currentHp = resolveHpChange(c, hpMod);
        // Immediate AP boost/drain (Jet +2 AP, crash −AP) applies right away.
        const apMod = effect.apMod ?? 0;
        const withEffect = { ...c, currentHp, effects: [...(c.effects ?? []), effect] };
        const currentAP = apMod !== 0
          ? Math.max(0, Math.min(charMaxAP(withEffect, [...BUILT_IN_ARMOR, ...s.customArmor]), c.currentAP + apMod))
          : c.currentAP;
        return { ...withEffect, currentAP };
      }),
      initiativeEntries: s.initiativeEntries.map(e => {
        if (e.characterId !== characterId) return e;
        const hpMod = effect.hpMod ?? 0;
        let currentHp = e.currentHp;
        const char = s.characters.find(c => c.id === characterId);
        currentHp = char ? Math.min(e.maxHp, resolveHpChange({ ...char, currentHp: e.currentHp, maxHp: e.maxHp }, hpMod)) : currentHp;
        // Keep entry AP in sync with the character (Jet +AP, crash −AP).
        const apMod = effect.apMod ?? 0;
        const sourceCharacter = s.characters.find(c => c.id === characterId);
        const maxAP = sourceCharacter
          ? charMaxAP({ ...sourceCharacter, effects: [...(sourceCharacter.effects ?? []), effect] }, [...BUILT_IN_ARMOR, ...s.customArmor])
          : Math.max(1, e.maxAP + apMod);
        const currentAP = apMod !== 0
          ? Math.max(0, Math.min(maxAP, e.currentAP + apMod))
          : e.currentAP;
        return { ...e, currentHp, maxAP, currentAP };
      }),
    }));
  }, []);

  // A jam/miss FILLS one condition box (0 pristine … 10 jammed).
  const jamWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: existing?.currentAmmo ?? 0, conditionBoxes: clampConditionBoxes((existing?.conditionBoxes ?? 0) + 1), ammoTypeId: existing?.ammoTypeId });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // Directly set FILLED condition boxes (0 pristine … CONDITION_BOXES_MAX jammed).
  const setWeaponCondition = useCallback((characterId: string, weaponId: string, filledBoxes: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({
        weaponId,
        currentAmmo: existing?.currentAmmo ?? (weapon ? effectiveMagazineSize(weapon) : 0),
        conditionBoxes: clampConditionBoxes(filledBoxes),
        ammoTypeId: existing?.ammoTypeId,
      });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Injuries ────────────────────────────────────────────────────────────────

  const addInjury = useCallback((characterId: string, injury: Injury) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: [...(c.injuries ?? []), injury] }
        : c),
    }));
  }, []);

  const removeInjury = useCallback((characterId: string, injuryId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: (c.injuries ?? []).filter(i => i.id !== injuryId) }
        : c),
    }));
  }, []);

  const toggleInjury = useCallback((characterId: string, injuryId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: (c.injuries ?? []).map(i => i.id === injuryId ? { ...i, isActive: !i.isActive } : i) }
        : c),
    }));
  }, []);

  // ─── Initiative / Rounds ─────────────────────────────────────────────────────

  const startCombat = useCallback((entries: InitiativeEntry[]) => {
    const sorted = sortInitiativeEntries(entries);
    setState(s => ({
      ...s,
      initiativeEntries: sorted.map((e, i) => ({ ...e, isActive: i === 0, hasActed: false })),
      currentRound: 1,
      combatActive: true,
      activeEntryId: sorted[0]?.id ?? null,
    }));
  }, []);

  const endCombat = useCallback(() => {
    setState(s => ({
      ...s,
      // Reset every character to its armor-aware full AP and clear temp AC.
      characters: s.characters.map(c => {
        const maxAP = charMaxAP(c, [...BUILT_IN_ARMOR, ...s.customArmor]);
        return { ...clearUnconsciousness(c), currentAP: maxAP, tempAC: 0 };
      }),
      initiativeEntries: [],
      currentRound: 1,
      combatActive: false,
      activeEntryId: null,
    }));
  }, []);

  const addInitiativeEntry = useCallback((entry: InitiativeEntry) => {
    setState(s => {
      const entries = sortInitiativeEntries([...s.initiativeEntries, entry]);
      return { ...s, initiativeEntries: entries };
    });
  }, []);

  const removeInitiativeEntry = useCallback((id: string) => {
    setState(s => ({
      ...s,
      initiativeEntries: s.initiativeEntries.filter(e => e.id !== id),
      activeEntryId: s.activeEntryId === id
        ? (s.initiativeEntries.find(e => e.id !== id)?.id ?? null)
        : s.activeEntryId,
    }));
  }, []);

  const updateInitiativeEntry = useCallback((entry: InitiativeEntry) => {
    setState(s => ({
      ...s,
      initiativeEntries: s.initiativeEntries.map(e => e.id === entry.id ? entry : e),
    }));
  }, []);

  const setActiveEntry = useCallback((id: string) => {
    setState(s => ({ ...s, activeEntryId: id }));
  }, []);

  const nextTurn = useCallback(() => {
    setState(s => {
      if (s.initiativeEntries.length === 0) return s;
      const activeIdx = s.initiativeEntries.findIndex(e => e.id === s.activeEntryId);
      const currentActive = s.initiativeEntries[activeIdx];
      // Convert unspent AP to tempAC for the current entry
      let entries = s.initiativeEntries.map(e => {
        if (e.id === currentActive?.id) {
          return { ...e, hasActed: true, tempAC: e.tempAC + e.currentAP, currentAP: 0 };
        }
        return e;
      });
      // End of the current combatant's turn: convert AP → tempAC and, if
      // knocked out, consume one KO turn NOW (their skipped turn is over).
      let chars = s.characters.map(c => {
        if (c.id === currentActive?.characterId) {
          return koTick({ ...c, tempAC: c.tempAC + c.currentAP, currentAP: 0 });
        }
        return c;
      });
      // If all entries have acted, advance to next round.
      // NOTE: AP/tempAC are NOT reset for everyone — each combatant keeps their
      // tempAC (from unspent AP) until their own turn comes around again.
      if (entries.every(e => e.hasActed)) {
        const round = s.currentRound + 1;
        const firstChar0 = entries[0]?.characterId;
        // Turn start: KO'd combatants get no AP (they can't act this turn).
        const firstKO = !!chars.find(c => c.id === firstChar0)?.isKnockedOut;
        entries = entries.map((e, i) => ({
          ...e, hasActed: false, isActive: i === 0,
          // Only the new active combatant replenishes AP and loses tempAC
          ...(i === 0 ? { currentAP: firstKO ? 0 : e.maxAP, tempAC: 0 } : {}),
        }));
        if (firstChar0) {
          chars = chars.map(c => c.id === firstChar0 ? { ...c, currentAP: c.isKnockedOut ? 0 : charMaxAP(c, [...BUILT_IN_ARMOR, ...s.customArmor]), tempAC: 0 } : c);
        }
        return { ...s, initiativeEntries: entries, characters: chars, currentRound: round, activeEntryId: entries[0].id };
      }
      // Find next unacted entry
      let nextIdx = (activeIdx + 1) % entries.length;
      let loops = 0;
      while (entries[nextIdx]?.hasActed && loops < entries.length) {
        nextIdx = (nextIdx + 1) % entries.length;
        loops++;
      }
      // Turn start: KO'd combatants get no AP (they can't act this turn) —
      // mirrored on both the initiative entry and the character.
      const nextKO = !!chars.find(c => c.id === entries[nextIdx]?.characterId)?.isKnockedOut;
      entries = entries.map((e, i) => ({
        ...e,
        isActive: i === nextIdx,
        ...(i === nextIdx ? { tempAC: 0, currentAP: nextKO ? 0 : e.maxAP } : {}),
      }));
      const nextActive = entries[nextIdx];
      if (nextActive?.characterId) {
        chars = chars.map(c => c.id === nextActive.characterId ? { ...c, currentAP: c.isKnockedOut ? 0 : charMaxAP(c, [...BUILT_IN_ARMOR, ...s.customArmor]), tempAC: 0 } : c);
      }
      return { ...s, initiativeEntries: entries, characters: chars, activeEntryId: nextActive?.id ?? null };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState(s => {
      if (s.initiativeEntries.length === 0) return s;
      const firstChar = s.initiativeEntries[0]?.characterId;
      const prevActiveChar = s.initiativeEntries.find(e => e.id === s.activeEntryId)?.characterId;
      // Skipping ahead ends the previously active combatant's turn — consume a
      // KO turn for them unconditionally (even if they are also first in
      // order), THEN start the new first turn using the ticked state.
      const chars = s.characters.map(c => {
        let out = c.id === prevActiveChar ? koTick(c) : c;
        if (out.id === firstChar) {
          out = { ...out, currentAP: out.isKnockedOut ? 0 : charMaxAP(out, [...BUILT_IN_ARMOR, ...s.customArmor]), tempAC: 0 };
        }
        return out;
      });
      // Only the new active (first) combatant replenishes AP / clears tempAC —
      // everyone else keeps their tempAC until their own turn starts. A still-
      // KO'd first combatant gets no AP (mirrored on entry and character).
      const firstKO = !!chars.find(c => c.id === firstChar)?.isKnockedOut;
      const entries = s.initiativeEntries.map((e, i) => ({
        ...e, hasActed: false, isActive: i === 0,
        ...(i === 0 ? { currentAP: firstKO ? 0 : e.maxAP, tempAC: 0 } : {}),
      }));
      return { ...s, initiativeEntries: entries, characters: chars, currentRound: s.currentRound + 1, activeEntryId: entries[0]?.id ?? null };
    });
  }, []);

  // Move an initiative entry up/down in the turn order
  const moveInitiativeEntry = useCallback((id: string, direction: 'up' | 'down') => {
    setState(s => {
      const idx = s.initiativeEntries.findIndex(e => e.id === id);
      if (idx < 0) return s;
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= s.initiativeEntries.length) return s;
      const entries = [...s.initiativeEntries];
      [entries[idx], entries[swap]] = [entries[swap], entries[idx]];
      return { ...s, initiativeEntries: entries };
    });
  }, []);

  // ─── Custom Equipment ────────────────────────────────────────────────────────

  const addCustomWeapon = useCallback((w: Weapon) => {
    setState(s => ({ ...s, customWeapons: [...s.customWeapons, w] }));
  }, []);
  const updateCustomWeapon = useCallback((w: Weapon) => {
    setState(s => ({ ...s, customWeapons: s.customWeapons.map(x => x.id === w.id ? w : x) }));
  }, []);
  const deleteCustomWeapon = useCallback((id: string) => {
    setState(s => ({ ...s, customWeapons: s.customWeapons.filter(w => w.id !== id) }));
  }, []);
  const addCustomArmor = useCallback((a: Armor) => {
    setState(s => ({
      ...s,
      customArmor: [...s.customArmor, a.effects ? a : { ...a, effects: { special: {}, skills: {} } }],
    }));
  }, []);
  const updateCustomArmor = useCallback((a: Armor) => {
    setState(s => {
      const normalizedArmor = a.effects ? a : { ...a, effects: { special: {}, skills: {} } };
      const customArmor = s.customArmor.map(x => x.id === a.id ? normalizedArmor : x);
      const allArmor = [...BUILT_IN_ARMOR, ...customArmor];
      const characters = s.characters.map(character => {
        const maxAP = charMaxAP(character, allArmor);
        return { ...character, currentAP: Math.min(character.currentAP, maxAP) };
      });
      return {
        ...s,
        customArmor,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          if (!character) return entry;
          const sheet = resolveCharacterArmorSheet(character, allArmor);
          return syncInitiativeEntrySheet(entry, sheet);
        })),
      };
    });
  }, []);
  const deleteCustomArmor = useCallback((id: string) => {
    setState(s => {
      const customArmor = s.customArmor.filter(a => a.id !== id);
      const allArmor = [...BUILT_IN_ARMOR, ...customArmor];
      const characters = s.characters.map(character => {
        const maxAP = charMaxAP(character, allArmor);
        return { ...character, currentAP: Math.min(character.currentAP, maxAP) };
      });
      return {
        ...s,
        customArmor,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          if (!character) return entry;
          const sheet = resolveCharacterArmorSheet(character, allArmor);
          return syncInitiativeEntrySheet(entry, sheet);
        })),
      };
    });
  }, []);

  // ─── Custom Bestiary ─────────────────────────────────────────────────────────

  const addCustomBestiaryTemplate = useCallback((t: BestiaryTemplate) => {
    setState(s => ({
      ...s,
      customBestiaryTemplates: [...s.customBestiaryTemplates, {
        ...t,
        isCustom: true,
        poisonResistance: t.poisonResistance ?? 0,
      }],
    }));
  }, []);
  const removeCustomBestiaryTemplate = useCallback((id: string) => {
    setState(s => ({ ...s, customBestiaryTemplates: s.customBestiaryTemplates.filter(t => t.id !== id) }));
  }, []);

  // ─── Campaign ────────────────────────────────────────────────────────────────

  const exportCampaign = useCallback((): string => JSON.stringify(state, null, 2), [state]);
  const importCampaign = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as AppState;
      if (!Array.isArray(parsed.characters)) return false;
      setState({ ...defaultState, ...normalizePersistedState(parsed) });
      return true;
    } catch (_) { return false; }
  }, []);

  const allWeapons = [...BUILT_IN_WEAPONS, ...state.customWeapons];
  const allArmor = [...BUILT_IN_ARMOR, ...state.customArmor];

  return (
    <AppContext.Provider value={{
      ...state,
      allWeapons, allArmor,
      addCharacter, updateCharacter, deleteCharacter, cloneCharacter,
      applyDamage, healCharacter, spendAP, restoreAP, setPosition, setKnockedOut, addTempAC, clearTempAC,
      spendAmmo, reloadWeapon, jamWeapon, setWeaponCondition, setAmmoType, equipWeapon, setActiveWeapon,
      addEffect, removeEffect, applyChem,
      addInjury, removeInjury, toggleInjury,
      startCombat, endCombat, addInitiativeEntry, removeInitiativeEntry,
      updateInitiativeEntry, moveInitiativeEntry, nextTurn, nextRound, setActiveEntry,
      addCustomWeapon, updateCustomWeapon, deleteCustomWeapon, addCustomArmor, updateCustomArmor, deleteCustomArmor,
      addCustomBestiaryTemplate, removeCustomBestiaryTemplate,
      exportCampaign, importCampaign,
    }}>
      {children}
    </AppContext.Provider>
  );
}
*/
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = reconcileInitiativeCharacters(normalizePersistedState(JSON.parse(raw) as AppState));
          setState({ ...defaultState, ...parsed });
        } catch (_) {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  // ─── Character CRUD ─────────────────────────────────────────────────────────

  const addCharacter = useCallback((char: Character) => {
    setState(s => ({ ...s, characters: [...s.characters, char] }));
  }, []);

  const updateCharacter = useCallback((char: Character) => {
    setState(s => {
      const allArmor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const sheet = resolveCharacterArmorSheet(char, allArmor);
      const normalized = { ...char, currentAP: Math.min(char.currentAP, sheet.maxAP) };
      return {
        ...s,
        characters: s.characters.map(c => c.id === char.id ? normalized : c),
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry =>
          entry.characterId === char.id ? syncInitiativeEntrySheet(entry, sheet) : entry
        )),
      };
    });
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.filter(c => c.id !== id),
      initiativeEntries: s.initiativeEntries.filter(e => e.characterId !== id),
    }));
  }, []);

  const cloneCharacter = useCallback((id: string) => {
    setState(s => {
      const src = s.characters.find(c => c.id === id);
      if (!src) return s;
      return { ...s, characters: [...s.characters, { ...src, id: genId(), name: `${src.name} (Clone)` }] };
    });
  }, []);

  // ─── Combat Stats ────────────────────────────────────────────────────────────

  const applyDamage = useCallback((characterId: string, damage: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, currentHp: Math.max(0, c.currentHp - damage) }
        : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
        ? { ...e, currentHp: Math.max(0, e.currentHp - damage) }
        : e),
    }));
  }, []);

  const healCharacter = useCallback((characterId: string, amount: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const nextHp = resolveHpChange(char, Math.max(0, amount));
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId ? { ...c, currentHp: nextHp } : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, currentHp: Math.min(e.maxHp, nextHp) }
          : e),
      };
    });
  }, []);

  const spendAP = useCallback((characterId: string, amount: number): boolean => {
    let success = false;
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char || char.currentAP < amount) { success = false; return s; }
      success = true;
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId
          ? { ...c, currentAP: c.currentAP - amount }
          : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, currentAP: e.currentAP - amount }
          : e),
      };
    });
    return success;
  }, []);

  const restoreAP = useCallback((characterId: string, amount?: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const maxAP = charMaxAP(char, [...BUILT_IN_ARMOR, ...s.customArmor]);
      const currentAP = amount !== undefined ? Math.min(maxAP, char.currentAP + amount) : maxAP;
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId ? { ...c, currentAP } : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, maxAP, currentAP: amount !== undefined ? Math.min(maxAP, e.currentAP + amount) : maxAP }
          : e),
      };
    });
  }, []);

  // Knock a character unconscious for N of their own turns. 0 rounds wakes them.
  const setKnockedOut = useCallback((characterId: string, rounds: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...setUnconsciousness(c, rounds), ...(rounds > 0 ? { position: 'prone' as const, currentAP: 0 } : {}) }
        : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
        ? { ...e, ...(rounds > 0 ? { position: 'prone' as const, currentAP: 0 } : {}) }
        : e),
    }));
  }, []);

  const applyAreaAttack = useCallback((attack: AreaAttack, characterIds: string[]): string => {
    const requestId = genId();
    // Generate all entropy and IDs before queueing. The updater below resolves
    // against its exact input state and remains deterministic if React replays it.
    const rolls = Object.fromEntries(characterIds.map(id => [id, {
      resistance: Math.floor(Math.random() * 100) + 1,
      endurance: Math.floor(Math.random() * 10) + 1,
      unconscious: Math.floor(Math.random() * 10) + 1,
      effectId: genId(),
    }]));
    setState(s => {
      const armor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const results = characterIds.flatMap(id => {
        const c = s.characters.find(char => char.id === id);
        if (!c) return [];
        const body = c.equippedBodyArmorId ? armor.find(a => a.id === c.equippedBodyArmorId) : undefined;
        const helmet = c.equippedHelmetId ? armor.find(a => a.id === c.equippedHelmetId) : undefined;
        const natural = c.naturalProtection;
        const cap = attack.damageType === 'normal' ? 'Normal'
          : attack.damageType === 'laser' ? 'Laser'
          : attack.damageType === 'fire' ? 'Fire'
          : attack.damageType === 'plasma' ? 'Plasma'
          : attack.damageType === 'explosion' ? 'Explosion'
          : (attack.kind === 'flamethrower' || attack.kind === 'acid' ? 'Fire'
            : attack.kind === 'electricity' ? 'Laser'
            : attack.kind === 'fragmentation' ? 'Normal' : 'Explosion');
        const dt = ((body?.[`dt${cap}` as keyof Armor] as number) ?? 0)
          + ((helmet?.[`dt${cap}` as keyof Armor] as number) ?? 0)
          + ((natural?.[`dt${cap}` as keyof typeof natural] as number) ?? 0);
        const dr = Math.min(90, ((body?.[`dr${cap}` as keyof Armor] as number) ?? 0)
          + ((helmet?.[`dr${cap}` as keyof Armor] as number) ?? 0)
          + ((natural?.[`dr${cap}` as keyof typeof natural] as number) ?? 0));
        // The manual's Environmental Helmet only filters gas with its matching suit.
        const helmetGasActive = helmet?.id !== 'environmental_helmet'
          || body?.id === 'brotherhood_env_armor'
          || body?.id === 'brotherhood_env_armor_mk2';
        const gasInhaled = Math.min(100,
          (c.gasResistanceInhaled ?? c.gasResistance ?? 0)
          + (body?.gasResistanceInhaled ?? 0) + (helmetGasActive ? (helmet?.gasResistanceInhaled ?? 0) : 0));
        const gasContact = Math.min(100,
          (c.gasResistanceContact ?? c.gasResistance ?? 0)
          + (body?.gasResistanceContact ?? 0) + (helmetGasActive ? (helmet?.gasResistanceContact ?? 0) : 0));
        const fixed = rolls[id];
        let dieIndex = 0;
        const dieRolls = [fixed.endurance, fixed.unconscious];
        return [resolveAreaTarget(attack, {
          id: c.id, name: c.name, endurance: effectiveSpecial(c).stats.endurance,
          gasInhaledResistance: gasInhaled,
          gasContactResistance: gasContact,
          electricityResistance: c.electricityResistance ?? 0,
          dt, dr,
        }, () => fixed.resistance, () => dieRolls[Math.min(dieIndex++, dieRolls.length - 1)])];
      });
      const byId = new Map(results.map(r => [r.targetId, r]));
      const characters = s.characters.map(c => {
        const result = byId.get(c.id);
        if (!result) return c;
        const areaEffects = result.ongoing
          ? [...(c.areaEffects ?? []), {
              id: rolls[c.id].effectId, kind: result.ongoing.kind,
              name: result.ongoing.kind === 'fire' ? 'On Fire' : 'Covered in Acid',
              persistent: true,
              damageDieCount: result.ongoing.damageDieCount, damageDie: result.ongoing.damageDie,
              damageBonus: result.ongoing.damageBonus, damageType: result.ongoing.damageType,
            }]
          : c.areaEffects;
        return {
          ...c,
          currentHp: Math.max(0, c.currentHp - result.damage),
          areaEffects,
          ...(result.unconsciousRounds > 0 ? {
            isKnockedOut: true, knockOutRoundsLeft: result.unconsciousRounds,
            position: 'prone' as const, currentAP: 0,
          } : {}),
        };
      });
      const initiativeEntries = s.initiativeEntries.map(e => {
        const result = e.characterId ? byId.get(e.characterId) : undefined;
        if (!result) return e;
        const updatedCharacter = characters.find(c => c.id === e.characterId);
        return {
          ...e,
          currentHp: updatedCharacter?.currentHp ?? Math.max(0, e.currentHp - result.damage),
          position: updatedCharacter?.position ?? e.position,
          ...(result.unconsciousRounds > 0 ? { currentAP: 0 } : {}),
        };
      });
      return { ...s, characters, initiativeEntries, areaAttackReceipt: { requestId, results } };
    });
    return requestId;
  }, []);

  const markAreaEffectForRemoval = useCallback((characterId: string, effectId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? {
        ...c,
        position: 'prone',
        currentAP: 0,
        areaEffects: (c.areaEffects ?? []).map(effect =>
          effect.id === effectId && effect.kind === 'fire'
            ? { ...effect, removeAfterTick: true }
            : effect),
      } : c),
      initiativeEntries: s.initiativeEntries.map(entry => entry.characterId === characterId
        ? { ...entry, position: 'prone', currentAP: 0 }
        : entry),
    }));
  }, []);

  const removeAreaEffect = useCallback((characterId: string, effectId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, areaEffects: (c.areaEffects ?? []).filter(effect => effect.id !== effectId) }
        : c),
    }));
  }, []);

  const setPosition = useCallback((characterId: string, position: PositionType) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, position: c.isKnockedOut ? 'prone' : position } : c),
      initiativeEntries: s.initiativeEntries.map(e => {
        if (e.characterId !== characterId) return e;
        const c = s.characters.find(char => char.id === characterId);
        return { ...e, position: c?.isKnockedOut ? 'prone' : position };
      }),
    }));
  }, []);

  const addTempAC = useCallback((characterId: string, ac: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, tempAC: c.tempAC + ac } : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId ? { ...e, tempAC: e.tempAC + ac } : e),
    }));
  }, []);

  const clearTempAC = useCallback((characterId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, tempAC: 0 } : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId ? { ...e, tempAC: 0 } : e),
    }));
  }, []);

  // ─── Weapon Ammo ────────────────────────────────────────────────────────────

  const spendAmmo = useCallback((characterId: string, weaponId: string, shots: number): boolean => {
    let success = false;
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) { success = false; return s; }
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon || weapon.magazineSize === 0) { success = true; return s; }
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const current = existing ? existing.currentAmmo : effectiveMagazineSize(weapon);
      if (current < shots) { success = false; return s; }
      success = true;
      const newStates: WeaponAmmoState[] = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: current - shots, conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0), ammoTypeId: existing?.ammoTypeId });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
    return success;
  }, []);

  const reloadWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon) return s;
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: effectiveMagazineSize(weapon), conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0), ammoTypeId: existing?.ammoTypeId });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Ammo type (loaded round) ─────────────────────────────────────────────────
  const setAmmoType = useCallback((characterId: string, weaponId: string, ammoTypeId: string | undefined) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({
        weaponId,
        currentAmmo: existing?.currentAmmo ?? (weapon ? effectiveMagazineSize(weapon) : 0),
        conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0),
        ammoTypeId,
      });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Weapon equip / switch (hand slots + inventory) ───────────────────────────
  const equipWeapon = useCallback((characterId: string, weaponId: string, hand: 'left' | 'right' | 'both' = 'both') => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon) return s;
      const hands = getWeaponHands(weapon);
      // Two-handed weapons always occupy both hands regardless of the request.
      const useBoth = hands === 2 || hand === 'both';
      let leftHandWeaponId = char.leftHandWeaponId;
      let rightHandWeaponId = char.rightHandWeaponId;
      if (useBoth) {
        leftHandWeaponId = weaponId;
        rightHandWeaponId = weaponId;
      } else {
        // Placing a 1-handed weapon in one hand: if the OTHER hand currently
        // holds a two-handed weapon (same id in both hands), it must be
        // stowed — clear it so the 1H weapon doesn't share hands with a 2H.
        const otherId = hand === 'left' ? rightHandWeaponId : leftHandWeaponId;
        const otherWeapon = otherId ? [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === otherId) : undefined;
        const otherIsTwoHanded = otherWeapon ? getWeaponHands(otherWeapon) === 2 : false;
        // Also never let a 1-handed weapon occupy both hand slots — if the
        // other hand already holds this same weapon id, clear it.
        if (hand === 'left') {
          leftHandWeaponId = weaponId;
          if (otherIsTwoHanded || rightHandWeaponId === weaponId) rightHandWeaponId = undefined;
        } else {
          rightHandWeaponId = weaponId;
          if (otherIsTwoHanded || leftHandWeaponId === weaponId) leftHandWeaponId = undefined;
        }
      }
      // Keep the inventory (max 5, ids incl. equipped) in sync.
      const inv = (char.inventoryWeaponIds ?? (char.equippedWeaponId ? [char.equippedWeaponId] : []));
      const inventoryWeaponIds = inv.includes(weaponId) ? inv : [...inv, weaponId].slice(0, 5);
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId
          ? { ...c, equippedWeaponId: weaponId, leftHandWeaponId, rightHandWeaponId, inventoryWeaponIds }
          : c),
      };
    });
  }, []);

  // Switch the ACTIVE weapon between weapons already held in the hands —
  // does not touch hand assignments or inventory.
  const setActiveWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => {
        if (c.id !== characterId) return c;
        const held = [c.leftHandWeaponId, c.rightHandWeaponId, c.equippedWeaponId];
        if (!held.includes(weaponId)) return c;
        return { ...c, equippedWeaponId: weaponId };
      }),
    }));
  }, []);

  // ─── Active effects (chems) ───────────────────────────────────────────────────
  const addEffect = useCallback((characterId: string, effect: ActiveEffect) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, effects: [...(c.effects ?? []), effect] }
        : c),
    }));
  }, []);

  const removeEffect = useCallback((characterId: string, effectId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, effects: (c.effects ?? []).filter(e => e.id !== effectId) }
        : c),
    }));
  }, []);

  // Apply a chem: add its ActiveEffect and immediately resolve any HP heal/damage
  // (hpMod on the effect: positive heals, negative damages).
  const applyChem = useCallback((characterId: string, effect: ActiveEffect) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => {
        if (c.id !== characterId) return c;
        const hpMod = effect.hpMod ?? 0;
        let currentHp = c.currentHp;
        currentHp = resolveHpChange(c, hpMod);
        // Immediate AP boost/drain (Jet +2 AP, crash −AP) applies right away.
        const apMod = effect.apMod ?? 0;
        const withEffect = { ...c, currentHp, effects: [...(c.effects ?? []), effect] };
        const currentAP = apMod !== 0
          ? Math.max(0, Math.min(charMaxAP(withEffect, [...BUILT_IN_ARMOR, ...s.customArmor]), c.currentAP + apMod))
          : c.currentAP;
        return { ...withEffect, currentAP };
      }),
      initiativeEntries: s.initiativeEntries.map(e => {
        if (e.characterId !== characterId) return e;
        const hpMod = effect.hpMod ?? 0;
        let currentHp = e.currentHp;
        const sourceCharacter = s.characters.find(c => c.id === characterId);
        if (sourceCharacter) {
          currentHp = Math.min(e.maxHp, resolveHpChange({ ...sourceCharacter, currentHp: e.currentHp, maxHp: e.maxHp }, hpMod));
        }
        // Keep entry AP in sync with the character (Jet +AP, crash −AP).
        const apMod = effect.apMod ?? 0;
        const maxAP = sourceCharacter
          ? charMaxAP({ ...sourceCharacter, effects: [...(sourceCharacter.effects ?? []), effect] }, [...BUILT_IN_ARMOR, ...s.customArmor])
          : Math.max(1, e.maxAP + apMod);
        const currentAP = apMod !== 0
          ? Math.max(0, Math.min(maxAP, e.currentAP + apMod))
          : e.currentAP;
        return { ...e, currentHp, maxAP, currentAP };
      }),
    }));
  }, []);

  // A jam/miss FILLS one condition box (0 pristine … 10 jammed).
  const jamWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: existing?.currentAmmo ?? 0, conditionBoxes: clampConditionBoxes((existing?.conditionBoxes ?? 0) + 1), ammoTypeId: existing?.ammoTypeId });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // Directly set FILLED condition boxes (0 pristine … CONDITION_BOXES_MAX jammed).
  const setWeaponCondition = useCallback((characterId: string, weaponId: string, filledBoxes: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({
        weaponId,
        currentAmmo: existing?.currentAmmo ?? (weapon ? effectiveMagazineSize(weapon) : 0),
        conditionBoxes: clampConditionBoxes(filledBoxes),
        ammoTypeId: existing?.ammoTypeId,
      });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Injuries ────────────────────────────────────────────────────────────────

  const addInjury = useCallback((characterId: string, injury: Injury) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: [...(c.injuries ?? []), injury] }
        : c),
    }));
  }, []);

  const removeInjury = useCallback((characterId: string, injuryId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: (c.injuries ?? []).filter(i => i.id !== injuryId) }
        : c),
    }));
  }, []);

  const toggleInjury = useCallback((characterId: string, injuryId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: (c.injuries ?? []).map(i => i.id === injuryId ? { ...i, isActive: !i.isActive } : i) }
        : c),
    }));
  }, []);

  // ─── Initiative / Rounds ─────────────────────────────────────────────────────

  const startCombat = useCallback((entries: InitiativeEntry[]) => {
    const sorted = sortInitiativeEntries(entries);
    setState(s => ({
      ...s,
      initiativeEntries: sorted.map((e, i) => ({ ...e, isActive: i === 0, hasActed: false })),
      currentRound: 1,
      combatActive: true,
      activeEntryId: sorted[0]?.id ?? null,
    }));
  }, []);

  const endCombat = useCallback(() => {
    setState(s => ({
      ...s,
      // Reset every character to full AP (derived max) and clear temp AC.
      characters: s.characters.map(c => {
        const maxAP = charMaxAP(c, [...BUILT_IN_ARMOR, ...s.customArmor]);
        return { ...clearUnconsciousness(c), currentAP: maxAP, tempAC: 0 };
      }),
      initiativeEntries: [],
      currentRound: 1,
      combatActive: false,
      activeEntryId: null,
    }));
  }, []);

  const addInitiativeEntry = useCallback((entry: InitiativeEntry) => {
    setState(s => {
      const entries = sortInitiativeEntries([...s.initiativeEntries, entry]);
      return { ...s, initiativeEntries: entries };
    });
  }, []);

  const removeInitiativeEntry = useCallback((id: string) => {
    setState(s => ({
      ...s,
      initiativeEntries: s.initiativeEntries.filter(e => e.id !== id),
      activeEntryId: s.activeEntryId === id
        ? (s.initiativeEntries.find(e => e.id !== id)?.id ?? null)
        : s.activeEntryId,
    }));
  }, []);

  const updateInitiativeEntry = useCallback((entry: InitiativeEntry) => {
    setState(s => ({
      ...s,
      initiativeEntries: s.initiativeEntries.map(e => e.id === entry.id ? entry : e),
    }));
  }, []);

  const setActiveEntry = useCallback((id: string) => {
    setState(s => ({ ...s, activeEntryId: id }));
  }, []);

  const nextTurn = useCallback(() => {
    setState(s => {
      if (s.initiativeEntries.length === 0) return s;
      const activeIdx = s.initiativeEntries.findIndex(e => e.id === s.activeEntryId);
      const currentActive = s.initiativeEntries[activeIdx];
      // Convert unspent AP to tempAC for the current entry
      let entries = s.initiativeEntries.map(e => {
        if (e.id === currentActive?.id) {
          return { ...e, hasActed: true, tempAC: e.tempAC + e.currentAP, currentAP: 0 };
        }
        return e;
      });
      // End of the current combatant's turn: convert AP → tempAC and, if
      // knocked out, consume one KO turn NOW (their skipped turn is over).
      let chars = s.characters.map(c => {
        if (c.id === currentActive?.characterId) {
          return statusTick({ ...c, tempAC: c.tempAC + c.currentAP, currentAP: 0 }, [...BUILT_IN_ARMOR, ...s.customArmor]).character;
        }
        return c;
      });
      entries = entries.map(e => {
        const c = chars.find(char => char.id === e.characterId);
        return c ? { ...e, currentHp: c.currentHp, position: c.position } : e;
      });
      // If all entries have acted, advance to next round.
      // NOTE: AP/tempAC are NOT reset for everyone — each combatant keeps their
      // tempAC (from unspent AP) until their own turn comes around again.
      if (entries.every(e => e.hasActed)) {
        const round = s.currentRound + 1;
        const firstChar0 = entries[0]?.characterId;
        // Turn start: KO'd combatants get no AP (they can't act this turn).
        const firstKO = !!chars.find(c => c.id === firstChar0)?.isKnockedOut;
        entries = entries.map((e, i) => ({
          ...e, hasActed: false, isActive: i === 0,
          // Only the new active combatant replenishes AP and loses tempAC
          ...(i === 0 ? { currentAP: firstKO ? 0 : e.maxAP, tempAC: 0 } : {}),
        }));
        if (firstChar0) {
          chars = chars.map(c => c.id === firstChar0 ? { ...c, currentAP: c.isKnockedOut ? 0 : charMaxAP(c, [...BUILT_IN_ARMOR, ...s.customArmor]), tempAC: 0 } : c);
        }
        return { ...s, initiativeEntries: entries, characters: chars, currentRound: round, activeEntryId: entries[0].id };
      }
      // Find next unacted entry
      let nextIdx = (activeIdx + 1) % entries.length;
      let loops = 0;
      while (entries[nextIdx]?.hasActed && loops < entries.length) {
        nextIdx = (nextIdx + 1) % entries.length;
        loops++;
      }
      // Turn start: KO'd combatants get no AP (they can't act this turn) —
      // mirrored on both the initiative entry and the character.
      const nextKO = !!chars.find(c => c.id === entries[nextIdx]?.characterId)?.isKnockedOut;
      entries = entries.map((e, i) => ({
        ...e,
        isActive: i === nextIdx,
        ...(i === nextIdx ? { tempAC: 0, currentAP: nextKO ? 0 : e.maxAP } : {}),
      }));
      const nextActive = entries[nextIdx];
      if (nextActive?.characterId) {
        chars = chars.map(c => c.id === nextActive.characterId ? { ...c, currentAP: c.isKnockedOut ? 0 : charMaxAP(c, [...BUILT_IN_ARMOR, ...s.customArmor]), tempAC: 0 } : c);
      }
      return { ...s, initiativeEntries: entries, characters: chars, activeEntryId: nextActive?.id ?? null };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState(s => {
      if (s.initiativeEntries.length === 0) return s;
      const firstChar = s.initiativeEntries[0]?.characterId;
      // Skipping ahead completes every unacted turn so timed status counters
      // cannot be bypassed by ending the round early.
      const skippedCharacterIds = new Set(
        s.initiativeEntries.filter(entry => !entry.hasActed).map(entry => entry.characterId),
      );
      const chars = s.characters.map(c => {
        let out = skippedCharacterIds.has(c.id)
          ? statusTick(c, [...BUILT_IN_ARMOR, ...s.customArmor]).character
          : c;
        if (out.id === firstChar) {
          out = { ...out, currentAP: out.isKnockedOut ? 0 : charMaxAP(out, [...BUILT_IN_ARMOR, ...s.customArmor]), tempAC: 0 };
        }
        return out;
      });
      // Only the new active (first) combatant replenishes AP / clears tempAC —
      // everyone else keeps their tempAC until their own turn starts. A still-
      // KO'd first combatant gets no AP (mirrored on entry and character).
      const firstKO = !!chars.find(c => c.id === firstChar)?.isKnockedOut;
      const entries = s.initiativeEntries.map((e, i) => ({
        ...e, hasActed: false, isActive: i === 0,
        ...(i === 0 ? { currentAP: firstKO ? 0 : e.maxAP, tempAC: 0 } : {}),
      })).map(e => {
        const c = chars.find(char => char.id === e.characterId);
        return c ? { ...e, currentHp: c.currentHp, position: c.position } : e;
      });
      return { ...s, initiativeEntries: entries, characters: chars, currentRound: s.currentRound + 1, activeEntryId: entries[0]?.id ?? null };
    });
  }, []);

  // Move an initiative entry up/down in the turn order
  const moveInitiativeEntry = useCallback((id: string, direction: 'up' | 'down') => {
    setState(s => {
      const idx = s.initiativeEntries.findIndex(e => e.id === id);
      if (idx < 0) return s;
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= s.initiativeEntries.length) return s;
      const entries = [...s.initiativeEntries];
      [entries[idx], entries[swap]] = [entries[swap], entries[idx]];
      return { ...s, initiativeEntries: entries };
    });
  }, []);

  // ─── Custom Equipment ────────────────────────────────────────────────────────

  const addCustomWeapon = useCallback((w: Weapon) => {
    setState(s => ({ ...s, customWeapons: [...s.customWeapons, w] }));
  }, []);
  const updateCustomWeapon = useCallback((w: Weapon) => {
    setState(s => ({ ...s, customWeapons: s.customWeapons.map(x => x.id === w.id ? w : x) }));
  }, []);
  const deleteCustomWeapon = useCallback((id: string) => {
    setState(s => ({ ...s, customWeapons: s.customWeapons.filter(w => w.id !== id) }));
  }, []);
  const addCustomArmor = useCallback((a: Armor) => {
    setState(s => ({
      ...s,
      customArmor: [...s.customArmor, a.effects ? a : { ...a, effects: { special: {}, skills: {} } }],
    }));
  }, []);
  const updateCustomArmor = useCallback((a: Armor) => {
    setState(s => {
      const normalizedArmor = a.effects ? a : { ...a, effects: { special: {}, skills: {} } };
      const customArmor = s.customArmor.map(x => x.id === a.id ? normalizedArmor : x);
      const allArmor = [...BUILT_IN_ARMOR, ...customArmor];
      const characters = s.characters.map(character => {
        const maxAP = charMaxAP(character, allArmor);
        return { ...character, currentAP: Math.min(character.currentAP, maxAP) };
      });
      return {
        ...s,
        customArmor,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          if (!character) return entry;
          return syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(character, allArmor));
        })),
      };
    });
  }, []);
  const deleteCustomArmor = useCallback((id: string) => {
    setState(s => {
      const customArmor = s.customArmor.filter(a => a.id !== id);
      const allArmor = [...BUILT_IN_ARMOR, ...customArmor];
      const characters = s.characters.map(character => {
        const maxAP = charMaxAP(character, allArmor);
        return { ...character, currentAP: Math.min(character.currentAP, maxAP) };
      });
      return {
        ...s,
        customArmor,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          if (!character) return entry;
          return syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(character, allArmor));
        })),
      };
    });
  }, []);

  // ─── Custom Bestiary ─────────────────────────────────────────────────────────

  const addCustomBestiaryTemplate = useCallback((t: BestiaryTemplate) => {
    setState(s => ({
      ...s,
      customBestiaryTemplates: [...s.customBestiaryTemplates, {
        ...t,
        isCustom: true,
        poisonResistance: t.poisonResistance ?? 0,
      }],
    }));
  }, []);
  const removeCustomBestiaryTemplate = useCallback((id: string) => {
    setState(s => ({ ...s, customBestiaryTemplates: s.customBestiaryTemplates.filter(t => t.id !== id) }));
  }, []);

  // ─── Campaign ────────────────────────────────────────────────────────────────

  const exportCampaign = useCallback((): string => JSON.stringify(state, null, 2), [state]);
  const importCampaign = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as AppState;
      if (!Array.isArray(parsed.characters)) return false;
       setState({ ...defaultState, ...reconcileInitiativeCharacters(normalizePersistedState(parsed)) });
      return true;
    } catch (_) { return false; }
  }, []);

  const allWeapons = [...BUILT_IN_WEAPONS, ...state.customWeapons];
  const allArmor = [...BUILT_IN_ARMOR, ...state.customArmor];

  return (
    <AppContext.Provider value={{
      ...state,
      allWeapons, allArmor,
      addCharacter, updateCharacter, deleteCharacter, cloneCharacter,
      applyDamage, healCharacter, spendAP, restoreAP, setPosition, setKnockedOut, applyAreaAttack, markAreaEffectForRemoval, removeAreaEffect, addTempAC, clearTempAC,
      spendAmmo, reloadWeapon, jamWeapon, setWeaponCondition, setAmmoType, equipWeapon, setActiveWeapon,
      addEffect, removeEffect, applyChem,
      addInjury, removeInjury, toggleInjury,
      startCombat, endCombat, addInitiativeEntry, removeInitiativeEntry,
      updateInitiativeEntry, moveInitiativeEntry, nextTurn, nextRound, setActiveEntry,
      addCustomWeapon, updateCustomWeapon, deleteCustomWeapon, addCustomArmor, updateCustomArmor, deleteCustomArmor,
      addCustomBestiaryTemplate, removeCustomBestiaryTemplate,
      exportCampaign, importCampaign,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
