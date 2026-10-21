import type { VehicleCategory } from '@/context/types';

export interface VehicleSilhouettePaths {
  body: string;
  detail: string[];
}

/** Top-down, transparent vector silhouettes used only for tactical map tokens. */
export const VEHICLE_TOPDOWN_SILHOUETTES: Record<VehicleCategory, VehicleSilhouettePaths> = {
  car: {
    body: 'M31 6 Q25 8 23 17 L17 32 L17 61 Q18 71 27 74 L73 74 Q82 71 83 61 L83 32 L77 17 Q75 8 69 6 Z',
    detail: ['M29 13 L71 13 L76 30 L24 30 Z', 'M22 35 L78 35', 'M22 59 L78 59', 'M31 35 L31 58 M69 35 L69 58'],
  },
  truck: {
    body: 'M22 5 L78 5 L78 45 L70 45 L70 73 L30 73 L30 45 L22 45 Z',
    detail: ['M29 12 L71 12 L71 38 L29 38 Z', 'M30 45 L70 45', 'M36 48 L64 48 L64 68 L36 68 Z'],
  },
  motorcycle: {
    body: 'M43 10 Q50 5 57 10 L55 28 L65 38 L59 47 L54 42 L49 52 L56 62 L50 71 L44 62 L49 51 L39 44 L35 49 L29 43 L39 34 L46 37 L49 29 Z',
    detail: ['M50 9 L50 71', 'M38 39 L61 39'],
  },
  boat: {
    body: 'M13 37 L87 37 L78 61 Q70 72 50 76 Q30 72 22 61 Z',
    detail: ['M30 38 L34 20 L66 20 L70 38', 'M39 20 L39 12 L61 12 L61 20', 'M50 12 L50 5'],
  },
  aircraft: {
    body: 'M47 4 Q50 1 53 4 L56 28 L88 41 L88 49 L57 43 L56 63 L69 70 L69 76 L50 72 L31 76 L31 70 L44 63 L43 43 L12 49 L12 41 L44 28 Z',
    detail: ['M50 7 L50 70', 'M22 43 L78 43', 'M37 68 L63 68'],
  },
  apc: {
    body: 'M22 7 L78 7 L85 17 L85 63 L78 73 L22 73 L15 63 L15 17 Z',
    detail: ['M25 12 L75 12 L79 20 L79 60 L75 68 L25 68 L21 60 L21 20 Z', 'M36 28 L64 28 L68 52 L32 52 Z', 'M50 18 L50 62'],
  },
  tank: {
    body: 'M18 5 L82 5 L88 14 L88 66 L82 75 L18 75 L12 66 L12 14 Z',
    detail: ['M23 10 L77 10 L81 18 L81 62 L77 70 L23 70 L19 62 L19 18 Z', 'M34 27 Q50 17 66 27 L69 50 Q50 62 31 50 Z', 'M47 5 L53 5 L53 31 L47 31 Z'],
  },
  trailer: {
    body: 'M21 7 L79 7 L79 68 L21 68 Z',
    detail: ['M28 14 L72 14 L72 61 L28 61 Z', 'M43 68 L57 68 L57 77 L43 77 Z', 'M35 22 L65 22 M35 30 L65 30 M35 38 L65 38'],
  },
  artillery: {
    body: 'M20 10 L80 10 L86 20 L86 63 L78 72 L22 72 L14 63 L14 20 Z',
    detail: ['M26 16 L74 16 L78 22 L78 60 L74 66 L26 66 L22 60 L22 22 Z', 'M42 34 Q50 25 58 34 L61 49 L39 49 Z', 'M48 6 L52 6 L52 38 L48 38'],
  },
};

export function vehicleTopDownSilhouette(category?: VehicleCategory): VehicleSilhouettePaths {
  return VEHICLE_TOPDOWN_SILHOUETTES[category ?? 'car'];
}
