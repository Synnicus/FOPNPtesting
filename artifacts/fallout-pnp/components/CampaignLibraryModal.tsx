import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  View,
} from 'react-native';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import {
  LocalizedAlert as LocalizedAlert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import { useApp } from '@/context/AppContext';
import type { Character, VehicleProfile } from '@/context/types';
import { useColors } from '@/hooks/useColors';
import {
  createCampaignBundle,
  parseCampaignFile,
  parsePortraitDataUri,
  portraitAsset,
  portraitDataUri,
  vehiclePortraitAsset,
  restoreCampaignPortraits,
  type CampaignStateSnapshot,
  type PortablePortraitAsset,
} from '@/data/portableExports';
import {
  deleteCampaignRecord,
  listSavedCampaigns,
  saveCampaignRecord,
  type SavedCampaignRecord,
} from '@/data/campaignLibrary';

const portraitExtension = (mimeType: string) => ({
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}[mimeType] ?? 'jpg');

function mimeTypeForUri(uri: string, reportedType?: string | null): string {
  if (reportedType?.startsWith('image/')) return reportedType;
  const path = uri.toLowerCase().split(/[?#]/)[0];
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function collectPortraitAssets(characters: readonly Character[], vehicles: readonly VehicleProfile[] = []) {
  const readCharacter = async (character: Character) => {
    if (!character.portrait) return null;
    const embedded = parsePortraitDataUri(character.portrait);
    if (embedded) return portraitAsset(character.id, embedded.mimeType, embedded.base64);
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(character.portrait);
        if (!response.ok) return null;
        const blob = await response.blob();
        return portraitAsset(
          character.id,
          mimeTypeForUri(character.portrait, blob.type),
          arrayBufferToBase64(await blob.arrayBuffer()),
        );
      }
      const file = new ExpoFile(character.portrait);
      if (!file.exists) return null;
      return portraitAsset(character.id, mimeTypeForUri(character.portrait, file.type), await file.base64());
    } catch {
      return null;
    }
  };
  const readVehicle = async (vehicle: VehicleProfile) => {
    if (!vehicle.portrait) return null;
    const embedded = parsePortraitDataUri(vehicle.portrait);
    if (embedded) return vehiclePortraitAsset(vehicle.id, embedded.mimeType, embedded.base64);
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(vehicle.portrait);
        if (!response.ok) return null;
        const blob = await response.blob();
        return vehiclePortraitAsset(vehicle.id, mimeTypeForUri(vehicle.portrait, blob.type), arrayBufferToBase64(await blob.arrayBuffer()));
      }
      const file = new ExpoFile(vehicle.portrait);
      if (!file.exists) return null;
      return vehiclePortraitAsset(vehicle.id, mimeTypeForUri(vehicle.portrait, file.type), await file.base64());
    } catch {
      return null;
    }
  };
  const assets = await Promise.all([
    ...characters.map(readCharacter),
    ...vehicles.map(readVehicle),
  ]);
  return assets.filter((asset): asset is NonNullable<typeof asset> => asset !== null);
}

