import * as DocumentPicker from 'expo-document-picker';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  MAX_BOARD_MODEL_BYTES,
  MAX_BOARD_MODEL_LENGTH,
  isBoardModel,
} from '@/data/tacticalBoard';
import { tr } from './i18n';
import {
  base64ToBytes,
  bytesToBase64,
  ModelFormatError,
  validateModelBytes,
} from './modelFormat';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export interface PickedBoardModel {
  uri: string;
  format: 'glb' | 'stl';
  name: string;
}

function modelError(error: unknown): string {
  if (error instanceof ModelFormatError && (error.code === 'size-limit' || error.code === 'triangle-limit')) {
    return tr('Models are limited to 1.5 MB and 25,000 triangles.');
  }
  if (error instanceof ModelFormatError) return tr('This model is invalid or uses an unsupported feature.');
  return tr('Could not read the model file on this device.');
}

export async function pickBoardModel(): Promise<{ model: PickedBoardModel } | { error: string } | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const extension = asset.name.toLowerCase().split('.').pop();
    if (extension !== 'glb' && extension !== 'stl') {
      return { error: tr('Choose a self-contained GLB or STL file.') };
    }
    if (asset.size && asset.size > MAX_BOARD_MODEL_BYTES) return { error: tr('Models are limited to 1.5 MB and 25,000 triangles.') };
    const format = extension;
    let bytes: Uint8Array;
    if (Platform.OS === 'web') {
      const browserFile = (asset as typeof asset & { file?: globalThis.File }).file;
      if (!browserFile) return { error: tr('Could not read this model file on this device.') };
      bytes = new Uint8Array(await browserFile.arrayBuffer());
    } else {
      bytes = base64ToBytes(await new ExpoFile(asset.uri).base64());
    }
    validateModelBytes(bytes, format);
    const uri = `data:${format === 'glb' ? 'model/gltf-binary' : 'model/stl'};base64,${bytesToBase64(bytes)}`;
    if (!isBoardModel(uri, format) || uri.length > MAX_BOARD_MODEL_LENGTH) {
      return { error: tr('Models are limited to 1.5 MB and 25,000 triangles.') };
    }
    return { model: { uri, format, name: asset.name.replace(/\.(glb|stl)$/i, '').slice(0, 60) } };
  } catch (error) {
    return { error: modelError(error) };
  }
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

/** Materialize portable data-URI artwork in the native cache for Expo GL. */
export async function localTextureUri(uri: string | number): Promise<string | number> {
  if (typeof uri === 'number' || Platform.OS === 'web' || !uri.startsWith('data:image/')) return uri;
  const match = uri.match(/^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error(tr('This board image cannot be loaded in 3D.'));
  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const directory = new Directory(Paths.cache, 'fallout-pnp-3d-textures');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const file = new ExpoFile(directory, `${stableHash(uri)}.${extension}`);
  if (!file.exists) {
    file.create({ intermediates: true });
    file.write(match[2], { encoding: 'base64' });
  }
  return file.uri;
}

