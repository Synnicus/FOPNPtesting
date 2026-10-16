import React, { createContext, useCallback, useContext, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { usePathname } from 'expo-router';
import { useApp } from '@/context/AppContext';

const SystemSoundsContext = createContext({ playUiClick: () => {} });
const UI_CLICK_DEBOUNCE_MS = 70;

export function SystemSoundsProvider({ children }: { children: React.ReactNode }) {
  const { systemSoundsEnabled } = useApp();
  const pathname = usePathname();
  const clickPlayer = useAudioPlayer(require('../assets/ui-button-click.mp3'));
  const lastPlayedAt = useRef(0);

  const playUiClick = useCallback(() => {
    if (!systemSoundsEnabled || pathname === '/' || pathname === '/main-menu') return;

    const now = Date.now();
    if (now - lastPlayedAt.current < UI_CLICK_DEBOUNCE_MS) return;
    lastPlayedAt.current = now;

    clickPlayer.volume = 0.35;
    void clickPlayer.seekTo(0)
      .then(() => {
        if (systemSoundsEnabled && pathname !== '/' && pathname !== '/main-menu') {
          clickPlayer.play();
        }
      })
      .catch(() => {});
  }, [clickPlayer, pathname, systemSoundsEnabled]);

  return (
    <SystemSoundsContext.Provider value={{ playUiClick }}>
      {children}
    </SystemSoundsContext.Provider>
  );
}

export function useSystemUiSounds() {
  return useContext(SystemSoundsContext);
}
