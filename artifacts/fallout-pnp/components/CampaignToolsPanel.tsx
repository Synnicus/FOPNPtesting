import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, Share, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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

type ToolTab = 'loot' | 'encounters' | 'maps';

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
  const [expanded, setExpanded] = useState<Record<ToolTab, boolean>>({
    loot: false,
    encounters: false,
    maps: false,
  });
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [lastRolls, setLastRolls] = useState<Record<string, { kind: ToolTab; results: CampaignTableRollResult[] }>>({});
  const [selectedMapId, setSelectedMapId] = useState<string | null>(campaignMaps[0]?.id ?? null);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<'location' | 'party'>('location');
  const [locationName, setLocationName] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({ width: 1, height: 1 });
  const selectedMap = campaignMaps.find(map => map.id === selectedMapId) ?? campaignMaps[0] ?? null;
  const activeCharacters = characters.filter(character => !character.inStorage);

  useEffect(() => {
    if (!visible) return;
    setExpanded({ loot: false, encounters: false, maps: false });
    setActiveTableId(null);
    setEditingTableId(null);
    setActiveMapId(null);
    setEditingMapId(null);
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
    setExpanded(current => ({ ...current, [kind]: true }));
    setActiveTableId(created.id);
    setEditingTableId(created.id);
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
    onChange({ lootTables, encounterTables, campaignMaps: [...campaignMaps, created] });
    setSelectedMapId(created.id);
    setActiveMapId(created.id);
    setEditingMapId(created.id);
    setExpanded(current => ({ ...current, maps: true }));
  };

  const updateMap = (changed: CampaignMap) => {
    onChange({ lootTables, encounterTables, campaignMaps: campaignMaps.map(map => map.id === changed.id ? changed : map) });
    setSelectedMapId(changed.id);
  };

  const pickMapImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.65,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64 || !selectedMap) return;
    const mime = ['image/png', 'image/webp'].includes(asset.mimeType ?? '')
      ? asset.mimeType!
      : 'image/jpeg';
    updateMap({ ...selectedMap, imageDataUri: `data:${mime};base64,${asset.base64}` });
  };

  const placeMarker = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!selectedMap) return;
    const x = Math.max(0, Math.min(1, event.nativeEvent.locationX / mapSize.width));
    const y = Math.max(0, Math.min(1, event.nativeEvent.locationY / mapSize.height));
    if (placementMode === 'location') {
      const name = locationName.trim();
      if (!name) return;
      updateMap({
        ...selectedMap,
        locations: [...selectedMap.locations, { id: id(), name, description: '', x, y }],
      });
      setLocationName('');
      return;
    }
    if (!selectedCharacterId) return;
    updateMap({
      ...selectedMap,
      party: [
        ...selectedMap.party.filter(marker => marker.characterId !== selectedCharacterId),
        { characterId: selectedCharacterId, x, y },
      ],
    });
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
    const isExpanded = expanded[kind];
    const tables = tablesFor(kind);
    return (
      <View style={panelStyle} testID={`campaign-tool-section-${kind}`}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          onPress={() => setExpanded(current => ({ ...current, [kind]: !current[kind] }))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.2 }}>
              {title}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 3 }}>
              {tables.length} {tables.length === 1 ? 'table' : 'tables'}
            </Text>
          </View>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
        </TouchableOpacity>
        {isExpanded ? (
          <View style={{ gap: 9 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 15 }}>
              {perkTip} These are GM prompts; apply relevant perk effects when appropriate.
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => addTable(kind)} style={buttonStyle}>
              <Feather name="plus" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>
                {kind === 'loot' ? 'ADD LOOT TABLE' : 'ADD ENCOUNTER TABLE'}
              </Text>
            </TouchableOpacity>
            {tables.map(table => renderTable(table, kind))}
            {tables.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>
                No tables yet. Add one to start building this campaign tool.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderMapEditor = () => {
    if (!selectedMap || editingMapId !== selectedMap.id) return null;
    const map = selectedMap;
    return (
      <View style={panelStyle}>
        <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 }}>
          MAP DETAILS
        </Text>
        <TextInput
          accessibilityLabel="Map name"
          value={map.name}
          onChangeText={name => updateMap({ ...map, name })}
          placeholder="Map name"
          style={inputStyle}
        />
        <TextInput
          accessibilityLabel="Map description"
          value={map.description}
          onChangeText={description => updateMap({ ...map, description })}
          placeholder="Map notes"
          style={inputStyle}
        />
        <View style={{ flexDirection: 'row', gap: 7 }}>
          <TouchableOpacity accessibilityRole="button" onPress={pickMapImage} style={[buttonStyle, { flex: 1 }]}>
            <Feather name="image" size={15} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>
              {map.imageDataUri ? 'CHANGE MAP IMAGE' : 'UPLOAD MAP IMAGE'}
            </Text>
          </TouchableOpacity>
          {map.imageDataUri ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Remove map image"
              onPress={() => updateMap({ ...map, imageDataUri: undefined })}
              style={buttonStyle}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View
          onLayout={event => setMapSize({
            width: Math.max(1, event.nativeEvent.layout.width),
            height: Math.max(1, event.nativeEvent.layout.height),
          })}
          style={{
            width: '100%',
            height: 230,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 7,
            overflow: 'hidden',
            backgroundColor: colors.secondary,
          }}
        >
          {map.imageDataUri ? (
            <Image source={{ uri: map.imageDataUri }} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
              <Feather name="map" size={28} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                Upload a custom map image to place markers.
              </Text>
            </View>
          )}
          {map.imageDataUri ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Place a map marker"
              onPress={placeMarker}
              style={{ position: 'absolute', inset: 0 }}
            >
              {map.locations.map(location => (
                <View
                  key={location.id}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: `${location.x * 100}%`,
                    top: `${location.y * 100}%`,
                    backgroundColor: '#f59e0b',
                    borderRadius: 8,
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                    transform: [{ translateX: -5 }, { translateY: -5 }],
                  }}
                >
                  <Text style={{ color: '#111', fontSize: 8, fontFamily: 'Inter_700Bold' }}>
                    {location.name.slice(0, 16)}
                  </Text>
                </View>
              ))}
              {map.party.map(marker => {
                const character = characters.find(item => item.id === marker.characterId);
                return (
                  <View
                    key={marker.characterId}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: `${marker.x * 100}%`,
                      top: `${marker.y * 100}%`,
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      paddingHorizontal: 5,
                      paddingVertical: 3,
                      transform: [{ translateX: -5 }, { translateY: -5 }],
                    }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontSize: 8, fontFamily: 'Inter_700Bold' }}>
                      {(character?.name ?? 'PC').slice(0, 12)}
                    </Text>
                  </View>
                );
              })}
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPlacementMode('location')}
            style={[buttonStyle, { flex: 1, backgroundColor: placementMode === 'location' ? colors.primary + '22' : colors.secondary }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 9 }}>PLACE LOCATION</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPlacementMode('party')}
            style={[buttonStyle, { flex: 1, backgroundColor: placementMode === 'party' ? colors.primary + '22' : colors.secondary }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 9 }}>PLACE PARTY</Text>
          </TouchableOpacity>
        </View>
        {placementMode === 'location' ? (
          <TextInput
            accessibilityLabel="New location name"
            value={locationName}
            onChangeText={setLocationName}
            placeholder="Location name, then tap map"
            style={inputStyle}
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {activeCharacters.map(character => (
              <TouchableOpacity
                key={character.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedCharacterId === character.id }}
                onPress={() => setSelectedCharacterId(character.id)}
                style={{ ...buttonStyle, backgroundColor: selectedCharacterId === character.id ? colors.primary : colors.secondary }}
              >
                <Text style={{ color: selectedCharacterId === character.id ? colors.primaryForeground : colors.foreground, fontSize: 9 }}>
                  {character.name}
                </Text>
              </TouchableOpacity>
            ))}
            {activeCharacters.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                Add an active character to place the party.
              </Text>
            ) : null}
          </View>
        )}
        {map.locations.map(location => (
          <View key={location.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TextInput
              accessibilityLabel={`Description for ${location.name}`}
              value={location.description}
              onChangeText={description => updateMap({
                ...map,
                locations: map.locations.map(item => item.id === location.id ? { ...item, description } : item),
              })}
              placeholder={`${location.name} notes`}
              style={[inputStyle, { flex: 1 }]}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Remove ${location.name}`}
              onPress={() => updateMap({
                ...map,
                locations: map.locations.filter(item => item.id !== location.id),
              })}
              style={buttonStyle}
            >
              <Feather name="x" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
        {map.party.map(marker => {
          const character = characters.find(item => item.id === marker.characterId);
          return (
            <View key={marker.characterId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ flex: 1, color: colors.foreground, fontSize: 10 }}>
                {character?.name ?? translateText('Unknown character')} — party marker
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove ${character?.name ?? translateText('party')} marker`}
                onPress={() => updateMap({
                  ...map,
                  party: map.party.filter(item => item.characterId !== marker.characterId),
                })}
                style={buttonStyle}
              >
                <Feather name="x" size={14} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
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
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: 1.5 }}>
              CAMPAIGN TOOL CHEST
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 }}>
              Campaign tables and maps save automatically.
            </Text>
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
          <View style={panelStyle} testID="campaign-tool-section-maps">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: expanded.maps }}
              onPress={() => setExpanded(current => ({ ...current, maps: !current.maps }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.2 }}>
                  MAPS
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 3 }}>
                  {campaignMaps.length} {campaignMaps.length === 1 ? 'map' : 'maps'}
                </Text>
              </View>
              <Feather name={expanded.maps ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
            </TouchableOpacity>
            {expanded.maps ? (
              <View style={{ gap: 9 }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 }}>
                  Upload custom maps, place location and party markers, and export each built map as a JSON file. Bonus Move and Team Player are GM reminders for distance and party movement.
                </Text>
                <TouchableOpacity accessibilityRole="button" onPress={addMap} style={buttonStyle}>
                  <Feather name="plus" size={15} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>ADD MAP</Text>
                </TouchableOpacity>
                {campaignMaps.map(map => (
                  <View key={map.id} style={panelStyle}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ expanded: activeMapId === map.id }}
                      onPress={() => {
                        const nextActive = activeMapId === map.id ? null : map.id;
                        setActiveMapId(nextActive);
                        setEditingMapId(null);
                        if (nextActive) setSelectedMapId(map.id);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
                    >
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                          {map.name || 'Untitled map'}
                        </Text>
                        <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontSize: 10 }}>
                          {map.description || `${map.locations.length} locations · ${map.party.length} party markers`}
                        </Text>
                      </View>
                      <Feather name={activeMapId === map.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
                    </TouchableOpacity>
                    {activeMapId === map.id ? (
                      <>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => {
                              setSelectedMapId(map.id);
                              setEditingMapId(editingMapId === map.id ? null : map.id);
                            }}
                            style={[buttonStyle, { flex: 1 }]}
                          >
                            <Feather name="edit-2" size={14} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>
                              {editingMapId === map.id ? 'CLOSE EDITOR' : 'EDIT MAP'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity accessibilityRole="button" onPress={() => void downloadMap(map)} style={buttonStyle}>
                            <Feather name="download" size={14} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>JSON</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${map.name}`}
                            onPress={() => confirmDestructive(
                              `Delete ${translateText(map.name || 'this map')}?`,
                              'The map image and markers will be removed from the campaign.',
                              () => {
                                const next = campaignMaps.filter(item => item.id !== map.id);
                                onChange({ lootTables, encounterTables, campaignMaps: next });
                                setSelectedMapId(next[0]?.id ?? null);
                                setActiveMapId(null);
                                setEditingMapId(null);
                              },
                            )}
                            style={buttonStyle}
                          >
                            <Feather name="trash-2" size={14} color={colors.destructive} />
                          </TouchableOpacity>
                        </View>
                        {editingMapId === map.id ? renderMapEditor() : null}
                      </>
                    ) : null}
                  </View>
                ))}
                {campaignMaps.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>
                    No maps yet. Add one to upload a map and mark locations or party positions.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
