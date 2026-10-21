const MIN_CAMERA_DISTANCE = 2.5;
const MAX_CAMERA_DISTANCE = 1000;
const CAMERA_FOV_RADIANS = 42 * Math.PI / 180;

export function clampCameraPhi(phi: number): number {
  return Math.max(0.02, Math.min(Math.PI / 2, phi));
}

export function pinchCameraDistance(startDistance: number, startTouchDistance: number, currentTouchDistance: number): number {
  return Math.max(
    MIN_CAMERA_DISTANCE,
    Math.min(MAX_CAMERA_DISTANCE, startDistance * startTouchDistance / Math.max(1, currentTouchDistance)),
  );
}

export function fitCameraDistance(
  width: number,
  height: number,
  columns: number,
  rows: number,
  grid: 'hex' | 'square',
): number {
  const aspect = Math.max(0.05, width / Math.max(1, height));
  const mapWidth = columns + (grid === 'hex' ? rows / 2 : 0);
  const mapHeight = rows * (grid === 'hex' ? Math.sqrt(3) / 2 : 1);
  const tangent = Math.tan(CAMERA_FOV_RADIANS / 2);
  const distanceByHeight = mapHeight / (2 * tangent);
  const distanceByWidth = mapWidth / (2 * tangent * aspect);
  return Math.max(MIN_CAMERA_DISTANCE, distanceByHeight, distanceByWidth) * 1.12;
}
