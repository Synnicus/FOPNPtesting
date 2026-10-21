import {
  MAX_BOARD_MODEL_BYTES,
  MAX_BOARD_MODEL_TRIANGLES,
} from '../../data/tacticalBoard.ts';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export type ModelFormatErrorCode =
  | 'size-limit' | 'invalid-base64' | 'invalid-glb' | 'unsupported-glb'
  | 'invalid-stl' | 'triangle-limit' | 'missing-geometry';

export class ModelFormatError extends Error {
  readonly code: ModelFormatErrorCode;
  constructor(code: ModelFormatErrorCode) { super(code); this.code = code; }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    result += BASE64[a >> 2] + BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]
      + (b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)])
      + (c === undefined ? '=' : BASE64[c & 63]);
  }
  return result;
}

export function base64ToBytes(source: string): Uint8Array {
  const clean = source.replace(/\s/g, '').replace(/=+$/, '');
  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64.length; i++) lookup[BASE64.charCodeAt(i)] = i;
  const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let out = 0, buffer = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i), value = code < 128 ? lookup[code] : -1;
    if (value < 0) throw new ModelFormatError('invalid-base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (out < bytes.length) bytes[out++] = (buffer >> bits) & 255;
    }
  }
  return bytes.subarray(0, out);
}

function textFromBytes(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  }
  return text;
}

export function decodeModelDataUri(uri: string): Uint8Array {
  const comma = uri.indexOf(',');
  if (comma < 0) throw new ModelFormatError('invalid-base64');
  return base64ToBytes(uri.slice(comma + 1));
}

interface ParsedGlb { value: Record<string, any>; bin?: Uint8Array }

function parseGlb(bytes: Uint8Array): ParsedGlb {
  if (bytes.length < 20 || textFromBytes(bytes.subarray(0, 4)) !== 'glTF') throw new ModelFormatError('invalid-glb');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) throw new ModelFormatError('unsupported-glb');
  let cursor = 12, json: Record<string, any> | null = null, bin: Uint8Array | undefined;
  while (cursor + 8 <= bytes.length) {
    const length = view.getUint32(cursor, true), type = view.getUint32(cursor + 4, true);
    cursor += 8;
    if (length > bytes.length - cursor) throw new ModelFormatError('invalid-glb');
    const chunk = bytes.subarray(cursor, cursor + length);
    if (type === 0x4e4f534a && json === null) {
      try { json = JSON.parse(textFromBytes(chunk).replace(/\0+$/g, '').trim()) as Record<string, any>; }
      catch { throw new ModelFormatError('invalid-glb'); }
    } else if (type === 0x004e4942 && !bin) bin = chunk;
    else throw new ModelFormatError('unsupported-glb');
    cursor += length;
  }
  if (cursor !== bytes.length || !json || json.asset?.version !== '2.0') throw new ModelFormatError('unsupported-glb');
  return { value: json, bin };
}

function glbTriangleCount(json: Record<string, any>): number {
  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  let count = 0;
  for (const mesh of Array.isArray(json.meshes) ? json.meshes : []) {
    for (const primitive of Array.isArray(mesh.primitives) ? mesh.primitives : []) {
      const position = accessors[primitive.attributes?.POSITION];
      const indices = primitive.indices === undefined ? undefined : accessors[primitive.indices];
      if (!position || !Number.isInteger(position.count) || position.count < 3) throw new ModelFormatError('missing-geometry');
      const vertexCount = indices?.count ?? position.count;
      count += (primitive.mode ?? 4) === 4 ? Math.floor(vertexCount / 3) : Math.max(0, vertexCount - 2);
      if (count > MAX_BOARD_MODEL_TRIANGLES) return count;
    }
  }
  return count;
}

export function validateModelBytes(bytes: Uint8Array, format: 'glb' | 'stl'): void {
  if (!bytes.length || bytes.length > MAX_BOARD_MODEL_BYTES) throw new ModelFormatError('size-limit');
  if (format === 'stl') {
    if (bytes.length < 15) throw new ModelFormatError('invalid-stl');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const binaryTriangles = bytes.length >= 84 ? view.getUint32(80, true) : 0;
    const isBinary = binaryTriangles > 0 && bytes.length === 84 + binaryTriangles * 50;
    let triangles = 0;
    if (isBinary) triangles = binaryTriangles;
    else {
      const source = textFromBytes(bytes);
      if (!/^\s*solid(?:\s|$)/i.test(source) || !/endsolid\b/i.test(source)) throw new ModelFormatError('invalid-stl');
      triangles = (source.match(/\bfacet\s+normal\b/gi) ?? []).length;
      if (!triangles || (source.match(/\bvertex\s+[-+\d.eE]+/gi) ?? []).length !== triangles * 3) throw new ModelFormatError('invalid-stl');
    }
    if (triangles > MAX_BOARD_MODEL_TRIANGLES) throw new ModelFormatError('triangle-limit');
    return;
  }

  const { value, bin } = parseGlb(bytes);
  if ((value.nodes?.length ?? 0) > 512 || (value.meshes?.length ?? 0) > 256 || (value.materials?.length ?? 0) > 128
    || value.extensionsRequired?.some((x: string) => x === 'KHR_draco_mesh_compression' || x === 'EXT_meshopt_compression')) {
    throw new ModelFormatError('unsupported-glb');
  }
  if (!Array.isArray(value.buffers) || value.buffers.length !== 1 || value.buffers[0].uri
    || !bin || !Number.isInteger(value.buffers[0].byteLength) || value.buffers[0].byteLength > bin.length
    || (value.images ?? []).some((image: { uri?: string }) => image.uri && !image.uri.startsWith('data:'))) {
    throw new ModelFormatError('unsupported-glb');
  }
  const triangles = glbTriangleCount(value);
  if (!triangles) throw new ModelFormatError('missing-geometry');
  if (triangles > MAX_BOARD_MODEL_TRIANGLES) throw new ModelFormatError('triangle-limit');
}

export function sanitizedGlbArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const { value, bin } = parseGlb(bytes);
  for (const material of value.materials ?? []) {
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    delete material.extensions;
    const pbr = material.pbrMetallicRoughness;
    if (pbr) { delete pbr.baseColorTexture; delete pbr.metallicRoughnessTexture; }
  }
  delete value.images; delete value.textures; delete value.samplers;
  delete value.extensionsUsed; delete value.extensionsRequired;
  const rawJson = new TextEncoder().encode(JSON.stringify(value));
  const jsonLength = Math.ceil(rawJson.length / 4) * 4;
  const paddedJson = new Uint8Array(jsonLength).fill(0x20);
  paddedJson.set(rawJson);
  const binLength = bin ? Math.ceil(bin.length / 4) * 4 : 0;
  const total = 12 + 8 + jsonLength + (binLength ? 8 + binLength : 0);
  const result = new ArrayBuffer(total);
  const view = new DataView(result), target = new Uint8Array(result);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true); target.set(paddedJson, 20);
  if (bin && binLength) {
    const offset = 20 + jsonLength;
    view.setUint32(offset, binLength, true); view.setUint32(offset + 4, 0x004e4942, true); target.set(bin, offset + 8);
  }
  return result;
}
