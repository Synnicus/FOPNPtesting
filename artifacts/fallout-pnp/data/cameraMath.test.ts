import test from 'node:test';
import assert from 'node:assert/strict';
import { clampCameraPhi, fitCameraDistance, pinchCameraDistance } from '../components/tactical/cameraMath.ts';

test('3D orbit allows an exact 90 degree bird-eye angle while avoiding camera inversion', () => {
  assert.equal(clampCameraPhi(Math.PI / 2), Math.PI / 2);
  assert.equal(clampCameraPhi(Math.PI), Math.PI / 2);
  assert.ok(clampCameraPhi(-1) > 0);
});

test('3D reset fit accounts for the map bounds and portrait viewport aspect', () => {
  const phoneFit = fitCameraDistance(400, 800, 80, 60, 'hex');
  const landscapeFit = fitCameraDistance(800, 400, 80, 60, 'hex');
  assert.ok(phoneFit > landscapeFit);
  assert.ok(fitCameraDistance(400, 800, 20, 20, 'square') > 2.5);
});

test('pinching in zooms toward the map and pinching out widens the view within camera limits', () => {
  assert.equal(pinchCameraDistance(20, 100, 200), 10);
  assert.equal(pinchCameraDistance(20, 200, 100), 40);
  assert.equal(pinchCameraDistance(20, 100, 0), 1000);
});
