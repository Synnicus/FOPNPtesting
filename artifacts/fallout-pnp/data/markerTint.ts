import { inflateSync } from 'fflate';

const BASE64_LOOKUP = (() => {
  const table = new Uint8Array(128);
  table.fill(255);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let index = 0; index < alphabet.length; index += 1) table[alphabet.charCodeAt(index)] = index;
  return table;
})();

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_MARKER_PIXELS = 1024 * 1024;
const MAX_DECODED_BYTES = 5 * 1024 * 1024;

function decodeBase64(value: string): Uint8Array | null {
  const clean = value.replace(/\s/g, '');
  if (!clean || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let output = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = clean.charCodeAt(index);
    const b = clean.charCodeAt(index + 1);
    const c = clean.charCodeAt(index + 2);
    const d = clean.charCodeAt(index + 3);
    if (a > 127 || b > 127 || c > 127 || d > 127
      || BASE64_LOOKUP[a] === 255 || BASE64_LOOKUP[b] === 255
      || (clean[index + 2] !== '=' && BASE64_LOOKUP[c] === 255)
      || (clean[index + 3] !== '=' && BASE64_LOOKUP[d] === 255)) return null;
    const packed = (BASE64_LOOKUP[a] << 18)
      | (BASE64_LOOKUP[b] << 12)
      | ((clean[index + 2] === '=' ? 0 : BASE64_LOOKUP[c]) << 6)
      | (clean[index + 3] === '=' ? 0 : BASE64_LOOKUP[d]);
    if (output < bytes.length) bytes[output++] = (packed >> 16) & 255;
    if (output < bytes.length) bytes[output++] = (packed >> 8) & 255;
    if (output < bytes.length) bytes[output++] = packed & 255;
  }
  return bytes;
}

function readUint32(bytes: Uint8Array, start: number): number {
  return (bytes[start] * 0x1000000)
    + (bytes[start + 1] << 16)
    + (bytes[start + 2] << 8)
    + bytes[start + 3];
}

function sampleAt(row: Uint8Array, sample: number, bitDepth: number): number {
  if (bitDepth === 16) return (row[sample * 2] << 8) | row[sample * 2 + 1];
  if (bitDepth === 8) return row[sample];
  const bit = sample * bitDepth;
  const shift = 8 - bitDepth - (bit % 8);
  return (row[Math.floor(bit / 8)] >> shift) & ((1 << bitDepth) - 1);
}

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

/**
 * Detects actual transparent pixels in non-interlaced PNGs. Tinting is only
 * enabled for PNGs where pixel alpha (or a tRNS transparency key) is present,
 * so an opaque RGBA export is left alone. Original data remains portable and
 * unchanged; the renderer applies an alpha-preserving theme mask.
 */
export function supportsThemeTint(imageDataUri: string): boolean {
  const match = /^data:image\/png;base64,([a-z0-9+/=\s]+)$/i.exec(imageDataUri);
  if (!match) return false;
  const bytes = decodeBase64(match[1]);
  if (!bytes || bytes.length < 33 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return false;

  const firstChunkLength = readUint32(bytes, 8);
  if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR' || firstChunkLength !== 13) return false;
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  const supportedDepths: Record<number, number[]> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  if (!width || !height || width * height > MAX_MARKER_PIXELS
    || !channels || !supportedDepths[colorType]?.includes(bitDepth)
    || bytes[26] !== 0 || bytes[27] !== 0 || interlace !== 0) return false;

  let offset = 8;
  const compressedChunks: Uint8Array[] = [];
  let compressedLength = 0;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return false;
    if (type === 'PLTE') palette = bytes.slice(dataStart, dataEnd);
    else if (type === 'tRNS') transparency = bytes.slice(dataStart, dataEnd);
    else if (type === 'IDAT') {
      compressedChunks.push(bytes.slice(dataStart, dataEnd));
      compressedLength += length;
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (colorType !== 4 && colorType !== 6
    && !(colorType === 3 && transparency?.some(alpha => alpha < 255))
    && !((colorType === 0 || colorType === 2) && transparency)) return false;

  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const expectedLength = (rowBytes + 1) * height;
  if (expectedLength > MAX_DECODED_BYTES || compressedLength === 0) return false;
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;
  for (const chunk of compressedChunks) {
    compressed.set(chunk, compressedOffset);
    compressedOffset += chunk.length;
  }

  let decoded: Uint8Array;
  try {
    decoded = inflateSync(compressed, { out: new Uint8Array(expectedLength) });
  } catch {
    return false;
  }
  if (decoded.length !== expectedLength) return false;

  const bytesPerPixel = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const previousRow = new Uint8Array(rowBytes);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = decoded[inputOffset++];
    if (filter > 4) return false;
    const row = decoded.slice(inputOffset, inputOffset + rowBytes);
    inputOffset += rowBytes;
    for (let index = 0; index < rowBytes; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const above = previousRow[index];
      const upperLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;
      const predictor = filter === 1 ? left
        : filter === 2 ? above
          : filter === 3 ? Math.floor((left + above) / 2)
            : filter === 4 ? paeth(left, above, upperLeft)
              : 0;
      row[index] = (row[index] + predictor) & 255;
    }

    for (let x = 0; x < width; x += 1) {
      if (colorType === 4 || colorType === 6) {
        const alpha = sampleAt(row, (x * channels) + channels - 1, bitDepth);
        const maximumAlpha = bitDepth === 16 ? 65535 : (1 << bitDepth) - 1;
        if (alpha < maximumAlpha) return true;
      } else if (colorType === 3 && transparency) {
        const paletteIndex = sampleAt(row, x, bitDepth);
        if ((transparency[paletteIndex] ?? 255) < 255) return true;
      } else if (colorType === 0 && transparency) {
        const key = (transparency[0] << 8) | transparency[1];
        if (sampleAt(row, x, bitDepth) === key) return true;
      } else if (colorType === 2 && transparency) {
        const red = (transparency[0] << 8) | transparency[1];
        const green = (transparency[2] << 8) | transparency[3];
        const blue = (transparency[4] << 8) | transparency[5];
        if (sampleAt(row, x * channels, bitDepth) === red
          && sampleAt(row, (x * channels) + 1, bitDepth) === green
          && sampleAt(row, (x * channels) + 2, bitDepth) === blue) return true;
      }
    }
    previousRow.set(row);
  }
  return false;
}
