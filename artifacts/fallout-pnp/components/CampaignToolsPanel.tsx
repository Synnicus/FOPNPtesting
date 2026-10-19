import React, { useState } from 'react';
import { Image, Platform, Share, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { CampaignMap, CampaignTable, Character } from '@/context/types';

type ToolTab = 'loot' | 'encounters' | 'maps';

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function CampaignToolsPanel({
  lootTables,
  encounterTables,
  campaignMaps,
  characters,
  onChange,
}: {
  lootTables: CampaignTable[];
  encounterTables: CampaignTable[];
  campaignMaps: CampaignMap[];
  characters: Character[];
  onChange: (value: { lootTables: CampaignTable[]; encounterTables: CampaignTable[]; campaignMaps: CampaignMap[] }) => void;
}) {
  const colors = useColors();
  const [tab, setTab] = useState<ToolTab>('loot');
  const [selectedMapId, setSelectedMapId] = useState<string | null>(campaignMaps[0]?.id ?? null);
  const [placementMode, setPlacementMode] = useState<'location' | 'party'>('location');
  const [locationName, setLocationName] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [mapSize, setMapSize] = useState({ width: 1, height: 1 });
  const tables = tab === 'loot' ? lootTables : encounterTables;
  const selectedMap = campaignMaps.find(map => map.id === selectedMapId) ?? campaignMaps[0] ?? null;
  const activeCharacters = characters.filter(character => !character.inStorage);

  const updateTable = (list: CampaignTable[], changed: CampaignTable, kind: 'loot' | 'encounters') => {
    const next = list.map(table => table.id === changed.id ? changed : table);
    onChange({
      lootTables: kind === 'loot' ? next : lootTables,
      encounterTables: kind === 'encounters' ? next : encounterTables,
      campaignMaps,
    });
  };

  const addTable = () => {
    const created: CampaignTable = { id: id(), name: tab === 'loot' ? 'New Loot Table' : 'New Encounter Table', description: '', entries: [] };
    onChange({
      lootTables: tab === 'loot' ? [...lootTables, created] : lootTables,
      encounterTables: tab === 'encounters' ? [...encounterTables, created] : encounterTables,
      campaignMaps,
    });
  };

  const deleteTable = (tableId: string) => onChange({
    lootTables: tab === 'loot' ? lootTables.filter(table => table.id !== tableId) : lootTables,
    encounterTables: tab === 'encounters' ? encounterTables.filter(table => table.id !== tableId) : encounterTables,
    campaignMaps,
  });

  const addMap = () => {
    const created: CampaignMap = { id: id(), name: 'New Map', description: '', locations: [], party: [] };
    onChange({ lootTables, encounterTables, campaignMaps: [...campaignMaps, created] });
    setSelectedMapId(created.id);
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
    const json = JSON.stringify({ format: 'fallout-pnp-map', version: 1, map }, null, 2);
    const filename = `${map.name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'campaign-map'}.json`;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      return;
    }
    await Share.share({ title: filename, message: json });
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

  const renderTable = (table: CampaignTable) => {
    const kind = tab === 'loot' ? 'loot' : 'encounters';
    return (
      <View key={table.id} style={panelStyle} testID={`campaign-table-${table.id}`}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput accessibilityLabel="Table name" value={table.name} onChangeText={name => updateTable(tables, { ...table, name }, kind)} style={[inputStyle, { flex: 1 }]} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${table.name}`} onPress={() => deleteTable(table.id)} style={buttonStyle}>
            <Feather name="trash-2" size={15} color={colors.destructive} />
          </TouchableOpacity>
        </View>
        <TextInput accessibilityLabel="Table description" value={table.description} onChangeText={description => updateTable(tables, { ...table, description }, kind)} placeholder="Purpose and GM notes" style={inputStyle} />
        {table.entries.map(entry => (
          <View key={entry.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              <TextInput accessibilityLabel="Entry name" value={entry.name} onChangeText={name => updateTable(tables, { ...table, entries: table.entries.map(item => item.id === entry.id ? { ...item, name } : item) }, kind)} placeholder="Entry name" style={[inputStyle, { flex: 1 }]} />
              <TextInput accessibilityLabel="Entry weight" keyboardType="number-pad" value={String(entry.weight)} onChangeText={value => updateTable(tables, { ...table, entries: table.entries.map(item => item.id === entry.id ? { ...item, weight: Math.max(1, Number.parseInt(value, 10) || 1) } : item) }, kind)} style={[inputStyle, { width: 60 }]} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${entry.name}`} onPress={() => updateTable(tables, { ...table, entries: table.entries.filter(item => item.id !== entry.id) }, kind)} style={buttonStyle}>
                <Feather name="x" size={15} color={colors.destructive} />
              </TouchableOpacity>
            </View>
            <TextInput accessibilityLabel="Entry details" value={entry.description} onChangeText={description => updateTable(tables, { ...table, entries: table.entries.map(item => item.id === entry.id ? { ...item, description } : item) }, kind)} placeholder="Details, result, or reward" style={inputStyle} />
          </View>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => updateTable(tables, { ...table, entries: [...table.entries, { id: id(), name: '', description: '', weight: 1 }] }, kind)}
          style={buttonStyle}
        >
          <Feather name="plus" size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold' }}>ADD TABLE ENTRY</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ gap: 12, marginBottom: 18 }} testID="campaign-tools-panel">
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: 1.5 }}>CAMPAIGN TOOLS</Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>
          Configure the GM tables and maps used by this campaign. Changes are saved with the campaign.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {([
          ['loot', 'LOOT TABLES'],
          ['encounters', 'ENCOUNTER TABLES'],
          ['maps', 'MAP TOOL'],
        ] as const).map(([key, label]) => (
          <TouchableOpacity key={key} accessibilityRole="button" onPress={() => setTab(key)} style={{
            ...buttonStyle,
            backgroundColor: tab === key ? colors.primary : colors.secondary,
            borderColor: tab === key ? colors.primary : colors.border,
            flex: 1,
          }}>
            <Text style={{ color: tab === key ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 10 }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab !== 'maps' ? (
        <View style={{ gap: 10 }}>
          <Text style={{ ...panelStyle, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>
            {tab === 'loot'
              ? 'Perks to apply when using these tables: Fortune Finder, Scrounger, Treasure Hunter, Explorer.'
              : 'Perks to apply when using these tables: Cautious Nature, Explorer, Mysterious Stranger, Ranger, Scout, Animal Friend.'}
            {' '}These perks are GM prompts; table results are not rolled automatically.
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={addTable} style={buttonStyle}>
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>ADD {tab === 'loot' ? 'LOOT' : 'ENCOUNTER'} TABLE</Text>
          </TouchableOpacity>
          {tables.map(renderTable)}
          {tables.length === 0 && <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>No tables yet. Add a blank table now; entries can be added or changed later.</Text>}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>
            Upload a map image, tap it to place locations or party markers, and export each map as JSON. Hex-distance perks such as Bonus Move and Team Player remain reminders until hex movement is added.
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={addMap} style={buttonStyle}>
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>ADD MAP</Text>
          </TouchableOpacity>
          {campaignMaps.map(map => (
            <TouchableOpacity key={map.id} accessibilityRole="button" onPress={() => setSelectedMapId(map.id)} style={{
              ...buttonStyle,
              justifyContent: 'space-between',
              backgroundColor: map.id === selectedMap?.id ? colors.primary + '22' : colors.secondary,
            }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{map.name || 'Untitled map'}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{map.locations.length} locations · {map.party.length} party markers</Text>
            </TouchableOpacity>
          ))}
          {selectedMap && (
            <View style={panelStyle}>
              <TextInput accessibilityLabel="Map name" value={selectedMap.name} onChangeText={name => updateMap({ ...selectedMap, name })} placeholder="Map name" style={inputStyle} />
              <TextInput accessibilityLabel="Map description" value={selectedMap.description} onChangeText={description => updateMap({ ...selectedMap, description })} placeholder="Map notes" style={inputStyle} />
              <View style={{ flexDirection: 'row', gap: 7 }}>
                <TouchableOpacity accessibilityRole="button" onPress={pickMapImage} style={[buttonStyle, { flex: 1 }]}>
                  <Feather name="image" size={15} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>UPLOAD MAP IMAGE</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => void downloadMap(selectedMap)} style={buttonStyle}>
                  <Feather name="download" size={15} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10 }}>JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete map" onPress={() => {
                  const next = campaignMaps.filter(item => item.id !== selectedMap.id);
                  onChange({ lootTables, encounterTables, campaignMaps: next });
                  setSelectedMapId(next[0]?.id ?? null);
                }} style={buttonStyle}>
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                </TouchableOpacity>
              </View>
              <View
                onLayout={event => setMapSize({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })}
                style={{ width: '100%', height: 230, borderWidth: 1, borderColor: colors.border, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.secondary }}
              >
                {selectedMap.imageDataUri ? (
                  <Image source={{ uri: selectedMap.imageDataUri }} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <Feather name="map" size={28} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8, textAlign: 'center' }}>Upload a custom map image to place markers.</Text>
                  </View>
                )}
                {selectedMap.imageDataUri && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Place a map marker"
                    onPress={placeMarker}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    {selectedMap.locations.map(location => (
                      <View key={location.id} pointerEvents="none" style={{ position: 'absolute', left: `${location.x * 100}%`, top: `${location.y * 100}%`, backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2, transform: [{ translateX: -5 }, { translateY: -5 }] }}>
                        <Text style={{ color: '#111', fontSize: 8, fontFamily: 'Inter_700Bold' }}>{location.name.slice(0, 16)}</Text>
                      </View>
                    ))}
                    {selectedMap.party.map(marker => {
                      const character = characters.find(item => item.id === marker.characterId);
                      return (
                        <View key={marker.characterId} pointerEvents="none" style={{ position: 'absolute', left: `${marker.x * 100}%`, top: `${marker.y * 100}%`, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 3, transform: [{ translateX: -5 }, { translateY: -5 }] }}>
                          <Text style={{ color: colors.primaryForeground, fontSize: 8, fontFamily: 'Inter_700Bold' }}>{(character?.name ?? 'PC').slice(0, 12)}</Text>
                        </View>
                      );
                    })}
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity accessibilityRole="button" onPress={() => setPlacementMode('location')} style={[buttonStyle, { flex: 1, backgroundColor: placementMode === 'location' ? colors.primary + '22' : colors.secondary }]}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 9 }}>PLACE LOCATION</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => setPlacementMode('party')} style={[buttonStyle, { flex: 1, backgroundColor: placementMode === 'party' ? colors.primary + '22' : colors.secondary }]}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 9 }}>PLACE PARTY</Text>
                </TouchableOpacity>
              </View>
              {placementMode === 'location' ? (
                <TextInput accessibilityLabel="New location name" value={locationName} onChangeText={setLocationName} placeholder="Location name, then tap map" style={inputStyle} />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  {activeCharacters.map(character => (
                    <TouchableOpacity key={character.id} accessibilityRole="button" onPress={() => setSelectedCharacterId(character.id)} style={{ ...buttonStyle, backgroundColor: selectedCharacterId === character.id ? colors.primary : colors.secondary }}>
                      <Text style={{ color: selectedCharacterId === character.id ? colors.primaryForeground : colors.foreground, fontSize: 9 }}>{character.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {activeCharacters.length === 0 && <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Add an active character to place the party.</Text>}
                </View>
              )}
              {selectedMap.locations.map(location => (
                <View key={location.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput accessibilityLabel="Location description" value={location.description} onChangeText={description => updateMap({ ...selectedMap, locations: selectedMap.locations.map(item => item.id === location.id ? { ...item, description } : item) })} placeholder={`${location.name} notes`} style={[inputStyle, { flex: 1 }]} />
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${location.name}`} onPress={() => updateMap({ ...selectedMap, locations: selectedMap.locations.filter(item => item.id !== location.id) })} style={buttonStyle}>
                    <Feather name="x" size={14} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
