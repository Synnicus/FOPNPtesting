import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, CharacterPerk, InitiativeEntry, Injury, PositionType, SPECIALStats, Weapon, Armor, WeaponAmmoState, BestiaryTemplate } from '@/context/types';
import { BUILT_IN_WEAPONS, CONDITION_MAX } from '@/data/weapons';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { calcBaseAC, calcBaseSkills, calcMaxAP, calcMaxHP, calcSequence } from '@/data/derived';

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

  addInjury: (characterId: string, injury: Injury) => void;
  removeInjury: (characterId: string, injuryId: string) => void;
  toggleInjury: (characterId: string, injuryId: string) => void;

  startCombat: (entries: InitiativeEntry[]) => void;
  endCombat: () => void;
  addInitiativeEntry: (entry: InitiativeEntry) => void;
  removeInitiativeEntry: (id: string) => void;
  updateInitiativeEntry: (entry: InitiativeEntry) => void;
  nextTurn: () => void;
  nextRound: () => void;
  setActiveEntry: (id: string) => void;

  addCustomWeapon: (w: Weapon) => void;
  deleteCustomWeapon: (id: string) => void;
  addCustomArmor: (a: Armor) => void;
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
          const parsed = JSON.parse(raw) as AppState;
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
      const current = existing ? existing.currentAmmo : weapon.magazineSize;
      if (current < shots) { success = false; return s; }
      success = true;
      const newStates: WeaponAmmoState[] = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: current - shots, conditionBoxes: existing?.conditionBoxes ?? CONDITION_MAX });
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
      newStates.push({ weaponId, currentAmmo: weapon.magazineSize, conditionBoxes: existing?.conditionBoxes ?? CONDITION_MAX });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  const jamWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({ weaponId, currentAmmo: existing?.currentAmmo ?? 0, conditionBoxes: Math.max(0, (existing?.conditionBoxes ?? CONDITION_MAX) - 1) });
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
    setState(s => ({ ...s, initiativeEntries: [], currentRound: 1, combatActive: false, activeEntryId: null }));
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
      // If all entries have acted, advance to next round
      if (entries.every(e => e.hasActed)) {
        const round = s.currentRound + 1;
        entries = entries.map(e => ({ ...e, hasActed: false, currentAP: e.maxAP, tempAC: 0, isActive: false }));
        chars = chars.map(c => ({ ...c, currentAP: c.maxAP, tempAC: 0 }));
        entries[0] = { ...entries[0], isActive: true };
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
      const entries = s.initiativeEntries.map((e, i) => ({
        ...e, hasActed: false, currentAP: e.maxAP, tempAC: 0, isActive: i === 0,
      }));
      const chars = s.characters.map(c => ({ ...c, currentAP: c.maxAP, tempAC: 0 }));
      return { ...s, initiativeEntries: entries, characters: chars, currentRound: s.currentRound + 1, activeEntryId: entries[0]?.id ?? null };
    });
  }, []);

  // ─── Custom Equipment ────────────────────────────────────────────────────────

  const addCustomWeapon = useCallback((w: Weapon) => {
    setState(s => ({ ...s, customWeapons: [...s.customWeapons, w] }));
  }, []);
  const deleteCustomWeapon = useCallback((id: string) => {
    setState(s => ({ ...s, customWeapons: s.customWeapons.filter(w => w.id !== id) }));
  }, []);
  const addCustomArmor = useCallback((a: Armor) => {
    setState(s => ({ ...s, customArmor: [...s.customArmor, a] }));
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
      setState({ ...defaultState, ...parsed });
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
      spendAmmo, reloadWeapon, jamWeapon,
      addInjury, removeInjury, toggleInjury,
      startCombat, endCombat, addInitiativeEntry, removeInitiativeEntry,
      updateInitiativeEntry, nextTurn, nextRound, setActiveEntry,
      addCustomWeapon, deleteCustomWeapon, addCustomArmor, deleteCustomArmor,
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
