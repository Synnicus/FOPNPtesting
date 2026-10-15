import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getActiveLocale,
  isAppLocale,
  setActiveLocale,
  type AppLocale,
} from '@/data/localization';

const LOCALE_STORAGE_KEY = '@fallout_pnp_locale_v1';

interface LocalizationValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

const LocalizationContext = createContext<LocalizationValue | null>(null);

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(getActiveLocale);
  const explicitlyChosen = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY).then(saved => {
      if (explicitlyChosen.current || !isAppLocale(saved)) return;
      setActiveLocale(saved);
      setLocaleState(saved);
    }).catch(() => {});
  }, []);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    explicitlyChosen.current = true;
    setActiveLocale(nextLocale);
    setLocaleState(nextLocale);
    AsyncStorage.setItem(LOCALE_STORAGE_KEY, nextLocale).catch(() => {});
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): LocalizationValue {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('useLocalization must be used within LocalizationProvider');
  return value;
}
