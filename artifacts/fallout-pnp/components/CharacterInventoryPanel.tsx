import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type {
  Armor,
  Character,
  CharacterInventoryCategory,
  CharacterInventoryItem,
  CustomConsumable,
  Weapon,
} from '@/context/types';
import type { AmmoType } from '@/data/ammo';
import { ALCOHOL_CONSUMABLES, CHEMS } from '@/data/chems';
import {
  calculateInventoryWeight,
  getAmmoRoundWeight,
  getInventoryItemQuantity,
  normalizeCharacterInventory,
  setInventoryItemQuantity,
  type InventoryCatalog,
} from '@/data/inventory';
import { BUILT_IN_TOOLS } from '@/data/tools';

type PickerCategory = 'weapon' | CharacterInventoryCategory;

interface Props {
  character: Character;
  setCharacter: React.Dispatch<React.SetStateAction<Character>>;
  carryCapacity: number;
  weapons: readonly Weapon[];
  armor: readonly Armor[];
  ammo: readonly AmmoType[];
  customConsumables: readonly CustomConsumable[];
}

function weightLabel(weight: number | undefined): string {
  return weight === undefined ? 'WEIGHT NOT SET' : `${Number(weight.toFixed(2))} lb each`;
}

export function CharacterInventoryPanel({
  character,
  setCharacter,
  carryCapacity,
  weapons,
  armor,
  ammo,
  customConsumables,
}: Props) {
  const colors = useColors();
  const [picker, setPicker] = useState<PickerCategory | null>(null);
  const [notice, setNotice] = useState('');
  const normalizedCharacter = useMemo(
    () => normalizeCharacterInventory(character),
    [character],
  );
  const catalog: InventoryCatalog = useMemo(() => ({
    weapons,
    armor,
    ammo,
    tools: BUILT_IN_TOOLS,
    consumables: [
      ...CHEMS.map(chem => ({ id: chem.id })),
      ...ALCOHOL_CONSUMABLES.map(item => ({ id: item.id })),
      ...customConsumables,
    ],
  }), [weapons, armor, ammo, customConsumables]);
  const weight = calculateInventoryWeight(normalizedCharacter, catalog);
  const overweight = weight.totalWeight > carryCapacity;
  const rows = useMemo(() => {
    if (!picker) return [];
    if (picker === 'weapon') {
      return weapons.map(item => ({ id: item.id, name: item.name, detail: `${item.weight} lb` }));
    }
    if (picker === 'armor') {
      return armor.map(item => ({ id: item.id, name: item.name, detail: `${item.weight} lb · ${item.slot}` }));
    }
    if (picker === 'ammo') {
      return ammo.map(item => ({ id: item.id, name: item.name, detail: 'Add one round; set its weight below' }));
    }
    if (picker === 'tool') {
      return BUILT_IN_TOOLS.map(item => ({ id: item.id, name: item.name, detail: item.weight === undefined ? 'Weight not listed' : `${item.weight} lb` }));
    }
    return [
      ...CHEMS.map(item => ({ id: item.id, name: item.name, detail: 'Chem · weight not listed' })),
      ...ALCOHOL_CONSUMABLES.map(item => ({ id: item.id, name: item.name, detail: 'Drink · weight not listed' })),
      ...customConsumables.map(item => ({ id: item.id, name: item.name, detail: 'Custom consumable · set weight below' })),
    ];
  }, [picker, weapons, armor, ammo, customConsumables]);

  const knownWeightFor = (category: CharacterInventoryCategory, itemId: string) => {
    if (category === 'ammo') return 0;
    const saved = normalizedCharacter.inventoryItems?.find(item => item.category === category && item.itemId === itemId);
    if (saved?.weightPerUnit !== undefined) return saved.weightPerUnit;
    if (category === 'armor') return armor.find(item => item.id === itemId)?.weight;
    if (category === 'tool') return BUILT_IN_TOOLS.find(item => item.id === itemId)?.weight;
    return undefined;
  };

  const canCarryAdditionalWeight = (additionalWeight: number | undefined) =>
    additionalWeight === undefined || weight.totalWeight + additionalWeight <= carryCapacity;

  const showCapacityNotice = () => {
    setNotice(`This would exceed the ${carryCapacity} lb carry capacity.`);
  };

  const addWeapon = (weaponId: string) => {
    const weapon = weapons.find(item => item.id === weaponId);
    if (!canCarryAdditionalWeight(weapon?.weight)) {
      showCapacityNotice();
      return;
    }
    const counts = normalizedCharacter.inventoryWeaponCounts ?? {};
    setCharacter({
      ...normalizedCharacter,
      inventoryWeaponIds: [...new Set([...(normalizedCharacter.inventoryWeaponIds ?? []), weaponId])],
      inventoryWeaponCounts: {
        ...counts,
        [weaponId]: (counts[weaponId] ?? 1) + (counts[weaponId] ? 1 : 0),
      },
    });
    setNotice('');
  };

  const removeWeapon = (weaponId: string) => {
    const counts = normalizedCharacter.inventoryWeaponCounts ?? {};
    const currentCount = counts[weaponId] ?? 1;
    if (currentCount > 1) {
      setCharacter({
        ...normalizedCharacter,
        inventoryWeaponCounts: { ...counts, [weaponId]: currentCount - 1 },
      });
      return;
    }
    const nextCounts = { ...counts };
    delete nextCounts[weaponId];
    setCharacter({
      ...normalizedCharacter,
      inventoryWeaponIds: (normalizedCharacter.inventoryWeaponIds ?? []).filter(id => id !== weaponId),
      inventoryWeaponCounts: nextCounts,
      leftHandWeaponId: normalizedCharacter.leftHandWeaponId === weaponId ? undefined : normalizedCharacter.leftHandWeaponId,
      rightHandWeaponId: normalizedCharacter.rightHandWeaponId === weaponId ? undefined : normalizedCharacter.rightHandWeaponId,
      equippedWeaponId: normalizedCharacter.equippedWeaponId === weaponId
        ? (normalizedCharacter.rightHandWeaponId === weaponId
          ? normalizedCharacter.leftHandWeaponId
          : normalizedCharacter.rightHandWeaponId)
        : normalizedCharacter.equippedWeaponId,
    });
  };

  const addStackItem = (category: CharacterInventoryCategory, itemId: string) => {
    const unitWeight = knownWeightFor(category, itemId);
    const ammoStack = category === 'ammo'
      ? normalizedCharacter.inventoryItems?.find(item => item.category === 'ammo' && item.itemId === itemId)
      : undefined;
    const ammoWeight = ammoStack ? getAmmoRoundWeight(ammoStack) : undefined;
    if (!canCarryAdditionalWeight(category === 'ammo' ? ammoWeight : unitWeight)) {
      showCapacityNotice();
      return;
    }
    const current = getInventoryItemQuantity(normalizedCharacter.inventoryItems, category, itemId);
    const defaultPatch: Partial<CharacterInventoryItem> = category === 'ammo'
      ? { ammoWeightMode: ammoStack?.ammoWeightMode ?? 'box' }
      : {};
    const inventoryItems = setInventoryItemQuantity(
      normalizedCharacter.inventoryItems,
      category,
      itemId,
      current + 1,
      defaultPatch,
    );
    setCharacter({
      ...normalizedCharacter,
      inventoryItems,
      ...(category === 'armor' && itemId === normalizedCharacter.equippedBodyArmorId
        ? {}
        : {}),
    });
    setNotice('');
  };

  const changeQuantity = (
    item: CharacterInventoryItem,
    delta: number,
  ) => {
    const nextQuantity = Math.max(0, item.quantity + delta);
    if (delta > 0) {
      const unitWeight = item.category === 'ammo'
        ? getAmmoRoundWeight(item)
        : knownWeightFor(item.category, item.itemId);
      const addedWeight = unitWeight === undefined ? undefined : unitWeight * delta;
      if (!canCarryAdditionalWeight(addedWeight)) {
        showCapacityNotice();
        return;
      }
    }
    const inventoryItems = setInventoryItemQuantity(
      normalizedCharacter.inventoryItems,
      item.category,
      item.itemId,
      nextQuantity,
    );
    const removesWornMask = item.category === 'tool'
      && item.itemId === 'gas_mask'
      && nextQuantity === 0
      && normalizedCharacter.wearingGasMask;
    setCharacter({
      ...normalizedCharacter,
      inventoryItems,
      ...(removesWornMask ? { wearingGasMask: false } : {}),
    });
    setNotice('');
  };

  const updateStack = (item: CharacterInventoryItem, patch: Partial<CharacterInventoryItem>) => {
    const inventoryItems = (normalizedCharacter.inventoryItems ?? []).map(existing =>
      existing.category === item.category && existing.itemId === item.itemId
        ? { ...existing, ...patch }
        : existing);
    setCharacter({ ...normalizedCharacter, inventoryItems });
  };

  const selectPickerItem = (itemId: string) => {
    if (picker === 'weapon') addWeapon(itemId);
    else if (picker) addStackItem(picker, itemId);
    setPicker(null);
  };

  const weaponCounts = normalizedCharacter.inventoryWeaponCounts ?? {};
  const inventoryWeapons = (normalizedCharacter.inventoryWeaponIds ?? [])
    .map(id => weapons.find(item => item.id === id))
    .filter((item): item is Weapon => !!item);
  const inventoryItems = normalizedCharacter.inventoryItems ?? [];
  const getItemName = (item: CharacterInventoryItem) => {
    if (item.category === 'armor') return armor.find(entry => entry.id === item.itemId)?.name ?? item.itemId;
    if (item.category === 'ammo') return ammo.find(entry => entry.id === item.itemId)?.name ?? item.itemId;
    if (item.category === 'tool') return BUILT_IN_TOOLS.find(entry => entry.id === item.itemId)?.name ?? item.itemId;
    return CHEMS.find(entry => entry.id === item.itemId)?.name
      ?? ALCOHOL_CONSUMABLES.find(entry => entry.id === item.itemId)?.name
      ?? customConsumables.find(entry => entry.id === item.itemId)?.name
      ?? item.itemId;
  };
  const getItemWeight = (item: CharacterInventoryItem) => {
    if (item.category === 'ammo') return getAmmoRoundWeight(item);
    return knownWeightFor(item.category, item.itemId);
  };
  const sectionButtonStyle = (disabled = false) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: disabled ? colors.border : colors.primary,
    opacity: disabled ? 0.45 : 1,
  });

  return (
    <View style={{ gap: 12 }}>
      <View style={{
        padding: 14,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: overweight ? colors.destructive : colors.primary + '66',
        backgroundColor: colors.secondary,
        gap: 4,
      }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>
          TOTAL CARRY WEIGHT
        </Text>
        <Text style={{ fontSize: 19, fontFamily: 'Inter_700Bold', color: overweight ? colors.destructive : colors.primary }}>
          {Number(weight.totalWeight.toFixed(2))} lb / {carryCapacity} lb
        </Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
          {weight.unknownWeightCount
            ? `${weight.unknownWeightCount} item type(s) have no weight set; their weight is not included.`
            : 'All carried items have a weight.'}
        </Text>
        {overweight && (
          <Text style={{ fontSize: 10, color: colors.destructive, fontFamily: 'Inter_700Bold' }}>
            Over carry capacity
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {([
          ['weapon', 'WEAPON'],
          ['armor', 'ARMOR'],
          ['ammo', 'AMMO'],
          ['tool', 'TOOL'],
          ['consumable', 'SUPPLY'],
        ] as const).map(([category, label]) => (
          <TouchableOpacity
            key={category}
            testID={`inventory-add-${category}`}
            accessibilityRole="button"
            style={sectionButtonStyle()}
            onPress={() => { setNotice(''); setPicker(category); }}
          >
            <Feather name="plus" size={12} color={colors.primary} />
            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {notice ? <Text style={{ fontSize: 10, color: colors.destructive }}>{notice}</Text> : null}

      <InventorySection title={`WEAPONS · ${inventoryWeapons.reduce((total, item) => total + (weaponCounts[item.id] ?? 1), 0)}`}>
        {inventoryWeapons.length === 0
          ? <EmptyInventoryText />
          : inventoryWeapons.map(weapon => {
            const count = weaponCounts[weapon.id] ?? 1;
            const equipped = normalizedCharacter.leftHandWeaponId === weapon.id
              || normalizedCharacter.rightHandWeaponId === weapon.id;
            return (
              <InventoryRow key={weapon.id} title={`${weapon.name}${count > 1 ? ` × ${count}` : ''}`} subtitle={`${weapon.weight} lb each · ${Number((weapon.weight * count).toFixed(2))} lb total${equipped ? ' · EQUIPPED' : ''}`}>
                <QuantityControl
                  colors={colors}
                  onMinus={() => removeWeapon(weapon.id)}
                  onPlus={() => addWeapon(weapon.id)}
                />
              </InventoryRow>
            );
          })}
      </InventorySection>

      {(['armor', 'ammo', 'tool', 'consumable'] as const).map(category => {
        const categoryItems = inventoryItems.filter(item => item.category === category);
        return (
          <InventorySection
            key={category}
            title={`${category === 'ammo' ? 'AMMUNITION' : category === 'tool' ? 'TOOLS' : category === 'consumable' ? 'CONSUMABLES' : 'ARMOR'} · ${categoryItems.reduce((total, item) => total + item.quantity, 0)}`}
          >
            {categoryItems.length === 0
              ? <EmptyInventoryText />
              : categoryItems.map(item => {
                const unitWeight = getItemWeight(item);
                const worn = item.category === 'armor'
                  ? item.itemId === normalizedCharacter.equippedBodyArmorId || item.itemId === normalizedCharacter.equippedHelmetId
                  : item.category === 'tool' && item.itemId === 'gas_mask' && normalizedCharacter.wearingGasMask;
                const minimumQuantity = worn ? 1 : 0;
                const totalWeight = unitWeight === undefined ? undefined : unitWeight * item.quantity;
                return (
                  <InventoryRow
                    key={`${item.category}:${item.itemId}`}
                    title={`${getItemName(item)}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`}
                    subtitle={`${weightLabel(unitWeight)}${totalWeight === undefined ? '' : ` · ${Number(totalWeight.toFixed(2))} lb total`}${worn ? ' · WORN' : ''}`}
                  >
                    <QuantityControl
                      colors={colors}
                      onMinus={() => changeQuantity(item, -1)}
                      onPlus={() => changeQuantity(item, 1)}
                      minusDisabled={item.quantity <= minimumQuantity}
                    />
                  </InventoryRow>
                );
              })}
          </InventorySection>
        );
      })}

      {inventoryItems.filter(item => item.category === 'ammo').map(item => {
        const rounds = item.quantity;
        const roundWeight = getAmmoRoundWeight(item);
        return (
          <View
            key={`ammo-config:${item.itemId}`}
            style={{ padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card, gap: 8 }}
          >
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 0.8 }}>
              {getItemName(item).toUpperCase()} · {rounds} ROUNDS
            </Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {(['round', 'box'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: (item.ammoWeightMode ?? 'box') === mode }}
                  onPress={() => updateStack(item, { ammoWeightMode: mode })}
                  style={{
                    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, borderWidth: 1,
                    borderColor: (item.ammoWeightMode ?? 'box') === mode ? colors.primary : colors.border,
                    backgroundColor: colors.secondary,
                  }}
                >
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: (item.ammoWeightMode ?? 'box') === mode ? colors.primary : colors.mutedForeground }}>
                    {mode === 'round' ? 'WEIGHT PER ROUND' : 'WEIGHT PER BOX'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {(item.ammoWeightMode ?? 'box') === 'round' ? (
              <TextInput
                testID={`ammo-weight-round-${item.itemId}`}
                value={item.weightPerUnit === undefined ? '' : String(item.weightPerUnit)}
                onChangeText={value => updateStack(item, { weightPerUnit: parseNonNegative(value) })}
                placeholder="Pounds per round"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.mutedForeground}
                style={{ padding: 8, borderRadius: 5, borderWidth: 1, borderColor: colors.border, color: colors.foreground }}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput
                  testID={`ammo-weight-box-${item.itemId}`}
                  value={item.weightPerBox === undefined ? '' : String(item.weightPerBox)}
                  onChangeText={value => updateStack(item, { weightPerBox: parseNonNegative(value) })}
                  placeholder="Pounds per box"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, padding: 8, borderRadius: 5, borderWidth: 1, borderColor: colors.border, color: colors.foreground }}
                />
                <TextInput
                  testID={`ammo-rounds-box-${item.itemId}`}
                  value={item.unitsPerBox === undefined ? '' : String(item.unitsPerBox)}
                  onChangeText={value => updateStack(item, { unitsPerBox: parsePositiveInteger(value) })}
                  placeholder="Rounds per box"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, padding: 8, borderRadius: 5, borderWidth: 1, borderColor: colors.border, color: colors.foreground }}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 9, color: colors.mutedForeground }}>
                {roundWeight === undefined
                  ? 'Set a weight to include these rounds in carry weight.'
                  : `${Number(roundWeight.toFixed(4))} lb per round · ${Number((roundWeight * rounds).toFixed(2))} lb total`}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  if (!item.unitsPerBox || item.unitsPerBox < 1) {
                    setNotice('Set rounds per box before adding a full box.');
                    return;
                  }
                  changeQuantity(item, item.unitsPerBox);
                }}
                style={sectionButtonStyle()}
              >
                <Feather name="plus" size={11} color={colors.primary} />
                <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>BOX</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {inventoryItems.filter(item => item.category !== 'ammo' && getItemWeight(item) === undefined).map(item => (
        <View
          key={`weight-config:${item.category}:${item.itemId}`}
          style={{ padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card, gap: 6 }}
        >
          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>{getItemName(item).toUpperCase()} · WEIGHT NOT IN MANUAL</Text>
          <TextInput
            testID={`inventory-item-weight-${item.category}-${item.itemId}`}
            value={item.weightPerUnit === undefined ? '' : String(item.weightPerUnit)}
            onChangeText={value => updateStack(item, { weightPerUnit: parseNonNegative(value) })}
            placeholder="Pounds per item"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.mutedForeground}
            style={{ padding: 8, borderRadius: 5, borderWidth: 1, borderColor: colors.border, color: colors.foreground }}
          />
        </View>
      ))}

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <View style={{ maxHeight: '80%', backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>
                ADD {picker === 'weapon' ? 'WEAPON' : picker?.toUpperCase()}
              </Text>
              <TouchableOpacity onPress={() => setPicker(null)} accessibilityLabel="Close inventory picker">
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 10, gap: 6 }}>
              {rows.map(item => {
                const estimated = picker === 'weapon'
                  ? weapons.find(profile => profile.id === item.id)?.weight
                  : picker === 'armor'
                    ? armor.find(profile => profile.id === item.id)?.weight
                    : picker === 'tool'
                      ? BUILT_IN_TOOLS.find(profile => profile.id === item.id)?.weight
                      : undefined;
                const disabled = !canCarryAdditionalWeight(estimated);
                return (
                  <TouchableOpacity
                    key={item.id}
                    testID={`inventory-select-${picker}-${item.id}`}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => selectPickerItem(item.id)}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondary,
                      opacity: disabled ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{item.name}</Text>
                    <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2 }}>
                      {disabled ? 'Exceeds carry capacity' : item.detail}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {rows.length === 0 && <Text style={{ padding: 12, color: colors.mutedForeground }}>No items available.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function parseNonNegative(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parsePositiveInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function InventorySection({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{title}</Text>
      {children}
    </View>
  );
}

function InventoryRow({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: 9,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{title}</Text>
        <Text style={{ fontSize: 9, color: colors.mutedForeground }}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function QuantityControl({
  colors,
  onMinus,
  onPlus,
  minusDisabled = false,
}: {
  colors: ReturnType<typeof useColors>;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Remove one"
        disabled={minusDisabled}
        onPress={onMinus}
        style={{ padding: 5, borderRadius: 5, borderWidth: 1, borderColor: colors.border, opacity: minusDisabled ? 0.4 : 1 }}
      >
        <Feather name="minus" size={12} color={colors.foreground} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Add one"
        onPress={onPlus}
        style={{ padding: 5, borderRadius: 5, borderWidth: 1, borderColor: colors.primary }}
      >
        <Feather name="plus" size={12} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function EmptyInventoryText() {
  const colors = useColors();
  return <Text style={{ fontSize: 10, color: colors.mutedForeground, fontStyle: 'italic' }}>None carried.</Text>;
}
