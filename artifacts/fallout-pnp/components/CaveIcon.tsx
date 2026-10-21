import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Rocky cave silhouette with an arched entrance, readable at marker size. */
export default function CaveIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 21 4 12 8 5 12 3 17 6 21 13 22 21H16V15C16 9 8 9 8 15V21Z"
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fillRule="evenodd"
      />
    </Svg>
  );
}
