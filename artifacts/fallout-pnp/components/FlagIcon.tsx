import React from 'react';
import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import type { AppLocale } from '@/data/localization';

const US_STRIPES = Array.from({ length: 13 }, (_, index) => (
  <Rect
    key={`stripe-${index}`}
    x={0}
    y={(index * 20) / 13}
    width={30}
    height={20 / 13 + 0.02}
    fill={index % 2 === 0 ? '#B22234' : '#FFFFFF'}
  />
));

const US_STARS = Array.from({ length: 24 }, (_, index) => {
  const row = Math.floor(index / 4);
  const column = index % 4;
  return (
    <Circle
      key={`star-${index}`}
      cx={1.5 + column * 2.5 + (row % 2 ? 1 : 0)}
      cy={1.1 + row * 1.65}
      r={0.32}
      fill="#FFFFFF"
    />
  );
});

function Star({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI * index) / 5 - Math.PI / 2;
    const radius = index % 2 === 0 ? size : size * 0.43;
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
  }).join(' ');
  return <Polygon points={points} fill={color} />;
}

export function FlagIcon({
  locale,
  size = 24,
  outline = '#766344',
}: {
  locale: AppLocale;
  size?: number;
  outline?: string;
}) {
  let artwork: React.ReactNode;

  switch (locale) {
    case 'en':
      artwork = (
        <>
          {US_STRIPES}
          <Rect x={0} y={0} width={12.6} height={10.8} fill="#3C3B6E" />
          {US_STARS}
        </>
      );
      break;
    case 'fr':
      artwork = (
        <>
          <Rect width={10} height={20} fill="#0055A4" />
          <Rect x={10} width={10} height={20} fill="#FFFFFF" />
          <Rect x={20} width={10} height={20} fill="#EF4135" />
        </>
      );
      break;
    case 'it':
      artwork = (
        <>
          <Rect width={10} height={20} fill="#009246" />
          <Rect x={10} width={10} height={20} fill="#FFFFFF" />
          <Rect x={20} width={10} height={20} fill="#CE2B37" />
        </>
      );
      break;
    case 'de':
      artwork = (
        <>
          <Rect width={30} height={6.67} fill="#000000" />
          <Rect y={6.67} width={30} height={6.67} fill="#DD0000" />
          <Rect y={13.34} width={30} height={6.66} fill="#FFCE00" />
        </>
      );
      break;
    case 'es-ES':
      artwork = (
        <>
          <Rect width={30} height={5} fill="#AA151B" />
          <Rect y={5} width={30} height={10} fill="#F1BF00" />
          <Rect y={15} width={30} height={5} fill="#AA151B" />
        </>
      );
      break;
    case 'es-MX':
      artwork = (
        <>
          <Rect width={10} height={20} fill="#006847" />
          <Rect x={10} width={10} height={20} fill="#FFFFFF" />
          <Rect x={20} width={10} height={20} fill="#CE1126" />
          <Circle cx={15} cy={10} r={1.45} fill="#8B6A32" />
          <Circle cx={15} cy={10} r={0.62} fill="#FFFFFF" />
        </>
      );
      break;
    case 'ja':
      artwork = (
        <>
          <Rect width={30} height={20} fill="#FFFFFF" />
          <Circle cx={15} cy={10} r={4} fill="#BC002D" />
        </>
      );
      break;
    case 'pl':
      artwork = (
        <>
          <Rect width={30} height={10} fill="#FFFFFF" />
          <Rect y={10} width={30} height={10} fill="#DC143C" />
        </>
      );
      break;
    case 'pt-BR':
      artwork = (
        <>
          <Rect width={30} height={20} fill="#009739" />
          <Polygon points="15,2 27,10 15,18 3,10" fill="#FFDF00" />
          <Circle cx={15} cy={10} r={4.4} fill="#002776" />
          <Rect x={10.7} y={9.25} width={8.6} height={1.35} rx={0.6} fill="#FFFFFF" transform="rotate(14 15 10)" />
        </>
      );
      break;
    case 'ru':
      artwork = (
        <>
          <Rect width={30} height={6.67} fill="#FFFFFF" />
          <Rect y={6.67} width={30} height={6.67} fill="#0039A6" />
          <Rect y={13.34} width={30} height={6.66} fill="#D52B1E" />
        </>
      );
      break;
    case 'zh-Hant':
      artwork = (
        <>
          <Rect width={30} height={20} fill="#FE0000" />
          <Rect width={13} height={10} fill="#000095" />
          <Circle cx={6.5} cy={5} r={2.35} fill="#FFFFFF" />
          <Circle cx={6.5} cy={5} r={0.85} fill="#000095" />
        </>
      );
      break;
    case 'zh-Hans':
      artwork = (
        <>
          <Rect width={30} height={20} fill="#DE2910" />
          <Star x={6} y={5} size={2.5} color="#FFDE00" />
          <Star x={10.8} y={2.4} size={0.8} color="#FFDE00" />
          <Star x={12.3} y={4.9} size={0.8} color="#FFDE00" />
          <Star x={12.1} y={7.8} size={0.8} color="#FFDE00" />
          <Star x={10.4} y={10} size={0.8} color="#FFDE00" />
        </>
      );
      break;
  }

  return (
    <Svg
      width={size}
      height={(size * 2) / 3}
      viewBox="0 0 30 20"
    >
      {artwork}
      <Rect x={0.5} y={0.5} width={29} height={19} fill="none" stroke={outline} strokeWidth={0.8} />
    </Svg>
  );
}
