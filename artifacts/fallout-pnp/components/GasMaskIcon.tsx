import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export default function GasMaskIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" accessibilityElementsHidden>
      <Path
        d="M5 6.5C7.2 4.4 10.1 3.5 14 3.5s6.8.9 9 3v7.2c0 5.2-3.8 9.8-9 11.3-5.2-1.5-9-6.1-9-11.3V6.5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path d="M5 9 2.8 7.5M23 9l2.2-1.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="9.4" cy="10.3" r="2.35" stroke={color} strokeWidth="1.7" />
      <Circle cx="18.6" cy="10.3" r="2.35" stroke={color} strokeWidth="1.7" />
      <Rect x="11" y="13.7" width="6" height="6.2" rx="1.7" stroke={color} strokeWidth="1.7" />
      <Path d="M12.5 16h3M12.5 17.8h3" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
    </Svg>
  );
}
