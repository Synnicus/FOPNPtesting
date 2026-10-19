import React, { useState } from 'react';
import { router } from 'expo-router';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import CampaignLibraryModal from '@/components/CampaignLibraryModal';
import CampaignOptionsModal from '@/components/CampaignOptionsModal';
import CampaignToolsPanel from '@/components/CampaignToolsPanel';
import QuickRulesReference from '@/components/ManualQuickRulesReference';
import type { Armor, Character, VehicleProfile, Weapon } from '@/context/types';
import {
  CampaignStateSnapshot,
  PortablePortraitAsset,
  createCampaignBundle,
  createCharacterBundle,
  createEquipmentBundle,
  createVehicleBundle,
  parseCampaignFile,
  parseIndividualFile,
  parsePortraitDataUri,
  portraitAsset,
  portraitDataUri,
  vehiclePortraitAsset,
  restoreCampaignPortraits,
  restoreCharacterPortrait,
  restoreVehiclePortrait,
} from '@/data/portableExports';

function defaultExportName(campaignName: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stem = campaignName.trim()
    .replace(/\.json$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'My-Campaign';
  return `${stem}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sanitizeFilename(name: string) {
  const trimmed = name.trim().replace(/\.json$/i, '');
  const cleaned = trimmed
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, '-');
  const base = cleaned.length > 0 ? cleaned : defaultExportName('My Campaign');
  return `${base}.json`;
}

type CampaignExportCategory = 'players' | 'npcs' | 'weapons' | 'armor' | 'vehicles';

function IndividualExportRow({ name, detail, busy, disabled, onExport }: {
  name: string;
  detail: string;
  busy: boolean;
  disabled: boolean;
  onExport: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{name}</Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{detail}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Export ${name}`}
        onPress={onExport}
        disabled={disabled}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '66', backgroundColor: colors.secondary, opacity: disabled ? 0.5 : 1 }}
      >
        <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>JSON</Text>
        <Feather name={busy ? 'clock' : 'download'} size={15} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function webDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

async function readPortrait(character: Character): Promise<PortablePortraitAsset | null> {
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
    return portraitAsset(
      character.id,
      mimeTypeForUri(character.portrait, file.type),
      await file.base64(),
    );
  } catch {
    return null;
  }
}

async function readVehiclePortrait(vehicle: VehicleProfile): Promise<PortablePortraitAsset | null> {
  if (!vehicle.portrait) return null;
  const embedded = parsePortraitDataUri(vehicle.portrait);
  if (embedded) return vehiclePortraitAsset(vehicle.id, embedded.mimeType, embedded.base64);

  try {
    if (Platform.OS === 'web') {
      const response = await fetch(vehicle.portrait);
      if (!response.ok) return null;
      const blob = await response.blob();
      return vehiclePortraitAsset(
        vehicle.id,
        mimeTypeForUri(vehicle.portrait, blob.type),
        arrayBufferToBase64(await blob.arrayBuffer()),
      );
    }

    const file = new ExpoFile(vehicle.portrait);
    if (!file.exists) return null;
    return vehiclePortraitAsset(
      vehicle.id,
      mimeTypeForUri(vehicle.portrait, file.type),
      await file.base64(),
    );
  } catch {
    return null;
  }
}

async function collectPortraitAssets(characters: readonly Character[], vehicles: readonly VehicleProfile[] = []) {
  const results = await Promise.all([
    ...characters.map(readPortrait),
    ...vehicles.map(readVehiclePortrait),
  ]);
  return {
    assets: results.filter((asset): asset is PortablePortraitAsset => !!asset),
    failed: characters.filter(character => character.portrait).length
      + vehicles.filter(vehicle => vehicle.portrait).length
      - results.filter(Boolean).length,
  };
}

function portraitExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function createPortraitImportSession(): {
  materialize: (asset: PortablePortraitAsset) => Promise<string>;
  cleanup: () => void;
} {
  if (Platform.OS === 'web') {
    return {
      materialize: async asset => portraitDataUri(asset),
      cleanup: () => {},
    };
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

export default function CampaignScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    campaignName,
    characters,
    customWeapons,
    customArmor,
    customVehicles,
    lootTables,
    encounterTables,
    campaignMaps,
    saveCampaignTools,
    allVehicles,
    allWeapons,
    allArmor,
    addCharacter,
    updateCharacter,
    addCustomWeapon,
    updateCustomWeapon,
    addCustomArmor,
    updateCustomArmor,
    addCustomVehicle,
    updateCustomVehicle,
    exportCampaign,
    importCampaign,
  } = useApp();
  const [importJson, setImportJson] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCampaignOptions, setShowCampaignOptions] = useState(false);
  const [showCampaignLibrary, setShowCampaignLibrary] = useState(false);
  const [showCampaignToolChest, setShowCampaignToolChest] = useState(false);
  const [expandedExportCategory, setExpandedExportCategory] = useState<CampaignExportCategory | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportName, setExportName] = useState(defaultExportName(campaignName));
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{
    title: string;
    message: string;
    resolve: (choice: 'replace' | 'keep' | 'cancel') => void;
  } | null>(null);

  const pcs = characters.filter(c => c.type === 'pc' && !c.vehicle);
  const vehicleCharacters = characters.filter(c => !!c.vehicle);
  const npcs = characters.filter(c => c.type === 'npc' && !c.vehicle);

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const requestConflictChoice = (title: string, message: string) =>
    new Promise<'replace' | 'keep' | 'cancel'>(resolve => {
      setConflictPrompt({ title, message, resolve });
    });

  const openExportModal = () => {
    setExportName(defaultExportName(campaignName));
    setShowExportModal(true);
  };

  const settleConflictPrompt = (choice: 'replace' | 'keep' | 'cancel') => {
    const resolve = conflictPrompt?.resolve;
    setConflictPrompt(null);
    resolve?.(choice);
  };

  const saveJsonFile = async (json: string, filename: string): Promise<string> => {
    if (Platform.OS === 'web') {
      webDownload(json, filename);
      return `Saved to Downloads as ${filename}.`;
    }

    const file = new ExpoFile(Paths.document, filename);
    file.create({ intermediates: true, overwrite: true });
    file.write(json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    }
    return `Saved to ${file.uri}`;
  };

  const handleExport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyAction('campaign');
    try {
      const state = JSON.parse(exportCampaign()) as CampaignStateSnapshot;
      const portraits = await collectPortraitAssets(state.characters, state.customVehicles ?? []);
      const bundle = createCampaignBundle(state, portraits.assets);
      const filename = sanitizeFilename(exportName);
      const saved = await saveJsonFile(JSON.stringify(bundle, null, 2), filename);
      const omittedPortraits = portraits.failed + portraits.assets.length - bundle.assets.length;
      const portraitNote = bundle.assets.length > 0
        ? ` Included ${bundle.assets.length} portrait${bundle.assets.length === 1 ? '' : 's'}.`
        : '';
      const warning = omittedPortraits > 0
        ? ` ${omittedPortraits} portrait${omittedPortraits === 1 ? '' : 's'} could not be included.`
        : '';
      showStatus('success', `${saved}${portraitNote}${warning}`);
    } catch {
      showStatus('error', 'Campaign export failed. Try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const importCampaignJson = async (json: string) => {
    const parsed = parseCampaignFile(json.trim());
    if (!parsed.ok) {
      showStatus('error', parsed.error);
      return;
    }
    setBusyAction('import');
    let importSession: ReturnType<typeof createPortraitImportSession> | null = null;
    try {
      let state: CampaignStateSnapshot;
      let restored = 0;
      let failed = 0;
      let ignored = 0;
      if (parsed.source === 'portable') {
        importSession = createPortraitImportSession();
        const result = await restoreCampaignPortraits(parsed.bundle, importSession.materialize);
        state = result.state;
        restored = result.restored;
        failed = result.failed;
        ignored = parsed.ignoredAssets;
      } else {
        state = parsed.state;
      }

      const ok = await importCampaign(JSON.stringify(state));
      if (!ok) {
        importSession?.cleanup();
        showStatus('error', 'Campaign could not be loaded. Your current campaign was kept.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const portraitNote = restored > 0
        ? ` Restored ${restored} portrait${restored === 1 ? '' : 's'}.`
        : '';
      const warning = failed > 0
        ? ` ${failed} portrait${failed === 1 ? '' : 's'} could not be restored.`
        : '';
      const ignoredNote = ignored > 0
        ? ` Ignored ${ignored} invalid portrait asset${ignored === 1 ? '' : 's'}.`
        : '';
      showStatus('success', `Campaign loaded successfully.${portraitNote}${warning}${ignoredNote}`);
      setShowImportModal(false);
      setImportJson('');
    } catch {
      importSession?.cleanup();
      showStatus('error', 'The campaign file could not be restored safely.');
    } finally {
      setBusyAction(null);
    }
  };

  const importIndividualJson = async (
    parsed: Extract<ReturnType<typeof parseIndividualFile>, { ok: true }>,
  ) => {
    if (parsed.kind === 'vehicle') {
      const vehicle = parsed.bundle.vehicle;
      if (allVehicles.some(existing => existing.id === vehicle.id && !existing.isCustom)) {
        showStatus('error', `${vehicle.name} uses an ID reserved by a built-in vehicle and cannot be imported.`);
        return;
      }

      const existing = customVehicles.find(candidate => candidate.id === vehicle.id);
      let choice: 'replace' | 'keep' | 'cancel' = 'replace';
      if (existing) {
        choice = await requestConflictChoice(
          'Vehicle ID already exists',
          `"${vehicle.name}" has the same ID as "${existing.name}". Replace the existing vehicle or keep it unchanged?`,
        );
      }
      if (choice === 'cancel') return;
      if (choice === 'keep') {
        showStatus('success', `Kept the existing vehicle. No changes were made.`);
        return;
      }

      setBusyAction('import');
      let importSession: ReturnType<typeof createPortraitImportSession> | null = null;
      try {
        let importedVehicle = vehicle;
        let restored = 0;
        let failed = 0;
        if (parsed.bundle.assets.length > 0) {
          importSession = createPortraitImportSession();
          const result = await restoreVehiclePortrait(parsed.bundle, importSession.materialize);
          importedVehicle = result.vehicle;
          restored = result.restored;
          failed = result.failed;
          if (failed > 0) importSession.cleanup();
        }

        if (existing) updateCustomVehicle(importedVehicle);
        else addCustomVehicle(importedVehicle);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const pictureNote = restored > 0
          ? ' Picture restored.'
          : failed > 0
            ? ' Picture could not be restored.'
            : '';
        const ignoredNote = parsed.ignoredAssets > 0
          ? ` Ignored ${parsed.ignoredAssets} invalid picture asset${parsed.ignoredAssets === 1 ? '' : 's'}.`
          : '';
        showStatus('success', `${vehicle.name} was imported as a custom vehicle.${pictureNote}${ignoredNote}`);
        setShowImportModal(false);
        setImportJson('');
      } catch {
        importSession?.cleanup();
        showStatus('error', `Could not import ${vehicle.name}.`);
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (parsed.kind === 'equipment') {
      const { equipmentType, item } = parsed.bundle;
      const builtInConflict = equipmentType === 'weapon'
        ? allWeapons.some(existing => existing.id === item.id && !existing.isCustom)
        : allArmor.some(existing => existing.id === item.id && !existing.isCustom);
      if (builtInConflict) {
        showStatus('error', `${item.name} uses an ID reserved by built-in equipment and cannot be imported.`);
        return;
      }

      const existing = equipmentType === 'weapon'
        ? customWeapons.find(candidate => candidate.id === item.id)
        : customArmor.find(candidate => candidate.id === item.id);
      let choice: 'replace' | 'keep' | 'cancel' = 'replace';
      if (existing) {
        choice = await requestConflictChoice(
          'Equipment ID already exists',
          `"${item.name}" has the same ID as "${existing.name}". Replace the existing item or keep it unchanged?`,
        );
      }
      if (choice === 'cancel') return;
      if (choice === 'keep') {
        showStatus('success', `Kept the existing ${equipmentType}. No changes were made.`);
        return;
      }

      setBusyAction('import');
      try {
        if (equipmentType === 'weapon') {
          const weapon = item as Weapon;
          if (existing) updateCustomWeapon(weapon);
          else addCustomWeapon(weapon);
        } else {
          const armor = item as Armor;
          if (existing) updateCustomArmor(armor);
          else addCustomArmor(armor);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showStatus('success', `${item.name} was imported as custom ${equipmentType}.`);
        setShowImportModal(false);
        setImportJson('');
      } catch {
        showStatus('error', `Could not import ${item.name}.`);
      } finally {
        setBusyAction(null);
      }
      return;
    }

    const { bundle, ignoredAssets } = parsed;
    const builtInWeaponConflicts = bundle.customWeapons.filter(item =>
      allWeapons.some(existing => existing.id === item.id && !existing.isCustom));
    const builtInArmorConflicts = bundle.customArmor.filter(item =>
      allArmor.some(existing => existing.id === item.id && !existing.isCustom));
    if (builtInWeaponConflicts.length > 0 || builtInArmorConflicts.length > 0) {
      const names = [...builtInWeaponConflicts, ...builtInArmorConflicts]
        .map(item => item.name)
        .join(', ');
      showStatus('error', `Cannot import because linked equipment uses built-in IDs: ${names}.`);
      return;
    }

    const characterExists = characters.some(existing => existing.id === bundle.character.id);
    const weaponConflicts = bundle.customWeapons.filter(item =>
      customWeapons.some(existing => existing.id === item.id));
    const armorConflicts = bundle.customArmor.filter(item =>
      customArmor.some(existing => existing.id === item.id));
    const conflicts = [
      ...(characterExists ? [`character "${bundle.character.name}"`] : []),
      ...weaponConflicts.map(item => `weapon "${item.name}"`),
      ...armorConflicts.map(item => `armor "${item.name}"`),
    ];
    let choice: 'replace' | 'keep' | 'cancel' = 'replace';
    if (conflicts.length > 0) {
      choice = await requestConflictChoice(
        'Imported IDs already exist',
        `${conflicts.join(', ')} ${conflicts.length === 1 ? 'has' : 'have'} matching IDs. Replace matching records or keep the current versions? New records will still be added.`,
      );
    }
    if (choice === 'cancel') return;

    const willImportCharacter = !characterExists || choice === 'replace';
    setBusyAction('import');
    let importSession: ReturnType<typeof createPortraitImportSession> | null = null;
    try {
      let importedCharacter = bundle.character;
      let restored = 0;
      let failed = 0;
      if (willImportCharacter && bundle.assets.length > 0) {
        importSession = createPortraitImportSession();
        const portraitResult = await restoreCharacterPortrait(bundle, importSession.materialize);
        importedCharacter = portraitResult.character;
        restored = portraitResult.restored;
        failed = portraitResult.failed;
        if (failed > 0) importSession.cleanup();
      }

      for (const weapon of bundle.customWeapons) {
        const exists = customWeapons.some(existing => existing.id === weapon.id);
        if (exists && choice === 'replace') updateCustomWeapon(weapon);
        else if (!exists) addCustomWeapon(weapon);
      }
      for (const armor of bundle.customArmor) {
        const exists = customArmor.some(existing => existing.id === armor.id);
        if (exists && choice === 'replace') updateCustomArmor(armor);
        else if (!exists) addCustomArmor(armor);
      }
      if (willImportCharacter) {
        if (characterExists) updateCharacter(importedCharacter);
        else addCharacter(importedCharacter);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const characterNote = willImportCharacter
        ? `${bundle.character.name} was imported.`
        : `Kept the existing ${bundle.character.name}.`;
      const equipmentAdded = bundle.customWeapons.length + bundle.customArmor.length;
      const equipmentNote = equipmentAdded > 0
        ? ` Processed ${equipmentAdded} linked custom equipment item${equipmentAdded === 1 ? '' : 's'}.`
        : '';
      const portraitNote = restored > 0
        ? ' Portrait restored.'
        : failed > 0
          ? ' Portrait could not be restored.'
          : '';
      const ignoredNote = ignoredAssets > 0
        ? ` Ignored ${ignoredAssets} invalid portrait asset${ignoredAssets === 1 ? '' : 's'}.`
        : '';
      showStatus('success', `${characterNote}${equipmentNote}${portraitNote}${ignoredNote}`);
      setShowImportModal(false);
      setImportJson('');
    } catch {
      importSession?.cleanup();
      showStatus('error', `Could not import ${bundle.character.name}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const importJsonFile = async (json: string) => {
    const trimmed = json.trim();
    const campaign = parseCampaignFile(trimmed);
    if (campaign.ok) {
      await importCampaignJson(trimmed);
      return;
    }
    const individual = parseIndividualFile(trimmed);
    if (individual.ok) {
      await importIndividualJson(individual);
      return;
    }
    const error = campaign.error.includes('individual asset file')
      ? individual.error
      : campaign.error;
    showStatus('error', error);
  };

  const handleImportFile = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
          try {
            const file = input.files?.[0];
            if (file) await importJsonFile(await file.text());
          } catch {
            showStatus('error', 'The JSON file could not be opened.');
          }
        };
        input.click();
        return;
      }
      const picked = await ExpoFile.pickFileAsync(undefined, 'application/json');
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (file) await importJsonFile(await file.text());
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      showStatus('error', 'The JSON file could not be opened.');
    }
  };

  const handleImportText = async () => importJsonFile(importJson);

  const exportCharacter = async (character: Character) => {
    setBusyAction(`character:${character.id}`);
    try {
      const asset = await readPortrait(character);
      const bundle = createCharacterBundle(character, customWeapons, customArmor, asset);
      const filename = sanitizeFilename(`${character.vehicle ? 'fallout-vehicle' : 'fallout-character'}-${character.name}`);
      const saved = await saveJsonFile(JSON.stringify(bundle, null, 2), filename);
      const dependencyCount = bundle.customWeapons.length + bundle.customArmor.length;
      const portraitNote = asset
        ? ' Portrait included.'
        : character.portrait
          ? ' Portrait could not be read and was omitted.'
          : '';
      showStatus('success', `${saved}${portraitNote}${dependencyCount > 0 ? ` Included ${dependencyCount} custom equipment item${dependencyCount === 1 ? '' : 's'}.` : ''}`);
    } catch {
      showStatus('error', `Could not export ${character.name}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const exportEquipment = async (equipmentType: 'weapon' | 'armor', item: Weapon | Armor) => {
    setBusyAction(`${equipmentType}:${item.id}`);
    try {
      const bundle = createEquipmentBundle(equipmentType, item);
      const filename = sanitizeFilename(`fallout-${equipmentType}-${item.name}`);
      const saved = await saveJsonFile(JSON.stringify(bundle, null, 2), filename);
      showStatus('success', saved);
    } catch {
      showStatus('error', `Could not export ${item.name}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const exportVehicle = async (vehicle: VehicleProfile) => {
    setBusyAction(`vehicle:${vehicle.id}`);
    try {
      const portrait = await readVehiclePortrait(vehicle);
      const asset = portrait?.kind === 'vehicle-portrait' ? portrait : null;
      const bundle = createVehicleBundle(vehicle, asset);
      const filename = sanitizeFilename(`fallout-vehicle-${vehicle.name}`);
      const saved = await saveJsonFile(JSON.stringify(bundle, null, 2), filename);
      const portraitNote = asset ? ' Picture included.' : vehicle.portrait ? ' Picture could not be read and was omitted.' : '';
      showStatus('success', `${saved}${portraitNote}`);
    } catch {
      showStatus('error', `Could not export ${vehicle.name}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReset = () => {
    const doReset = async () => {
      const saved = await importCampaign(JSON.stringify({ characters: [], customWeapons: [], customArmor: [] }));
      if (saved) showStatus('success', 'Campaign cleared.');
      else showStatus('error', 'Campaign could not be cleared. Your current campaign was kept.');
    };
    if (Platform.OS === 'web') {
      if (confirm('Clear all campaign data? This cannot be undone.')) doReset();
    } else {
      Alert.alert('Clear Campaign', 'This will remove all characters and custom equipment. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: doReset },
      ]);
    }
  };

  const renderEmptyExportCategory = (message: string) => (
    <Text style={{ paddingVertical: 8, fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
      {message}
    </Text>
  );

  const renderCategoryExports = (category: CampaignExportCategory) => {
    if (category === 'players') {
      return pcs.length === 0
        ? renderEmptyExportCategory('No player characters to export.')
        : pcs.map(character => (
          <IndividualExportRow
            key={character.id}
            name={character.name}
            detail={`${character.inStorage ? 'IN STORAGE · ' : ''}portrait and linked custom gear included`}
            busy={busyAction === `character:${character.id}`}
            disabled={busyAction !== null}
            onExport={() => void exportCharacter(character)}
          />
        ));
    }
    if (category === 'npcs') {
      return npcs.length === 0
        ? renderEmptyExportCategory('No NPCs or enemies to export.')
        : npcs.map(character => (
          <IndividualExportRow
            key={character.id}
            name={character.name}
            detail={`${character.inStorage ? 'IN STORAGE · ' : ''}NPC · portrait and linked custom gear included`}
            busy={busyAction === `character:${character.id}`}
            disabled={busyAction !== null}
            onExport={() => void exportCharacter(character)}
          />
        ));
    }
    if (category === 'weapons') {
      return customWeapons.length === 0
        ? renderEmptyExportCategory('No custom weapons to export.')
        : customWeapons.map(weapon => (
          <IndividualExportRow
            key={weapon.id}
            name={weapon.name}
            detail="CUSTOM WEAPON"
            busy={busyAction === `weapon:${weapon.id}`}
            disabled={busyAction !== null}
            onExport={() => void exportEquipment('weapon', weapon)}
          />
        ));
    }
    if (category === 'armor') {
      return customArmor.length === 0
        ? renderEmptyExportCategory('No custom armor to export.')
        : customArmor.map(armor => (
          <IndividualExportRow
            key={armor.id}
            name={armor.name}
            detail="CUSTOM ARMOR"
            busy={busyAction === `armor:${armor.id}`}
            disabled={busyAction !== null}
            onExport={() => void exportEquipment('armor', armor)}
          />
        ));
    }

    if (customVehicles.length === 0 && vehicleCharacters.length === 0) {
      return renderEmptyExportCategory('No vehicles to export.');
    }
    return (
      <View>
        {customVehicles.length > 0 && (
          <>
            <Text style={{ paddingTop: 6, fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>CUSTOM VEHICLE PROFILES</Text>
            {customVehicles.map(vehicle => (
              <IndividualExportRow
                key={`profile:${vehicle.id}`}
                name={vehicle.name}
                detail={`${vehicle.category.toUpperCase()} · editable vehicle profile${vehicle.portrait ? ' · picture included' : ''}`}
                busy={busyAction === `vehicle:${vehicle.id}`}
                disabled={busyAction !== null}
                onExport={() => void exportVehicle(vehicle)}
              />
            ))}
          </>
        )}
        {vehicleCharacters.length > 0 && (
          <>
            <Text style={{ paddingTop: 10, fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>VEHICLES IN CAMPAIGN</Text>
            {vehicleCharacters.map(character => {
              const structure = character.vehicle?.systems.find(system => system.kind === 'structure');
              return (
                <IndividualExportRow
                  key={`campaign:${character.id}`}
                  name={character.name}
                  detail={`CAMPAIGN VEHICLE · structure ${character.currentHp}/${character.maxHp}${structure ? ` · ${structure.currentHp}/${structure.maxHp} HP` : ''}`}
                  busy={busyAction === `character:${character.id}`}
                  disabled={busyAction !== null}
                  onExport={() => void exportCharacter(character)}
                />
              );
            })}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>CAMPAIGN</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Main Menu"
              testID="campaign-main-menu-button"
              onPress={() => router.replace('/main-menu')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}
            >
              <Feather name="home" size={14} color={colors.primary} />
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                Main Menu
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Campaign options"
              testID="campaign-options-button"
              onPress={() => setShowCampaignOptions(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}
            >
              <Feather name="settings" size={15} color={colors.primary} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>OPTIONS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Save Campaign"
              testID="campaign-save-button"
              onPress={() => setShowCampaignLibrary(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}
            >
              <Feather name="save" size={14} color={colors.primary} />
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                Save Campaign
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 20 }}>
          Manage campaign assets, save/load campaigns, and use campaign tools.
        </Text>

        {/* Status */}
        {status && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            borderRadius: colors.radius,
            borderWidth: 1,
            backgroundColor: status.type === 'success' ? '#4a8c3f22' : colors.destructive + '22',
            borderColor: status.type === 'success' ? '#4a8c3f' : colors.destructive,
            marginBottom: 16,
          }}>
            <Feather
              name={status.type === 'success' ? 'check-circle' : 'alert-circle'}
              size={18}
              color={status.type === 'success' ? '#4a8c3f' : colors.destructive}
            />
            <Text style={{ color: status.type === 'success' ? '#4a8c3f' : colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 }}>
              {status.message}
            </Text>
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open Campaign Tool Chest"
          testID="campaign-tool-chest-open"
          onPress={() => setShowCampaignToolChest(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            padding: 14,
            marginBottom: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.primary + '77',
            borderRadius: colors.radius,
          }}
        >
          <Feather name="briefcase" size={17} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1 }}>
            CAMPAIGN TOOL CHEST
          </Text>
        </TouchableOpacity>
        <CampaignToolsPanel
          visible={showCampaignToolChest}
          onClose={() => setShowCampaignToolChest(false)}
          lootTables={lootTables}
          encounterTables={encounterTables}
          campaignMaps={campaignMaps}
          characters={characters}
          onChange={saveCampaignTools}
        />
        {/* Campaign asset summary and individual JSON exports */}
        <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 4 }}>CAMPAIGN ASSETS</Text>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 10 }}>
            Tap a category to see its records and download individual JSON files.
          </Text>
          {([
            { id: 'players', label: 'Player Characters', value: pcs.length, icon: 'user' },
            { id: 'npcs', label: 'NPCs / Enemies', value: npcs.length, icon: 'user-x' },
            { id: 'weapons', label: 'Custom Weapons', value: customWeapons.length, icon: 'crosshair' },
            { id: 'armor', label: 'Custom Armor', value: customArmor.length, icon: 'shield' },
            { id: 'vehicles', label: 'Vehicles', value: customVehicles.length + vehicleCharacters.length, icon: 'truck' },
          ] as const).map((stat, index, list) => {
            const expanded = expandedExportCategory === stat.id;
            return (
              <View key={stat.id} style={{ borderBottomWidth: index < list.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${stat.label}, ${stat.value} items${expanded ? ', expanded' : ', collapsed'}`}
                  testID={`campaign-assets-toggle-${stat.id}`}
                  onPress={() => setExpandedExportCategory(current => current === stat.id ? null : stat.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 7 }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: expanded ? colors.primary + '22' : colors.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Feather name={stat.icon} size={16} color={colors.primary} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{stat.label}</Text>
                  <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.primary, marginRight: 8 }}>{stat.value}</Text>
                  <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
                {expanded && (
                  <View testID={`campaign-assets-content-${stat.id}`} style={{ paddingLeft: 42, paddingBottom: 8 }}>
                    {renderCategoryExports(stat.id)}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Actions */}
        <View style={{ gap: 12 }}>
          {/* Export */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              padding: 16,
              gap: 14,
            }}
            onPress={openExportModal}
            disabled={busyAction !== null}
          >
            <Feather name="download" size={22} color={colors.primaryForeground} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, textTransform: 'uppercase' }}>{busyAction === 'campaign' ? 'PREPARING CAMPAIGN…' : 'Export Campaign'}</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.primaryForeground + 'cc', marginTop: 2 }}>
                Save characters, portraits & custom equipment in one JSON file
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>

          {/* Import */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.secondary,
              borderRadius: colors.radius,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
            }}
            onPress={handleImportFile}
            disabled={busyAction !== null}
          >
            <Feather name="upload" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{busyAction === 'import' ? 'IMPORTING JSON…' : 'LOAD JSON FILE'}</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                Import a campaign, character, custom weapon, or custom armor
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7 }}
            onPress={() => setShowImportModal(true)}
            disabled={busyAction !== null}
          >
            <Feather name="clipboard" size={14} color={colors.primary} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 0.5 }}>PASTE JSON INSTEAD</Text>
          </TouchableOpacity>

          {/* Clear */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.secondary,
              borderRadius: colors.radius,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.destructive + '66',
              gap: 14,
            }}
            onPress={handleReset}
          >
            <Feather name="trash-2" size={22} color={colors.destructive} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.destructive }}>CLEAR CAMPAIGN</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                Remove all characters and custom equipment
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <QuickRulesReference />
      </ScrollView>

      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
        testID="campaign-export-modal"
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <View style={{ width: '100%', maxWidth: 440, backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text accessibilityRole="header" style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1, textTransform: 'uppercase' }}>
                Export Campaign
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => setShowExportModal(false)}
                style={{ padding: 6 }}
              >
                <Feather name="x" size={21} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.5, marginBottom: 8 }}>
              Export file name
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                testID="campaign-export-filename"
                accessibilityLabel="Export file name"
                style={{
                  flex: 1,
                  backgroundColor: colors.input,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 14,
                }}
                value={exportName}
                onChangeText={setExportName}
                placeholder={defaultExportName(campaignName)}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.mutedForeground, marginLeft: 8 }}>.json</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                testID="campaign-export-cancel"
                onPress={() => setShowExportModal(false)}
                style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_700Bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="campaign-export-confirm"
                disabled={busyAction !== null || !exportName.trim()}
                onPress={() => {
                  setShowExportModal(false);
                  void handleExport();
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: colors.radius, backgroundColor: busyAction === null && exportName.trim() ? colors.primary : colors.secondary }}
              >
                <Text style={{ color: busyAction === null && exportName.trim() ? colors.primaryForeground : colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_700Bold' }}>Export Campaign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cross-platform import conflict prompt */}
      <Modal visible={conflictPrompt !== null} transparent animationType="fade" onRequestClose={() => settleConflictPrompt('cancel')}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <View style={{ width: '100%', maxWidth: 440, backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 18 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1, marginBottom: 8 }}>
              {conflictPrompt?.title}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 19, marginBottom: 18 }}>
              {conflictPrompt?.message}
            </Text>
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => settleConflictPrompt('replace')}
                style={{ backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>REPLACE MATCHING</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => settleConflictPrompt('keep')}
                style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>KEEP EXISTING</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => settleConflictPrompt('cancel')} style={{ paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CANCEL IMPORT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CampaignOptionsModal
        visible={showCampaignOptions}
        onClose={() => setShowCampaignOptions(false)}
      />
      <CampaignLibraryModal
        visible={showCampaignLibrary}
        onClose={() => setShowCampaignLibrary(false)}
        onCampaignLoaded={() => setShowCampaignLibrary(false)}
      />

      {/* Import JSON Paste Modal (web + native fallback) */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>PASTE EXPORTED JSON</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <TextInput
              style={{
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: colors.radius,
                padding: 12,
                color: colors.foreground,
                fontFamily: 'Inter_400Regular',
                fontSize: 12,
                height: 160,
                textAlignVertical: 'top',
              }}
              value={importJson}
              onChangeText={setImportJson}
              placeholder="Paste campaign, character, weapon, or armor JSON here..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <TouchableOpacity
              style={{ backgroundColor: importJson.trim() ? colors.primary : colors.secondary, borderRadius: colors.radius, paddingVertical: 14, alignItems: 'center', marginTop: 12, marginBottom: 8 }}
              disabled={!importJson.trim()}
              onPress={handleImportText}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: importJson.trim() ? colors.primaryForeground : colors.mutedForeground, letterSpacing: 1 }}>
                IMPORT JSON
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({});
