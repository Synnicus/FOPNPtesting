import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, Weapon, Armor } from '@/context/types';
import { BUILT_IN_WEAPONS } from '@/data/weapons';
import { BUILT_IN_ARMOR } from '@/data/armor';

const STORAGE_KEY = '@fallout_pnp_v1';

interface AppState {
  characters: Character[];
  customWeapons: Weapon[];
  customArmor: Armor[];
}

interface AppContextValue extends AppState {
  allWeapons: Weapon[];
  allArmor: Armor[];
  // Characters
  addCharacter: (char: Character) => void;
  updateCharacter: (char: Character) => void;
  deleteCharacter: (id: string) => void;
  cloneCharacter: (id: string) => void;
  applyDamage: (characterId: string, damage: number) => void;
  // Custom equipment
  addCustomWeapon: (w: Weapon) => void;
  deleteCustomWeapon: (id: string) => void;
  addCustomArmor: (a: Armor) => void;
  deleteCustomArmor: (id: string) => void;
  // Campaign
  exportCampaign: () => string;
  importCampaign: (json: string) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const defaultState: AppState = {
  characters: [],
  customWeapons: [],
  customArmor: [],
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AppState;
          setState(parsed);
        } catch (_) {}
      }
      setLoaded(true);
    });
  }, []);

  // Persist whenever state changes (after initial load)
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const addCharacter = useCallback((char: Character) => {
    setState(s => ({ ...s, characters: [...s.characters, char] }));
  }, []);

  const updateCharacter = useCallback((char: Character) => {
    setState(s => ({ ...s, characters: s.characters.map(c => c.id === char.id ? char : c) }));
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    setState(s => ({ ...s, characters: s.characters.filter(c => c.id !== id) }));
  }, []);

  const cloneCharacter = useCallback((id: string) => {
    setState(s => {
      const src = s.characters.find(c => c.id === id);
      if (!src) return s;
      const clone: Character = {
        ...src,
        id: genId(),
        name: `${src.name} (Clone)`,
      };
      return { ...s, characters: [...s.characters, clone] };
    });
  }, []);

  const applyDamage = useCallback((characterId: string, damage: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c =>
        c.id === characterId
          ? { ...c, currentHp: Math.max(0, c.currentHp - damage) }
          : c,
      ),
    }));
  }, []);

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

  const exportCampaign = useCallback((): string => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importCampaign = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as AppState;
      if (!Array.isArray(parsed.characters)) return false;
      setState(parsed);
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  const allWeapons = [...BUILT_IN_WEAPONS, ...state.customWeapons];
  const allArmor = [...BUILT_IN_ARMOR, ...state.customArmor];

  return (
    <AppContext.Provider
      value={{
        ...state,
        allWeapons,
        allArmor,
        addCharacter,
        updateCharacter,
        deleteCharacter,
        cloneCharacter,
        applyDamage,
        addCustomWeapon,
        deleteCustomWeapon,
        addCustomArmor,
        deleteCustomArmor,
        exportCampaign,
        importCampaign,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
