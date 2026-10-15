import React, { useState } from 'react';
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
import CampaignOptionsModal from '@/components/CampaignOptionsModal';
import QuickRulesReference from '@/components/ManualQuickRulesReference';
import type { Armor, Character, Weapon } from '@/context/types';
import {
  CampaignStateSnapshot,
  PortablePortraitAsset,
  createCampaignBundle,
  createCharacterBundle,
  createEquipmentBundle,
  parseCampaignFile,
  parseIndividualFile,
  parsePortraitDataUri,
  portraitAsset,
  portraitDataUri,
  restoreCampaignPortraits,
  restoreCharacterPortrait,
} from '@/data/portableExports';

function defaultExportName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `fallout-campaign-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sanitizeFilename(name: string) {
  const trimmed = name.trim().replace(/\.json$/i, '');
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
  const base = cleaned.length > 0 ? cleaned : defaultExportName();
  return `${base}.json`;
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

async function collectPortraitAssets(characters: readonly Character[]) {
  const results = await Promise.all(characters.map(readPortrait));
  return {
    assets: results.filter((asset): asset is PortablePortraitAsset => !!asset),
    failed: characters.filter(character => character.portrait).length
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
      const safeId = asset.characterId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
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
    characters,
    customWeapons,
    customArmor,
    allWeapons,
    allArmor,
    addCharacter,
    updateCharacter,
    addCustomWeapon,
    updateCustomWeapon,
    addCustomArmor,
    updateCustomArmor,
    exportCampaign,
    importCampaign,
  } = useApp();
  const [importJson, setImportJson] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCampaignOptions, setShowCampaignOptions] = useState(false);
  const [exportName, setExportName] = useState(defaultExportName());
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{
    title: string;
    message: string;
    resolve: (choice: 'replace' | 'keep' | 'cancel') => void;
  } | null>(null);

  const pcs = characters.filter(c => c.type === 'pc');
  const npcs = characters.filter(c => c.type === 'npc');

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const requestConflictChoice = (title: string, message: string) =>
    new Promise<'replace' | 'keep' | 'cancel'>(resolve => {
      setConflictPrompt({ title, message, resolve });
    });

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
      const portraits = await collectPortraitAssets(state.characters);
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

      const ok = importCampaign(JSON.stringify(state));
      if (!ok) {
        importSession?.cleanup();
        showStatus('error', 'The campaign data could not be loaded.');
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
      const filename = sanitizeFilename(`fallout-character-${character.name}`);
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

  const handleReset = () => {
    const doReset = () => {
      importCampaign(JSON.stringify({ characters: [], customWeapons: [], customArmor: [] }));
      showStatus('success', 'Campaign cleared.');
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>CAMPAIGN</Text>
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
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 20 }}>
          Save and load campaign state as portable JSON
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

        {/* Summary */}
        <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 12 }}>CAMPAIGN SUMMARY</Text>
          {[
            { label: 'Player Characters', value: pcs.length, icon: 'user' as const },
            { label: 'NPCs / Enemies', value: npcs.length, icon: 'user-x' as const },
            { label: 'Custom Weapons', value: customWeapons.length, icon: 'crosshair' as const },
            { label: 'Custom Armor', value: customArmor.length, icon: 'shield' as const },
          ].map(stat => (
            <View key={stat.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Feather name={stat.icon} size={16} color={colors.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{stat.label}</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.primary }}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={{ gap: 12 }}>
          {/* Export filename */}
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 8 }}>EXPORT FILE NAME</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
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
                placeholder={defaultExportName()}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.mutedForeground, marginLeft: 8 }}>.json</Text>
            </View>
          </View>

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
            onPress={handleExport}
            disabled={busyAction !== null}
          >
            <Feather name="download" size={22} color={colors.primaryForeground} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>{busyAction === 'campaign' ? 'PREPARING CAMPAIGN…' : 'EXPORT CAMPAIGN'}</Text>
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

          {/* Individual portable files */}
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
            <View style={{ gap: 3 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>INDIVIDUAL EXPORTS</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                Save or share one character or custom equipment item.
              </Text>
            </View>

            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>CHARACTERS</Text>
            {characters.length === 0 ? (
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>No characters to export.</Text>
            ) : characters.map(character => {
              const busy = busyAction === `character:${character.id}`;
              return (
                <View key={character.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{character.name}</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{character.type.toUpperCase()} · portrait and linked custom gear included</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel={`Export ${character.name}`}
                    onPress={() => exportCharacter(character)}
                    disabled={busyAction !== null}
                    style={{ padding: 7, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '66', backgroundColor: colors.secondary }}
                  >
                    <Feather name={busy ? 'clock' : 'download'} size={15} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              );
            })}

            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1, marginTop: 4 }}>CUSTOM EQUIPMENT</Text>
            {customWeapons.length === 0 && customArmor.length === 0 ? (
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>No custom equipment to export.</Text>
            ) : (
              <>
                {customWeapons.map(weapon => {
                  const busy = busyAction === `weapon:${weapon.id}`;
                  return (
                    <View key={`weapon:${weapon.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{weapon.name}</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>CUSTOM WEAPON</Text>
                      </View>
                      <TouchableOpacity accessibilityLabel={`Export ${weapon.name}`} onPress={() => exportEquipment('weapon', weapon)} disabled={busyAction !== null} style={{ padding: 7, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '66', backgroundColor: colors.secondary }}>
                        <Feather name={busy ? 'clock' : 'download'} size={15} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {customArmor.map(armor => {
                  const busy = busyAction === `armor:${armor.id}`;
                  return (
                    <View key={`armor:${armor.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{armor.name}</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>CUSTOM ARMOR</Text>
                      </View>
                      <TouchableOpacity accessibilityLabel={`Export ${armor.name}`} onPress={() => exportEquipment('armor', armor)} disabled={busyAction !== null} style={{ padding: 7, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '66', backgroundColor: colors.secondary }}>
                        <Feather name={busy ? 'clock' : 'download'} size={15} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}
          </View>

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
