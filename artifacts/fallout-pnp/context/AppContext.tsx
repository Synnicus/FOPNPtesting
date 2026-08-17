import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, CharacterPerk, InitiativeEntry, Injury, PositionType, SPECIALStats, Weapon, Armor, WeaponAmmoState, ActiveEffect, BestiaryTemplate } from '@/context/types';
import { BUILT_IN_WEAPONS, getWeaponHands } from '@/data/weapons';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { calcBaseAC, calcBaseSkills, calcMaxAP, calcMaxHP, calcSequence } from '@/data/derived';
import { clampConditionBoxes, CONDITION_BOXES_MAX } from '@/data/condition';
import { computeModEffects } from '@/data/mods';

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
  addTempAC: (characterId: string, ac: number) => void;
  clearTempAC: (characterId: string) => void;

  spendAmmo: (characterId: string, weaponId: string, shots: number) => boolean;
  reloadWeapon: (characterId: string, weaponId: string) => void;
  jamWeapon: (characterId: string, weaponId: string) => void;
  setWeaponCondition: (characterId: string, weaponId: string, filledBoxes: number) => void;
  setAmmoType: (characterId: string, weaponId: string, ammoTypeId: string | undefined) => void;
  equipWeapon: (characterId: string, weaponId: string, hand?: 'left' | 'right' | 'both') => void;

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = migrateConditionSemantics(JSON.parse(raw) as AppState);
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
    setState(s => ({ ...s, characters: s.characters.map(c => c.id === char.id ? char : c) }));
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
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, currentHp: Math.min(c.maxHp, c.currentHp + amount) }
        : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
        ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + amount) }
        : e),
    }));
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
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, currentAP: amount !== undefined ? Math.min(c.maxAP, c.currentAP + amount) : c.maxAP }
        : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
        ? { ...e, currentAP: amount !== undefined ? Math.min(e.maxAP, e.currentAP + amount) : e.maxAP }
        : e),
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
      } else if (hand === 'left') {
        leftHandWeaponId = weaponId;
      } else {
        rightHandWeaponId = weaponId;
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
        if (hpMod > 0) currentHp = Math.min(c.maxHp, c.currentHp + hpMod);
        else if (hpMod < 0) currentHp = Math.max(0, c.currentHp + hpMod);
        return { ...c, currentHp, effects: [...(c.effects ?? []), effect] };
      }),
      initiativeEntries: s.initiativeEntries.map(e => {
        if (e.characterId !== characterId) return e;
        const hpMod = effect.hpMod ?? 0;
        let currentHp = e.currentHp;
        if (hpMod > 0) currentHp = Math.min(e.maxHp, e.currentHp + hpMod);
        else if (hpMod < 0) currentHp = Math.max(0, e.currentHp + hpMod);
        return { ...e, currentHp };
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
    const sorted = [...entries].sort((a, b) =>
      b.initiative !== a.initiative ? b.initiative - a.initiative : b.sequence - a.sequence
    );
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
        const maxAP = c.maxAP ?? calcMaxAP(c.special);
        return { ...c, currentAP: maxAP, tempAC: 0 };
      }),
      initiativeEntries: [],
      currentRound: 1,
      combatActive: false,
      activeEntryId: null,
    }));
  }, []);

  const addInitiativeEntry = useCallback((entry: InitiativeEntry) => {
    setState(s => {
      const entries = [...s.initiativeEntries, entry].sort((a, b) =>
        b.initiative !== a.initiative ? b.initiative - a.initiative : b.sequence - a.sequence
      );
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
      let chars = s.characters.map(c => {
        if (c.id === currentActive?.characterId) {
          return { ...c, tempAC: c.tempAC + c.currentAP, currentAP: 0 };
        }
        return c;
      });
      // If all entries have acted, advance to next round.
      // NOTE: AP/tempAC are NOT reset for everyone — each combatant keeps their
      // tempAC (from unspent AP) until their own turn comes around again.
      if (entries.every(e => e.hasActed)) {
        const round = s.currentRound + 1;
        entries = entries.map((e, i) => ({
          ...e, hasActed: false, isActive: i === 0,
          // Only the new active combatant replenishes AP and loses tempAC
          ...(i === 0 ? { currentAP: e.maxAP, tempAC: 0 } : {}),
        }));
        const firstChar = entries[0]?.characterId;
        if (firstChar) {
          chars = chars.map(c => c.id === firstChar ? { ...c, currentAP: c.maxAP, tempAC: 0 } : c);
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
      entries = entries.map((e, i) => ({
        ...e,
        isActive: i === nextIdx,
        ...(i === nextIdx ? { tempAC: 0, currentAP: e.maxAP } : {}),
      }));
      const nextActive = entries[nextIdx];
      if (nextActive?.characterId) {
        chars = chars.map(c => c.id === nextActive.characterId ? { ...c, currentAP: c.maxAP, tempAC: 0 } : c);
      }
      return { ...s, initiativeEntries: entries, characters: chars, activeEntryId: nextActive?.id ?? null };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState(s => {
      if (s.initiativeEntries.length === 0) return s;
      // Only the new active (first) combatant replenishes AP / clears tempAC —
      // everyone else keeps their tempAC until their own turn starts.
      const entries = s.initiativeEntries.map((e, i) => ({
        ...e, hasActed: false, isActive: i === 0,
        ...(i === 0 ? { currentAP: e.maxAP, tempAC: 0 } : {}),
      }));
      const firstChar = entries[0]?.characterId;
      const chars = firstChar
        ? s.characters.map(c => c.id === firstChar ? { ...c, currentAP: c.maxAP, tempAC: 0 } : c)
        : s.characters;
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
    setState(s => ({ ...s, customArmor: [...s.customArmor, a] }));
  }, []);
  const updateCustomArmor = useCallback((a: Armor) => {
    setState(s => ({ ...s, customArmor: s.customArmor.map(x => x.id === a.id ? a : x) }));
  }, []);
  const deleteCustomArmor = useCallback((id: string) => {
    setState(s => ({ ...s, customArmor: s.customArmor.filter(a => a.id !== id) }));
  }, []);

  // ─── Custom Bestiary ─────────────────────────────────────────────────────────

  const addCustomBestiaryTemplate = useCallback((t: BestiaryTemplate) => {
    setState(s => ({ ...s, customBestiaryTemplates: [...s.customBestiaryTemplates, { ...t, isCustom: true }] }));
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
      setState({ ...defaultState, ...migrateConditionSemantics(parsed) });
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
      applyDamage, healCharacter, spendAP, restoreAP, setPosition, addTempAC, clearTempAC,
      spendAmmo, reloadWeapon, jamWeapon, setWeaponCondition, setAmmoType, equipWeapon,
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
