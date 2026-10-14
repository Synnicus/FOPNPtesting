/**
 * Fallout PnP – Pip-Boy amber-on-dark palette.
 * Dark mode is the primary theme; light mode uses a sepia/parchment fallback.
 */

const colors = {
  light: {
    text: '#1a1208',
    tint: '#a07010',
    background: '#f0ead8',
    foreground: '#1a1208',
    card: '#e8e0c8',
    cardForeground: '#1a1208',
    primary: '#a07010',
    primaryForeground: '#f0ead8',
    secondary: '#d8cfb8',
    secondaryForeground: '#1a1208',
    muted: '#e0d8c0',
    mutedForeground: '#6a5a3a',
    accent: '#a07010',
    accentForeground: '#f0ead8',
    destructive: '#b83a28',
    destructiveForeground: '#f0ead8',
    border: '#c8b888',
    input: '#d8cfb8',
  },

  dark: {
    text: '#f0e8d8',
    tint: '#c8941a',
    background: '#0a0908',
    foreground: '#f0e8d8',
    card: '#141210',
    cardForeground: '#f0e8d8',
    primary: '#c8941a',
    primaryForeground: '#0a0908',
    secondary: '#1e1c14',
    secondaryForeground: '#c8941a',
    muted: '#141210',
    mutedForeground: '#7a6a4a',
    accent: '#c8941a',
    accentForeground: '#0a0908',
    destructive: '#c03a28',
    destructiveForeground: '#f0e8d8',
    border: '#2e2818',
    input: '#1a1810',
  },

  eastern: {
    light: {
      text: '#172014',
      tint: '#397a44',
      background: '#ecf0e7',
      foreground: '#172014',
      card: '#e1e9dd',
      cardForeground: '#172014',
      primary: '#397a44',
      primaryForeground: '#f3f7e9',
      secondary: '#d5e2d2',
      secondaryForeground: '#162417',
      muted: '#dfe7d8',
      mutedForeground: '#56644e',
      accent: '#4c8c50',
      accentForeground: '#f3f7e9',
      destructive: '#b83a28',
      destructiveForeground: '#f0ead8',
      border: '#b5c8ad',
      input: '#d5e2d2',
    },
    dark: {
      text: '#d8e8c2',
      tint: '#a8d475',
      background: '#07100a',
      foreground: '#d8e8c2',
      card: '#0e1b11',
      cardForeground: '#d8e8c2',
      primary: '#a8d475',
      primaryForeground: '#07100a',
      secondary: '#15261a',
      secondaryForeground: '#a8d475',
      muted: '#101d13',
      mutedForeground: '#91a383',
      accent: '#7cae58',
      accentForeground: '#07100a',
      destructive: '#d05f45',
      destructiveForeground: '#f0e8d8',
      border: '#27412b',
      input: '#112117',
    },
  },

  radius: 6,
};

export const THEME_SWATCHES = {
  western: '#c8941a',
  eastern: '#a8d475',
} as const;

export default colors;
