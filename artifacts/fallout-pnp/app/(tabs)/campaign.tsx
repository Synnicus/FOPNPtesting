import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

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

export default function CampaignScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { characters, customWeapons, customArmor, exportCampaign, importCampaign } = useApp();
  const [importing, setImporting] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportName, setExportName] = useState(defaultExportName());

  const pcs = characters.filter(c => c.type === 'pc');
  const npcs = characters.filter(c => c.type === 'npc');

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleExport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const json = exportCampaign();
    const filename = sanitizeFilename(exportName);

    if (Platform.OS === 'web') {
      webDownload(json, filename);
      showStatus('success', `Saved to your browser's Downloads folder as ${filename}.`);
      return;
    }

    try {
      const file = new File(Paths.document, filename);
      if (file.exists) {
        file.delete();
      }
      file.create();
      file.write(json);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
        showStatus('success', `Saved to ${file.uri}`);
      } else {
        showStatus('success', `Saved to ${file.uri}`);
      }
    } catch (e) {
      showStatus('error', 'Export failed. Try again.');
    }
  };

  const handleImportFile = async () => {
    setShowImportModal(true);
  };

  const handleImportText = () => {
    const ok = importCampaign(importJson.trim());
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showStatus('success', 'Campaign loaded successfully.');
      setShowImportModal(false);
      setImportJson('');
    } else {
      showStatus('error', 'Invalid campaign JSON. Check the format and try again.');
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
        <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2, marginBottom: 4 }}>CAMPAIGN</Text>
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
          >
            <Feather name="download" size={22} color={colors.primaryForeground} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>EXPORT CAMPAIGN</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.primaryForeground + 'cc', marginTop: 2 }}>
                Save all characters & custom equipment as a JSON file
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
          >
            <Feather name="upload" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>LOAD CAMPAIGN</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                {Platform.OS === 'web' ? 'Paste exported JSON to restore campaign' : 'Pick a campaign JSON file to restore'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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

        {/* Rules summary */}
        <View style={{ marginTop: 24, backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 12 }}>QUICK RULES REFERENCE</Text>
          {[
            { title: 'Attack Check', body: 'Roll 2d10 + Skill. Hit if total >= Evasion.' },
            { title: 'Critical Points', body: 'Each 5 points over Evasion = 1 CP earned per hit.' },
            { title: 'CP Spending', body: 'Each CP spent adds 1 roll of the half-die as bonus damage (e.g. 1d8 → 1d4).' },
            { title: 'Burst Fire', body: 'Shot 1: +0 penalty. Shot 2: –5 penalty. Shot 3+: –10 penalty.' },
            { title: 'DT Mitigation', body: 'Body armor + helmet DTs are combined and subtracted from raw damage per hit.' },
          ].map((rule, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>{rule.title}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, marginTop: 2, lineHeight: 18 }}>{rule.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Import JSON Paste Modal (web + native fallback) */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>PASTE CAMPAIGN JSON</Text>
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
              placeholder="Paste exported campaign JSON here..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <TouchableOpacity
              style={{ backgroundColor: importJson.trim() ? colors.primary : colors.secondary, borderRadius: colors.radius, paddingVertical: 14, alignItems: 'center', marginTop: 12, marginBottom: 8 }}
              disabled={!importJson.trim()}
              onPress={handleImportText}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: importJson.trim() ? colors.primaryForeground : colors.mutedForeground, letterSpacing: 1 }}>
                LOAD CAMPAIGN
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({});
