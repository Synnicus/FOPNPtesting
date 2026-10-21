import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { tr } from './i18n';
import { translateText } from '@/data/localization';
import { MAX_BOARD_ASSET_LENGTH, MAX_BOARD_TOTAL_ASSETS, isBoardImage, type TacticalBoard } from '@/data/tacticalBoard';

export type PickResult = { uri: string; name: string } | { error: string } | null;

export function boardAssetTotal(board: TacticalBoard): number {
  return (board.backgroundDataUri?.length ?? 0)
    + board.tokens.reduce((n, t) => n + (t.imageDataUri?.length ?? 0) + (t.mapIconDataUri?.length ?? 0) + (t.modelDataUri?.length ?? 0), 0)
    + board.obstacles.reduce((n, t) => n + (t.imageDataUri?.length ?? 0), 0);
}

/** Picks PNG/JPEG/WEBP/GIF, returns a validated data URI or an actionable error. */
export async function pickBoardImage(board: TacticalBoard, replacing = 0, quality = 1): Promise<PickResult> {
  // No editing/cropping and quality 1 by default so GIF and transparent PNG bytes are never re-encoded.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality, allowsEditing: false });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  let uri: string | null = null;
  if (asset.uri.startsWith('data:image/')) uri = asset.uri;
  else {
    let b64 = asset.base64 ?? null;
    if (!b64) { try { b64 = await new File(asset.uri).base64(); } catch { b64 = null; } }
    if (b64) {
    const ext = asset.uri.toLowerCase().split('?')[0].split('.').pop();
    const mime = asset.mimeType ?? (ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    uri = `data:${mime};base64,${b64}`;
    }
  }
  if (!uri) return { error: translateText('Could not read that image. Use a PNG, JPEG, WEBP, or GIF file.') };
  if (uri.length > MAX_BOARD_ASSET_LENGTH) {
    return { error: tr('Image is too large ({0} MB encoded; the limit is {1} MB). Use a smaller file.', (uri.length / 1e6).toFixed(1), (MAX_BOARD_ASSET_LENGTH / 1e6).toFixed(0)) };
  }
  if (!isBoardImage(uri)) return { error: translateText('Unsupported or corrupted image. Use a PNG, JPEG, WEBP, or GIF file.') };
  if (boardAssetTotal(board) - replacing + uri.length > MAX_BOARD_TOTAL_ASSETS) {
    return { error: tr('The board image budget ({0} MB total) would be exceeded. Remove an image first.', (MAX_BOARD_TOTAL_ASSETS / 1e6).toFixed(0)) };
  }
  return { uri, name: (asset.fileName ?? translateText('Obstacle')).replace(/\.[^.]+$/, '').slice(0, 60) };
}

/** Portrait picker for the quick pilot creator (JPEG-compressed, smaller budget). */
export async function pickPortrait(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.5, allowsEditing: true, aspect: [1, 1] });
  const a = r.canceled ? null : r.assets?.[0];
  if (!a) return null;
  if (a.uri.startsWith('data:image/')) return a.uri;
  return a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : null;
}
