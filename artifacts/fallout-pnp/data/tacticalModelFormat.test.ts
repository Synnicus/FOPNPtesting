import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64ToBytes,
  bytesToBase64,
  ModelFormatError,
  sanitizedGlbArrayBuffer,
  validateModelBytes,
} from '../components/tactical/modelFormat.ts';
import { createTacticalBoard, isTacticalBoard } from './tacticalBoard.ts';

function makeGlb(value: Record<string, unknown>, binary = new Uint8Array([1, 2, 3, 4])) {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const paddedJson = new Uint8Array(jsonLength).fill(0x20);
  paddedJson.set(json);
  const binLength = Math.ceil(binary.length / 4) * 4;
  const buffer = new ArrayBuffer(12 + 8 + jsonLength + 8 + binLength);
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true);
  bytes.set(paddedJson, 20);
  const binOffset = 20 + jsonLength;
  view.setUint32(binOffset, binLength, true); view.setUint32(binOffset + 4, 0x004e4942, true);
  bytes.set(binary, binOffset + 8);
  return new Uint8Array(buffer);
}

const smallGlbJson = () => ({
  asset: { version: '2.0' },
  buffers: [{ byteLength: 4 }],
  bufferViews: [{ buffer: 0, byteLength: 4 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.5, 0.4, 0.3, 1], baseColorTexture: { index: 0 } } }],
  images: [{ bufferView: 0, mimeType: 'image/png' }],
  textures: [{ source: 0 }],
});

function binaryStl(triangles: number) {
  const bytes = new Uint8Array(84 + triangles * 50);
  new DataView(bytes.buffer).setUint32(80, triangles, true);
  return bytes;
}

test('base64 encoding round-trips arbitrary model bytes', () => {
  const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
  assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
});

test('accepts a bounded binary STL and rejects oversized triangle counts', () => {
  assert.doesNotThrow(() => validateModelBytes(binaryStl(2), 'stl'));
  assert.throws(() => validateModelBytes(binaryStl(25_001), 'stl'), (error: unknown) =>
    error instanceof ModelFormatError && error.code === 'triangle-limit');
});

test('accepts valid ASCII STL but rejects incomplete triangle data', () => {
  const valid = new TextEncoder().encode('solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test');
  assert.doesNotThrow(() => validateModelBytes(valid, 'stl'));
  const invalid = new TextEncoder().encode('solid test\nfacet normal 0 0 1\nendsolid test');
  assert.throws(() => validateModelBytes(invalid, 'stl'), (error: unknown) =>
    error instanceof ModelFormatError && error.code === 'invalid-stl');
});

test('validates embedded glTF 2.0 and strips embedded texture bytes before rendering', () => {
  const bytes = makeGlb(smallGlbJson());
  assert.doesNotThrow(() => validateModelBytes(bytes, 'glb'));
  const sanitized = new Uint8Array(sanitizedGlbArrayBuffer(bytes));
  const jsonLength = new DataView(sanitized.buffer).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(sanitized.subarray(20, 20 + jsonLength)).trim());
  assert.equal(json.asset.version, '2.0');
  assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture, undefined);
  assert.equal(json.images, undefined);
});

test('rejects external glTF resources, malformed headers, and models above the mobile budget', () => {
  const external = makeGlb({ ...smallGlbJson(), images: [{ uri: 'https://example.invalid/image.png' }] });
  assert.throws(() => validateModelBytes(external, 'glb'), (error: unknown) =>
    error instanceof ModelFormatError && error.code === 'unsupported-glb');
  assert.throws(() => validateModelBytes(new Uint8Array([1, 2, 3]), 'glb'), (error: unknown) =>
    error instanceof ModelFormatError && error.code === 'invalid-glb');
  assert.throws(() => validateModelBytes(new Uint8Array(1_500_001), 'stl'), (error: unknown) =>
    error instanceof ModelFormatError && error.code === 'size-limit');
});

test('stores bounded GLB/STL board models as portable optional campaign-board fields', () => {
  const board = createTacticalBoard();
  const glb = bytesToBase64(makeGlb(smallGlbJson()));
  board.tokens.push({
    characterId: 'portable-token', q: 2, r: 3, width: 1, length: 1, facing: 0, speedKph: 0,
    modelDataUri: `data:model/gltf-binary;base64,${glb}`, modelFormat: 'glb', modelName: 'custom standee', modelScale: 1.2,
  });
  assert.equal(isTacticalBoard(board), true);
  const invalid = structuredClone(board);
  invalid.tokens[0].modelFormat = 'stl';
  assert.equal(isTacticalBoard(invalid), false);
  const oversized = structuredClone(board);
  oversized.tokens[0].modelScale = 9;
  assert.equal(isTacticalBoard(oversized), false);
});
