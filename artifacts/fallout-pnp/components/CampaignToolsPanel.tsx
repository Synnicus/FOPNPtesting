import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, Share, View } from 'react-native';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { CampaignMap, CampaignTable, Character } from '@/context/types';
import { exportCampaignMap, rollEncounterTable, rollLootTable, type CampaignTableRollResult } from '@/data/campaignTools';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { translateText } from '@/data/localization';
import CampaignMapEditorModal from '@/components/CampaignMapEditorModal';

type ToolTab = 'home' | 'loot' | 'encounters' | 'maps';

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function confirmDestructive(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${translateText(title)}\n\n${translateText(message)}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'CANCEL', style: 'cancel' },
    { text: 'DELETE', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function CampaignToolsPanel({
  visible,
  onClose,
  lootTables,
  encounterTables,
  campaignMaps,
  characters,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  lootTables: CampaignTable[];
  encounterTables: CampaignTable[];
  campaignMaps: CampaignMap[];
  characters: Character[];
  onChange: (value: { lootTables: CampaignTable[]; encounterTables: CampaignTable[]; campaignMaps: CampaignMap[] }) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const modalTopInset = Math.max(insets.top, Platform.OS === 'web' ? 67 : 56);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [lastRolls, setLastRolls] = useState<Record<string, { kind: ToolTab; results: CampaignTableRollResult[] }>>({});
  const [screen, setScreen] = useState<ToolTab>('home');
  const [mapEditorId, setMapEditorId] = useState<string | null>(null);
  const [newMapDraft, setNewMapDraft] = useState<CampaignMap | null>(null);

  useEffect(() => {
    if (!visible) return;
    setActiveTableId(null);
    setEditingTableId(null);
    setMapEditorId(null);
    setNewMapDraft(null);
    setScreen('home');
  }, [visible]);

  const tablesFor = (kind: 'loot' | 'encounters') => kind === 'loot' ? lootTables : encounterTables;
  const updateTable = (kind: 'loot' | 'encounters', changed: CampaignTable) => {
    const list = tablesFor(kind);
    const next = list.map(table => table.id === changed.id ? changed : table);
    onChange({
      lootTables: kind === 'loot' ? next : lootTables,
      encounterTables: kind === 'encounters' ? next : encounterTables,
      campaignMaps,
    });
  };

  const addTable = (kind: 'loot' | 'encounters') => {
    const created: CampaignTable = {
      id: id(),
      name: kind === 'loot' ? 'New Loot Table' : 'New Encounter Table',
      description: '',
      entries: [],
      rollCountMin: 1,
      rollCountMax: 1,
    };
    onChange({
      lootTables: kind === 'loot' ? [...lootTables, created] : lootTables,
      encounterTables: kind === 'encounters' ? [...encounterTables, created] : encounterTables,
      campaignMaps,
    });
    setActiveTableId(created.id);
    setEditingTableId(created.id);
    setScreen(kind);
  };

  const deleteTable = (tableId: string, kind: 'loot' | 'encounters') => {
    const table = tablesFor(kind).find(item => item.id === tableId);
    if (!table) return;
    const remove = () => {
      onChange({
        lootTables: kind === 'loot' ? lootTables.filter(item => item.id !== tableId) : lootTables,
        encounterTables: kind === 'encounters' ? encounterTables.filter(item => item.id !== tableId) : encounterTables,
        campaignMaps,
      });
      if (activeTableId === tableId) setActiveTableId(null);
      if (editingTableId === tableId) setEditingTableId(null);
    };
    confirmDestructive(`Delete ${table.name}?`, 'This table and its entries will be removed from the campaign.', remove);
  };

  const addMap = () => {
    const created: CampaignMap = { id: id(), name: 'New Map', description: '', locations: [], party: [] };
    setNewMapDraft(created);
    setMapEditorId(created.id);
    setScreen('maps');
  };

  const downloadMap = async (map: CampaignMap) => {
    await exportCampaignMap(map, Platform.OS === 'web' && typeof document !== 'undefined' ? 'web' : 'native', {
      download: ({ filename, json }) => {
        const anchor = document.createElement('a');
        const objectUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      },
      share: async ({ filename, json }) => {
        const directory = new Directory(Paths.cache, 'campaign-map-exports');
        directory.create({ idempotent: true, intermediates: true });
        const file = new ExpoFile(directory, filename);
        file.write(json);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
        } else {
          await Share.share({ title: filename, message: json });
        }
      },
    });
  };

  const panelStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radius,
    backgroundColor: colors.card,
    padding: 12,
    gap: 10,
  } as const;
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 9,
    color: colors.foreground,
    backgroundColor: colors.input,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  } as const;
  const buttonStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary + '77',
    borderRadius: 7,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 9,
  };

  const rollTable = (table: CampaignTable, kind: 'loot' | 'encounters') => {
    const results = kind === 'loot' ? rollLootTable(table) : rollEncounterTable(table);
    setLastRolls(current => ({ ...current, [table.id]: { kind, results } }));
    setActiveTableId(table.id);
    setEditingTableId(null);
  };

  const updateEntry = (
    table: CampaignTable,
    kind: 'loot' | 'encounters',
    entryId: string,
    patch: Partial<CampaignTable['entries'][number]>,
  ) => updateTable(kind, {
    ...table,
    entries: table.entries.map(entry => entry.id === entryId ? { ...entry, ...patch } : entry),
  });

  const removeEntry = (table: CampaignTable, kind: 'loot' | 'encounters', entryId: string) => {
    const entry = table.entries.find(item => item.id === entryId);
    if (!entry) return;
    confirmDestructive(`Remove ${translateText(entry.name || 'this entry')}?`, 'This entry will be removed from the table.', () => {
      updateTable(kind, { ...table, entries: table.entries.filter(item => item.id !== entryId) });
    });
  };

  const renderTableEditor = (table: CampaignTable, kind: 'loot' | 'encounters') => (
    <View style={{ gap: 9, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 }}>
      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 }}>
        EDIT TABLE
      </Text>
      <TextInput
        accessibilityLabel="Table name"
        value={table.name}
        onChangeText={name => updateTable(kind, { ...table, name })}
        placeholder="Table name"
        style={inputStyle}
      />
      <TextInput
        accessibilityLabel="Table description"
        value={table.description}
        onChangeText={description => updateTable(kind, { ...table, description })}
        placeholder="Purpose and GM notes"
        style={inputStyle}
      />
      {kind === 'loot' ? (
        <>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 15 }}>
            Each roll draws a random number of items. Entry weights set relative chances; item quantities roll separately.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>MIN ITEM DRAWS</Text>
              <TextInput
                accessibilityLabel="Minimum items per loot roll"
                keyboardType="number-pad"
                value={String(table.rollCountMin ?? 1)}
                onChangeText={value => {
                  const min = Math.min(200, Math.max(1, Number.parseInt(value, 10) || 1));
                  updateTable(kind, {
                    ...table,
                    rollCountMin: min,
                    rollCountMax: Math.max(min, table.rollCountMax ?? min),
                  });
                }}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>MAX ITEM DRAWS</Text>
              <TextInput
                accessibilityLabel="Maximum items per loot roll"
                keyboardType="number-pad"
                value={String(table.rollCountMax ?? 1)}
                onChangeText={value => {
                  const max = Math.min(200, Math.max(table.rollCountMin ?? 1, Number.parseInt(value, 10) || 1));
                  updateTable(kind, { ...table, rollCountMax: max });
                }}
                style={inputStyle}
              />
            </View>
          </View>
        </>
      ) : (
        <Text style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 15 }}>
          Every encounter entry has an equal chance to be selected.
        </Text>
      )}
      {table.entries.map(entry => (
        <View key={entry.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TextInput
              accessibilityLabel="Entry name"
              value={entry.name}
              onChangeText={name => updateEntry(table, kind, entry.id, { name })}
              placeholder="Entry name"
              style={[inputStyle, { flex: 1 }]}
            />
            {kind === 'loot' ? (
              <TextInput
                accessibilityLabel="Entry chance weight"
                keyboardType="number-pad"
                value={String(entry.weight)}
                onChangeText={value => updateEntry(table, kind, entry.id, {
                  weight: Math.min(1_000_000, Math.max(1, Number.parseInt(value, 10) || 1)),
                })}
                style={[inputStyle, { width: 66 }]}
              />
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Remove ${entry.name}`}
              onPress={() => removeEntry(table, kind, entry.id)}
              style={buttonStyle}
            >
              <Feather name="x" size={15} color={colors.destructive} />
            </TouchableOpacity>
          </View>
          {kind === 'loot' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>CHANCE WEIGHT</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Higher = more likely</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>MIN QUANTITY</Text>
                <TextInput
                  accessibilityLabel={`Minimum quantity of ${entry.name}`}
                  keyboardType="number-pad"
                  value={String(entry.quantityMin ?? 1)}
                  onChangeText={value => {
                    const min = Math.min(200, Math.max(1, Number.parseInt(value, 10) || 1));
                    updateEntry(table, kind, entry.id, {
                      quantityMin: min,
                      quantityMax: Math.max(min, entry.quantityMax ?? min),
                    });
                  }}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>MAX QUANTITY</Text>
                <TextInput
                  accessibilityLabel={`Maximum quantity of ${entry.name}`}
                  keyboardType="number-pad"
                  value={String(entry.quantityMax ?? 1)}
                  onChangeText={value => {
                    const max = Math.min(200, Math.max(entry.quantityMin ?? 1, Number.parseInt(value, 10) || 1));
                    updateEntry(table, kind, entry.id, { quantityMax: max });
                  }}
                  style={inputStyle}
                />
              </View>
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="Entry details"
            value={entry.description}
            onChangeText={description => updateEntry(table, kind, entry.id, { description })}
            placeholder="Details, result, or reward"
            style={inputStyle}
          />
        </View>
      ))}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => updateTable(kind, {
          ...table,
          entries: [...table.entries, {
            id: id(),
            name: '',
            description: '',
            weight: 1,
            quantityMin: 1,
            quantityMax: 1,
          }],
        })}
        style={buttonStyle}
      >
        <Feather name="plus" size={15} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold' }}>ADD TABLE ENTRY</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTable = (table: CampaignTable, kind: 'loot' | 'encounters') => {
    const isActive = activeTableId === table.id;
    const isEditing = editingTableId === table.id;
    const roll = lastRolls[table.id];
    return (
      <View key={table.id} style={panelStyle} testID={`campaign-table-${table.id}`}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: isActive }}
          disabled={isEditing}
          onPress={() => {
            setActiveTableId(isActive ? null : table.id);
            if (isActive) setEditingTableId(null);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
              {table.name || 'Untitled table'}
            </Text>
            <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 14 }}>
              {table.description || `${table.entries.length} entries`}
            </Text>
          </View>
          <Feather name={isActive ? 'chevron-up' : 'chevron-down'} size={17} color={colors.primary} />
        </TouchableOpacity>
        {isActive && !isEditing ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!table.entries.length}
              onPress={() => rollTable(table, kind)}
              style={[buttonStyle, { flex: 1, opacity: table.entries.length ? 1 : 0.45 }]}
            >
              <Feather name="shuffle" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>ROLL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setEditingTableId(table.id)}
              style={[buttonStyle, { flex: 1 }]}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>EDIT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Delete table"
              onPress={() => deleteTable(table.id, kind)}
              style={buttonStyle}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ) : null}
        {isEditing ? (
          <>
            {renderTableEditor(table, kind)}
            <TouchableOpacity accessibilityRole="button" onPress={() => setEditingTableId(null)} style={buttonStyle}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>DONE EDITING</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {roll?.results.length ? (
          <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 9, gap: 5 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 }}>
              {roll.kind === 'loot' ? 'LOOT ROLL RESULT' : 'ENCOUNTER RESULT'}
            </Text>
            {roll.results.map((result, index) => (
              <View key={`${result.entryId}-${index}`} style={{ gap: 2 }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                  {result.name || 'Unnamed result'}{roll.kind === 'loot' && result.quantity > 1 ? ` × ${result.quantity}` : ''}
                </Text>
                {result.description ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 14 }}>{result.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {isActive && !table.entries.length ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Add entries before rolling this table.</Text>
        ) : null}
      </View>
    );
  };

  const renderTableSection = (
    kind: 'loot' | 'encounters',
    title: string,
    perkTip: string,
  ) => {
    const tables = tablesFor(kind);
    return (
      <TouchableOpacity
        key={kind}
        accessibilityRole="button"
        onPress={() => setScreen(kind)}
        style={[panelStyle, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
        testID={`campaign-tool-section-${kind}`}
      >
        <View style={{
          width: 42, height: 42, borderRadius: 9, backgroundColor: colors.secondary,
          borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
        }}>
          <Feather name={kind === 'loot' ? 'package' : 'shuffle'} size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1 }}>
            {title}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
            {tables.length} {tables.length === 1 ? 'table' : 'tables'}
          </Text>
          <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontSize: 9 }}>
            {perkTip}
          </Text>
        </View>
        <Feather name="chevron-right" size={17} color={colors.primary} />
      </TouchableOpacity>
    );
  };

  const renderTableWorkspace = (
    kind: 'loot' | 'encounters',
    perkTip: string,
  ) => {
    const tables = tablesFor(kind);
    return (
      <View style={{ gap: 10 }} testID={`campaign-tool-workspace-${kind}`}>
        <View style={panelStyle}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 }}>
            {perkTip} These are GM prompts; apply relevant perk effects when appropriate.
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => addTable(kind)} style={buttonStyle}>
          <Feather name="plus" size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>
            {kind === 'loot' ? 'ADD LOOT TABLE' : 'ADD ENCOUNTER TABLE'}
          </Text>
        </TouchableOpacity>
        {tables.map(table => renderTable(table, kind))}
        {tables.length === 0 ? (
          <View style={[panelStyle, { alignItems: 'center', paddingVertical: 24 }]}>
            <Feather name={kind === 'loot' ? 'package' : 'shuffle'} size={24} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center' }}>
              No tables yet. Add one to start building this campaign tool.
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const deleteMap = (map: CampaignMap) => {
    confirmDestructive(
      `Delete ${map.name || translateText('this map')}?`,
      'The map image and markers will be removed from the campaign.',
      () => {
        onChange({
          lootTables,
          encounterTables,
          campaignMaps: campaignMaps.filter(item => item.id !== map.id),
        });
        if (mapEditorId === map.id) setMapEditorId(null);
      },
    );
  };

  const renderMapsWorkspace = () => (
    <View style={{ gap: 10 }} testID="campaign-tool-workspace-maps">
      <View style={panelStyle}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 }}>
          Upload custom maps, place and edit locations, and export each built map as a JSON file.
        </Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={addMap} style={buttonStyle}>
        <Feather name="plus" size={15} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>ADD MAP</Text>
      </TouchableOpacity>
      {campaignMaps.map(map => (
        <View key={map.id} style={panelStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 84, height: 64, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 8,
              backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center',
            }}>
              {map.imageDataUri
                ? <Image accessibilityLabel={map.name} source={{ uri: map.imageDataUri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                : <Feather name="map" size={18} color={colors.primary} />}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                {map.name || 'Untitled map'}
              </Text>
              <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {map.description || translateText('{0} locations').replace('{0}', String(map.locations.length))}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setMapEditorId(map.id)}
              style={[buttonStyle, { flex: 1 }]}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>EDIT MAP</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => void downloadMap(map)} style={buttonStyle}>
              <Feather name="download" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Delete ${map.name}`}
              onPress={() => deleteMap(map)}
              style={buttonStyle}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {campaignMaps.length === 0 ? (
        <View style={[panelStyle, { alignItems: 'center', paddingVertical: 24 }]}>
          <Feather name="map" size={24} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center' }}>
            No maps yet. Add one to upload a map and mark locations.
          </Text>
        </View>
      ) : null}
    </View>
  );

  const mapBeingEdited = (newMapDraft?.id === mapEditorId ? newMapDraft : null)
    ?? campaignMaps.find(map => map.id === mapEditorId)
    ?? null;

  return (
    <>
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => screen === 'home' ? onClose() : setScreen('home')}
    >
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: modalTopInset }} testID="campaign-tools-panel">
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
          {screen !== 'home' ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => setScreen('home')}
              style={{ padding: 7, marginRight: 6 }}
            >
              <Feather name="arrow-left" size={19} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: 1.5 }}>
              {screen === 'home' ? 'CAMPAIGN TOOL CHEST' : screen === 'loot' ? 'LOOT TABLES' : screen === 'encounters' ? 'ENCOUNTER TABLES' : 'MAPS'}
            </Text>
            {screen !== 'maps' ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 }}>
                Open a category to manage its assets. Open an individual table to roll on it or edit its rules.
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close Campaign Tool Chest"
            onPress={onClose}
            style={{ padding: 6 }}
          >
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}>
          {screen === 'home' ? (
            <>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 }}>
                Open a category to manage its assets. Open an individual table to roll on it or edit its rules.
              </Text>
              {renderTableSection(
                'loot',
                'LOOT TABLES',
                'Perks to consider: Fortune Finder, Scrounger, Treasure Hunter, Explorer.',
              )}
              {renderTableSection(
                'encounters',
                'ENCOUNTER TABLES',
                'Perks to consider: Cautious Nature, Explorer, Mysterious Stranger, Ranger, Scout, Animal Friend.',
              )}
              {([
                { kind: 'maps' as const, title: 'MAPS', count: campaignMaps.length, icon: 'map' as const },
              ]).map(item => (
                <TouchableOpacity
                  key={item.kind}
                  accessibilityRole="button"
                  onPress={() => setScreen(item.kind)}
                  style={[panelStyle, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
                >
                  <View style={{
                    width: 42, height: 42, borderRadius: 9, backgroundColor: colors.secondary,
                    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Feather name={item.icon} size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1 }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                      {item.count} {item.kind === 'maps'
                        ? item.count === 1 ? 'map' : 'maps'
                        : item.count === 1 ? 'table' : 'tables'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={17} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </>
          ) : screen === 'loot' ? (
            renderTableWorkspace('loot', 'Perks to consider: Fortune Finder, Scrounger, Treasure Hunter, Explorer.')
          ) : screen === 'encounters' ? (
            renderTableWorkspace('encounters', 'Perks to consider: Cautious Nature, Explorer, Mysterious Stranger, Ranger, Scout, Animal Friend.')
          ) : renderMapsWorkspace()}
        </ScrollView>
      </View>
    </Modal>
    {visible && mapBeingEdited ? (
      <CampaignMapEditorModal
        visible
        map={mapBeingEdited}
        onClose={() => {
          setMapEditorId(null);
          if (newMapDraft && !campaignMaps.some(item => item.id === newMapDraft.id)) setNewMapDraft(null);
        }}
        onSave={savedMap => {
          const exists = campaignMaps.some(item => item.id === savedMap.id);
          onChange({
            lootTables,
            encounterTables,
            campaignMaps: exists
              ? campaignMaps.map(item => item.id === savedMap.id ? savedMap : item)
              : [...campaignMaps, savedMap],
          });
          if (newMapDraft?.id === savedMap.id) setNewMapDraft(savedMap);
        }}
        onExport={map => void downloadMap(map)}
      />
    ) : null}
    </>
  );
}
