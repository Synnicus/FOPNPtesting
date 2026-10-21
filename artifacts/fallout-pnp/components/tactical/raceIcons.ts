export const RACE_ICON_PATH: Record<string, string> = {
  human: 'M12 4a3 3 0 1 0 0 6a3 3 0 0 0 0-6M5 20c0-4 3-6 7-6s7 2 7 6',
  ghoul: 'M6 11a6 6 0 0 1 12 0v4l-2 3h-8l-2-3zM9 11h2M13 11h2M10 16h4',
  superMutant: 'M8 3h8l2 6-2 4h-8l-2-4zM3 21c0-5 4-7 9-7s9 2 9 7M9 8h2M13 8h2',
  halfMutant: 'M12 4a3 3 0 1 0 0 6a3 3 0 0 0 0-6M4 21c0-5 3-7 8-7s8 2 8 7M17 5l3 3M20 5l-3 3',
  robot: 'M6 8h12v9H6zM12 8V4M10 4h4M9 12h1M14 12h1M9 15h6',
  deathclaw: 'M12 21V13M12 13L6 5M12 13l6-8M12 13V3M8 21h8',
  dog: 'M5 8l3 2h8l3-2v5a7 7 0 0 1-14 0zM10 15h4M9 12h1M14 12h1',
  molerat: 'M4 15c0-4 4-7 9-7s7 3 7 6v3H4zM4 15l-2-1M8 11h1M18 12l2-2',
  yaoguai: 'M12 20a6 6 0 0 1-6-6V9L3 4l6 3h6l6-3-3 5v5a6 6 0 0 1-6 6zM9 13h1M15 13h1',
  radscorpion: 'M4 17c4 3 12 3 14-2s-2-8-6-8M12 7L9 4M12 7l3-3M7 14l-4 1M7 17l-3 3',
  centaur: 'M3 14h12l3-6M18 8l3 1M5 14v6M9 14v6M13 14v6M3 14l-1-3',
  floater: 'M6 12a5 5 0 0 1 12 0c0 2-12 2-12 0zM8 15v5M12 15v6M16 15v4',
  brahmin: 'M3 6c1 3 3 4 5 4h8c2 0 4-1 5-4M8 10v7a4 4 0 0 0 8 0v-7M10 15h1M13 15h1',
  customRace: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
};

export function raceIconPath(race?: string | null): string {
  return RACE_ICON_PATH[race ?? 'human'] ?? RACE_ICON_PATH.customRace;
}
