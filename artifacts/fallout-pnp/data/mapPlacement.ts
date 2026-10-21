export type MapPoint = { x: number; y: number };
export type MapSize = { width: number; height: number };

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** The image is centered, then scaled around its center and translated by pan. */
export function mapViewportCenter(
  artboard: MapSize, zoom: number, pan: MapPoint, screenOffset: MapPoint = { x: 0, y: 0 },
): MapPoint {
  return {
    x: clamp(0.5 + (screenOffset.x - pan.x) / (artboard.width * zoom)),
    y: clamp(0.5 + (screenOffset.y - pan.y) / (artboard.height * zoom)),
  };
}

/** Gesture deltas are screen pixels, while stored marker coordinates are normalized. */
export function moveMapMarker(start: MapPoint, delta: MapPoint, artboard: MapSize, zoom: number): MapPoint {
  return {
    x: clamp(start.x + delta.x / (artboard.width * zoom)),
    y: clamp(start.y + delta.y / (artboard.height * zoom)),
  };
}
