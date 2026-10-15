import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const WEB_DATABASE_NAME = 'fallout-pnp-campaign-library';
const WEB_OBJECT_STORE = 'campaigns';
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

function campaignDirectory() {
  return new Directory(Paths.document, LIBRARY_FOLDER);
}

function openWebDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Browser campaign storage is unavailable.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WEB_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WEB_OBJECT_STORE)) {
        request.result.createObjectStore(WEB_OBJECT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open browser campaign storage.'));
  });
}

function readWebCampaigns(): Promise<SavedCampaignRecord[]> {
  return openWebDatabase().then(database => new Promise((resolve, reject) => {
    const request = database.transaction(WEB_OBJECT_STORE, 'readonly')
      .objectStore(WEB_OBJECT_STORE)
      .getAll();
    request.onsuccess = () => {
      const records: unknown[] = request.result;
      if (!records.every(isSavedCampaignRecord)) {
        database.close();
        reject(new Error('Saved campaign library is damaged.'));
        return;
      }
      database.close();
      resolve((records as SavedCampaignRecord[]).sort((a, b) => b.updatedAt - a.updatedAt));
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('Could not read saved campaigns.'));
    };
  }));
}

export async function listSavedCampaigns(): Promise<SavedCampaignRecord[]> {
  if (Platform.OS === 'web') {
    return readWebCampaigns();
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
    const database = await openWebDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WEB_OBJECT_STORE, 'readwrite');
      transaction.objectStore(WEB_OBJECT_STORE).put(record);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not save campaign.')); };
      transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Could not save campaign.')); };
    });
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
    const database = await openWebDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WEB_OBJECT_STORE, 'readwrite');
      transaction.objectStore(WEB_OBJECT_STORE).delete(id);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not delete campaign.')); };
      transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Could not delete campaign.')); };
    });
    return;
  }

  const file = new File(campaignDirectory(), `${id}.json`);
  if (file.exists) file.delete();
}
