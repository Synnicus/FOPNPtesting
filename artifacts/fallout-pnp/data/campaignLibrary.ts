import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const WEB_LIBRARY_KEY = '@fallout_pnp_campaign_library_v1';
const LIBRARY_FOLDER = 'fallout-pnp-campaigns';

export interface SavedCampaignRecord {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
  campaignJson: string;
}

function isSavedCampaignRecord(value: unknown): value is SavedCampaignRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SavedCampaignRecord>;
  return typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.description === 'string'
    && typeof record.updatedAt === 'number'
    && Number.isFinite(record.updatedAt)
    && typeof record.campaignJson === 'string';
}

function parseRecords(json: string | null): SavedCampaignRecord[] {
  if (!json) return [];
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value) || !value.every(isSavedCampaignRecord)) {
    throw new Error('Saved campaign library is damaged.');
  }
  return value;
}

function campaignDirectory() {
  return new Directory(Paths.document, LIBRARY_FOLDER);
}

export async function listSavedCampaigns(): Promise<SavedCampaignRecord[]> {
  if (Platform.OS === 'web') {
    return parseRecords(await AsyncStorage.getItem(WEB_LIBRARY_KEY));
  }

  const directory = campaignDirectory();
  if (!directory.exists) return [];
  const records: SavedCampaignRecord[] = [];
  for (const entry of directory.list()) {
    if (!(entry instanceof File) || !entry.name.endsWith('.json')) continue;
    try {
      const value: unknown = JSON.parse(await entry.text());
      if (isSavedCampaignRecord(value)) records.push(value);
    } catch {
      // Keep unreadable files on disk so a later recovery or export remains possible.
    }
  }
  return records.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCampaignRecord(record: SavedCampaignRecord): Promise<void> {
  if (!isSavedCampaignRecord(record)) throw new Error('Campaign details are invalid.');

  if (Platform.OS === 'web') {
    const records = parseRecords(await AsyncStorage.getItem(WEB_LIBRARY_KEY));
    const next = [...records.filter(item => item.id !== record.id), record]
      .sort((a, b) => b.updatedAt - a.updatedAt);
    await AsyncStorage.setItem(WEB_LIBRARY_KEY, JSON.stringify(next));
    return;
  }

  const directory = campaignDirectory();
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, `${record.id}.json`);
  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(record));
}

export async function deleteCampaignRecord(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    const records = parseRecords(await AsyncStorage.getItem(WEB_LIBRARY_KEY));
    await AsyncStorage.setItem(
      WEB_LIBRARY_KEY,
      JSON.stringify(records.filter(record => record.id !== id)),
    );
    return;
  }

  const file = new File(campaignDirectory(), `${id}.json`);
  if (file.exists) file.delete();
}
