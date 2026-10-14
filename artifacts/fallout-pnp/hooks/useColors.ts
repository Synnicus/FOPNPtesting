import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';

/** Returns semantic colors for the selected campaign theme and device appearance. */
export function useColors() {
  const scheme = useColorScheme();
  const { visualTheme } = useApp();
  const theme = visualTheme === 'eastern' ? colors.eastern : colors;
  const palette = scheme === 'dark' ? theme.dark : theme.light;
  return { ...palette, radius: colors.radius };
}