function createPortraitImportSession(): {
  materialize: (asset: PortablePortraitAsset) => Promise<string>;
  cleanup: () => void;
} {
  if (Platform.OS === 'web') {
    return { materialize: async asset => portraitDataUri(asset), cleanup: () => {} };
  }

  const directory = new Directory(
    Paths.document,
    `fallout-pnp-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  directory.create({ intermediates: true, idempotent: true });
  let assetIndex = 0;
  return {
    materialize: async asset => {
      const ownerId = asset.kind === 'character-portrait' ? asset.characterId : asset.vehicleId;
      const safeId = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
      const file = new ExpoFile(
        directory,
        `${assetIndex++}-${safeId}.${portraitExtension(asset.mimeType)}`,
      );
      file.create({ overwrite: false });
      file.write(asset.base64, { encoding: 'base64' });
      return file.uri;
    },
    cleanup: () => {
      if (directory.exists) directory.delete();
    },
  };
}

function webDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string) {
  const safe = name.trim()
    .replace(/\.json$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100);
  return `${safe || 'fallout-campaign'}.json`;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function campaignStateFromJson(json: string): CampaignStateSnapshot | null {
  try {
    const parsed = parseCampaignFile(json);
    if (!parsed.ok) return null;
    return parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
  } catch {
    return null;
  }
}

async function makePortableCampaignJson(json: string): Promise<string> {
  const parsed = parseCampaignFile(json);
  if (!parsed.ok) throw new Error('Could not save campaign.');
  const state = parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
  const assets = parsed.source === 'portable'
    ? parsed.bundle.assets
    : await collectPortraitAssets(state.characters, state.customVehicles ?? []);
  return JSON.stringify(createCampaignBundle(state, assets));
}

function campaignCounts(json: string) {
  const state = campaignStateFromJson(json);
  if (!state) return { characters: 0, npcs: 0, equipment: 0 };
  const customAmmo = (state as CampaignStateSnapshot & { customAmmo?: unknown[] }).customAmmo ?? [];
  return {
    characters: state.characters.length,
    npcs: state.characters.filter(character => character.type === 'npc').length,
    equipment: (state.customWeapons?.length ?? 0) + (state.customArmor?.length ?? 0)
      + (state.customVehicles?.length ?? 0) + customAmmo.length
      + (state.customConsumables?.length ?? 0),
  };
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled = false,
  destructive = false,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  testID: string;
}) {
  const colors = useColors();
  const tint = destructive ? colors.destructive : colors.primary;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={{
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: disabled ? colors.border : tint,
        borderRadius: colors.radius,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Feather name={icon} size={14} color={tint} />
      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: tint, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CampaignLibraryModal({
  visible,
  onClose,
  onCampaignLoaded,
}: {
  visible: boolean;
  onClose: () => void;
  onCampaignLoaded: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loaded, exportCampaign, importCampaign } = useApp();
  const [records, setRecords] = useState<SavedCampaignRecord[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const refreshRecords = useCallback(async () => {
    try {
      setRecords(await listSavedCampaigns());
      setStatus('');
    } catch {
      setStatus('Campaign could not be read.');
    }
  }, []);

  useEffect(() => {
    if (visible) void refreshRecords();
  }, [visible, refreshRecords]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.updatedAt - a.updatedAt),
    [records],
  );

  const saveRecord = async (record: SavedCampaignRecord) => {
    await saveCampaignRecord(record);
    setRecords(current => [...current.filter(item => item.id !== record.id), record]
      .sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const saveCurrentCampaign = async () => {
    const name = newName.trim();
    if (!name) {
      setStatus('Campaign name is required.');
      return;
    }
    setBusy(true);
    try {
      const campaignJson = await makePortableCampaignJson(exportCampaign());
      const record: SavedCampaignRecord = {
        id: newId(),
        name,
        description: newDescription.trim(),
        updatedAt: Date.now(),
        campaignJson,
      };
      await saveRecord(record);
      setNewName('');
      setNewDescription('');
      setShowSaveForm(false);
      setStatus('Campaign saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save campaign.');
    } finally {
      setBusy(false);
    }
  };

  const uploadCampaignJson = async (json: string, fileName?: string) => {
    const parsed = parseCampaignFile(json.trim());
    if (!parsed.ok) {
      setStatus(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const state = parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
      const assets = parsed.source === 'portable'
        ? parsed.bundle.assets
        : await collectPortraitAssets(state.characters, state.customVehicles ?? []);
      const filenameName = fileName?.replace(/\.json$/i, '').trim();
      const baseName = filenameName && filenameName.length > 0 ? filenameName : 'Imported campaign';
      const record: SavedCampaignRecord = {
        id: newId(),
        name: baseName.slice(0, 80),
        description: '',
        updatedAt: Date.now(),
        campaignJson: JSON.stringify(createCampaignBundle(state, assets)),
      };
      await saveRecord(record);
      setStatus('Campaign imported.');
    } catch {
      setStatus('Could not save campaign.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
          try {
            const file = input.files?.[0];
            if (file) await uploadCampaignJson(await file.text(), file.name);
          } catch {
            setStatus('Could not open JSON file.');
          }
        };
        input.click();
        return;
      }
      const picked = await ExpoFile.pickFileAsync(undefined, 'application/json');
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (file) {
        const filename = file.uri.split(/[\\/]/).pop();
        await uploadCampaignJson(await file.text(), filename);
      }
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      setStatus('Could not open JSON file.');
    }
  };

  const exportSavedCampaign = async (record: SavedCampaignRecord) => {
    setBusy(true);
    try {
      const parsed = parseCampaignFile(record.campaignJson);
      if (!parsed.ok) throw new Error(parsed.error);
      const state = parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
      const assets = parsed.source === 'portable'
        ? parsed.bundle.assets
        : await collectPortraitAssets(state.characters, state.customVehicles ?? []);
      const bundle = createCampaignBundle(state, assets);
      const json = JSON.stringify(bundle, null, 2);
      const filename = sanitizeFilename(record.name);
      if (Platform.OS === 'web') {
        webDownload(json, filename);
        setStatus('Campaign exported.');
      } else {
        const file = new ExpoFile(Paths.document, filename);
        file.create({ intermediates: true, overwrite: true });
        file.write(json);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
        }
        setStatus('Campaign exported.');
      }
    } catch {
      setStatus('Could not export campaign.');
    } finally {
      setBusy(false);
    }
  };

  const loadCampaign = (record: SavedCampaignRecord) => {
    const confirmLoad = async () => {
      if (busy) return;
      setBusy(true);
      let importSession: ReturnType<typeof createPortraitImportSession> | null = null;
      try {
        const parsed = parseCampaignFile(record.campaignJson);
        if (!parsed.ok) {
          setStatus(parsed.error);
          return;
        }
        let state = parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
        if (parsed.source === 'portable') {
          importSession = createPortraitImportSession();
          state = (await restoreCampaignPortraits(parsed.bundle, importSession.materialize)).state;
        }
        if (!await importCampaign(JSON.stringify({
          ...state,
          campaignName: record.name,
        }))) {
          importSession?.cleanup();
          setStatus('Campaign could not be loaded. Your current campaign was kept.');
          return;
        }
        setStatus('');
        onCampaignLoaded();
      } catch {
        importSession?.cleanup();
        setStatus('Campaign could not be loaded.');
      } finally {
        setBusy(false);
      }
    };
    const title = 'Are you sure?';
    const message = 'Loading will replace unsaved changes in the current campaign.';
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) void confirmLoad();
    } else {
      LocalizedAlert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load', style: 'destructive', onPress: () => void confirmLoad() },
      ]);
    }
  };

  const confirmDelete = (record: SavedCampaignRecord) => {
    const remove = async () => {
      try {
        await deleteCampaignRecord(record.id);
        setRecords(current => current.filter(item => item.id !== record.id));
        setStatus('Campaign deleted.');
      } catch {
        setStatus('Could not delete campaign.');
      }
    };
    const title = 'Are you sure?';
    const message = 'Delete this saved campaign from this device? This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) void remove();
    } else {
      LocalizedAlert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ]);
    }
  };

  const commitDescription = async (record: SavedCampaignRecord) => {
    const description = (descriptionDrafts[record.id] ?? record.description).trim();
    try {
      await saveRecord({ ...record, description, updatedAt: Date.now() });
      setDescriptionDrafts(current => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      setStatus('Description saved.');
    } catch {
      setStatus('Could not save description.');
    }
  };

  const commitRename = async (record: SavedCampaignRecord) => {
    const name = renameDraft.trim();
    if (!name) {
      setStatus('Campaign name is required.');
      return;
    }
    try {
      await saveRecord({ ...record, name, updatedAt: Date.now() });
      setRenamingId(null);
      setRenameDraft('');
      setStatus('Campaign renamed.');
    } catch {
      setStatus('Could not rename campaign.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      testID="campaign-library-modal"
    >
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Campaign Library
            </Text>
            <Text style={{ marginTop: 3, fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              Saved JSON campaigns stay on this device.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={{ padding: 6 }}
          >
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollViewCompat
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 26, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={30}
        >
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <ActionButton
              icon="save"
              label="Save Current Campaign"
              onPress={() => setShowSaveForm(value => !value)}
              disabled={!loaded || busy}
              testID="save-current-campaign"
            />
            <ActionButton
              icon="upload"
              label="Upload JSON"
              onPress={() => void handleUpload()}
              disabled={!loaded || busy}
              testID="upload-campaign-json"
            />
          </View>

          {showSaveForm && (
            <View style={{
              padding: 13,
              gap: 9,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: colors.radius,
              backgroundColor: colors.card,
            }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary, textTransform: 'uppercase' }}>
                Save Current Campaign
              </Text>
              <TextInput
                accessibilityLabel="Campaign name"
                testID="new-campaign-name"
                value={newName}
                onChangeText={setNewName}
                placeholder="Campaign name"
                maxLength={80}
                style={{ minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background }}
              />
              <TextInput
                accessibilityLabel="Description (optional)"
                testID="new-campaign-description"
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Description (optional)"
                multiline
                maxLength={500}
                textAlignVertical="top"
                style={{ minHeight: 82, padding: 11, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <ActionButton icon="x" label="Cancel" onPress={() => setShowSaveForm(false)} testID="cancel-save-campaign" />
                <ActionButton icon="check" label="Save" onPress={() => void saveCurrentCampaign()} disabled={!loaded || busy} testID="confirm-save-campaign" />
              </View>
            </View>
          )}

          {status ? (
            <Text accessibilityRole="alert" testID="campaign-library-status" style={{ fontSize: 12, lineHeight: 17, color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
              {status}
            </Text>
          ) : null}

          {!loaded ? (
            <Text style={{ paddingVertical: 30, textAlign: 'center', color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>
              Loading current campaign…
            </Text>
          ) : sortedRecords.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 34 }}>
              <Feather name="archive" size={26} color={colors.mutedForeground} />
              <Text style={{ textAlign: 'center', color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>
                No saved campaigns yet. Save the current campaign or upload a JSON file.
              </Text>
            </View>
          ) : (
            sortedRecords.map(record => {
              const counts = campaignCounts(record.campaignJson);
              const draft = descriptionDrafts[record.id];
              const descriptionChanged = draft !== undefined && draft !== record.description;
              const isRenaming = renamingId === record.id;
              return (
                <View
                  key={record.id}
                  testID={`saved-campaign-${record.id}`}
                  style={{
                    padding: 13,
                    gap: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.card,
                  }}
                >
                  {isRenaming ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <TextInput
                accessibilityLabel="Rename campaign"
                        value={renameDraft}
                        onChangeText={setRenameDraft}
                        maxLength={80}
                        autoFocus
                        style={{ flex: 1, minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background }}
                      />
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save" onPress={() => void commitRename(record)} style={{ padding: 8 }}>
                        <Feather name="check" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => setRenamingId(null)} style={{ padding: 8 }}>
                        <Feather name="x" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                        {record.name}
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Rename campaign"
                        onPress={() => { setRenamingId(record.id); setRenameDraft(record.name); }}
                        style={{ padding: 7 }}
                      >
                        <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                    {[
                      ['Characters', counts.characters],
                      ['Custom NPCs', counts.npcs],
                      ['Equipment', counts.equipment],
                    ].map(([label, count]) => (
                      <View key={label} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: colors.radius, backgroundColor: colors.secondary }}>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.35 }}>
                          {label} {count}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.7 }}>
                      Description
                    </Text>
                    <TextInput
                      accessibilityLabel="Description"
                      testID={`campaign-description-${record.id}`}
                      value={draft ?? record.description}
                      onChangeText={text => setDescriptionDrafts(current => ({ ...current, [record.id]: text }))}
                      placeholder="Add a campaign description"
                      multiline
                      maxLength={500}
                      textAlignVertical="top"
                      style={{ minHeight: 58, padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background, fontFamily: 'Inter_400Regular', fontSize: 12 }}
                    />
                    {descriptionChanged && (
                      <TouchableOpacity accessibilityRole="button" onPress={() => void commitDescription(record)} style={{ alignSelf: 'flex-end', paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                          Save description
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    <ActionButton icon="folder" label="Load" onPress={() => loadCampaign(record)} disabled={!loaded || busy} testID={`load-campaign-${record.id}`} />
                    <ActionButton icon="download" label="Export" onPress={() => void exportSavedCampaign(record)} disabled={busy} testID={`export-campaign-${record.id}`} />
                    <ActionButton icon="trash-2" label="Delete" onPress={() => confirmDelete(record)} disabled={busy} destructive testID={`delete-campaign-${record.id}`} />
                  </View>
                </View>
              );
            })
          )}
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}
