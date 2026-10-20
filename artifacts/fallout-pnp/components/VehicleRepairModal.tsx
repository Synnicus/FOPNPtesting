import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { VehicleProfile, VehicleRepairRecord } from '@/context/types';
import {
  resolveVehiclePerformance,
  resolveVehicleRepairAttempt,
  VEHICLE_REPAIR_HOURS,
} from '@/data/vehicles';

export interface VehicleRepairMechanic {
  id: string;
  name: string;
  repairSkill: number;
}

interface VehicleRepairModalProps {
  visible: boolean;
  vehicle: VehicleProfile | null;
  mechanics: VehicleRepairMechanic[];
  onClose: () => void;
  onApply: (vehicle: VehicleProfile, record: VehicleRepairRecord) => void;
}

function rollD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}

export function VehicleRepairModal({
  visible, vehicle, mechanics, onClose, onApply,
}: VehicleRepairModalProps) {
  const colors = useColors();
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [latestAttempt, setLatestAttempt] = useState<VehicleRepairRecord | null>(null);
  const systems = useMemo(
    () => vehicle ? resolveVehiclePerformance(vehicle).systems : [],
    [vehicle],
  );
  const selectedMechanic = mechanics.find(mechanic => mechanic.id === selectedMechanicId) ?? null;
  const selectedSystem = systems.find(system => system.id === selectedSystemId) ?? null;
  const systemCanBeRepaired = (system: typeof systems[number]) =>
    system.currentHp > 0 && system.currentHp < system.maxHp;

  useEffect(() => {
    if (!visible) return;
    setSelectedMechanicId(mechanics[0]?.id ?? '');
    setSelectedSystemId(systems.find(systemCanBeRepaired)?.id ?? '');
    setLatestAttempt(null);
  // Reset only when this modal opens or a different vehicle is selected.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vehicle?.id]);

  const handleRepair = () => {
    if (!vehicle || !selectedMechanic || !selectedSystem || !systemCanBeRepaired(selectedSystem)) return;
    const repairSkill = Math.max(0, Math.min(100, Math.floor(selectedMechanic.repairSkill)));
    const checkRoll = Math.floor(Math.random() * 100) + 1;
    const succeeded = checkRoll <= repairSkill;
    const repairDice = succeeded ? [rollD10(), rollD10(), rollD10()] : [];
    const result = resolveVehicleRepairAttempt(vehicle, {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      systemId: selectedSystem.id,
      mechanicCharacterId: selectedMechanic.id,
      mechanicName: selectedMechanic.name,
      repairSkill,
      checkRoll,
      repairDice,
      createdAt: new Date().toISOString(),
    });
    if (!result) return;
    setLatestAttempt(result.record);
    onApply(result.vehicle, result.record);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.82)', padding: 16 }}>
        <View style={{ maxHeight: '88%', overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Feather name="tool" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>REPAIR VEHICLE</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{vehicle?.name ?? ''}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close vehicle repair">
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 16 }}>
              {VEHICLE_REPAIR_HOURS} hours · Repair check · success restores 3d10 HP to one section.
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>MECHANIC</Text>
              {mechanics.length === 0 ? (
                <Text style={{ fontSize: 11, color: colors.destructive }}>No active characters are available to make a Repair check.</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {mechanics.map(mechanic => {
                    const active = mechanic.id === selectedMechanicId;
                    return (
                      <TouchableOpacity
                        key={mechanic.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSelectedMechanicId(mechanic.id)}
                        style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.secondary }}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: active ? colors.primaryForeground : colors.foreground }}>
                          {mechanic.name} · {Math.max(0, Math.min(100, Math.floor(mechanic.repairSkill)))}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>VEHICLE SECTION</Text>
              <View style={{ gap: 6 }}>
                {systems.map(system => {
                  const repairable = systemCanBeRepaired(system);
                  const active = system.id === selectedSystemId;
                  const status = system.currentHp <= 0
                    ? 'DESTROYED · REPLACEMENT REQUIRED'
                    : repairable ? 'DAMAGED' : 'FULL HP';
                  return (
                    <TouchableOpacity
                      key={system.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active, disabled: !repairable }}
                      disabled={!repairable}
                      onPress={() => setSelectedSystemId(system.id)}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 9, borderRadius: 6, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '22' : colors.secondary, opacity: repairable ? 1 : 0.65 }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{system.name}</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: system.currentHp <= 0 ? colors.destructive : colors.mutedForeground }}>{status}</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{system.currentHp}/{system.maxHp} HP</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {systems.length > 0 && !systems.some(systemCanBeRepaired) && (
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>No repairable sections remain. Destroyed sections must be replaced.</Text>
            )}

            <TouchableOpacity
              testID="vehicle-repair-roll"
              accessibilityRole="button"
              disabled={!selectedMechanic || !selectedSystem || !systemCanBeRepaired(selectedSystem)}
              onPress={handleRepair}
              style={{ paddingVertical: 11, alignItems: 'center', borderRadius: 7, backgroundColor: colors.primary, opacity: selectedMechanic && selectedSystem && systemCanBeRepaired(selectedSystem) ? 1 : 0.45 }}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>ROLL REPAIR</Text>
            </TouchableOpacity>

            {latestAttempt && (
              <View testID="vehicle-repair-result" style={{ padding: 10, borderRadius: 7, borderWidth: 1, borderColor: latestAttempt.succeeded ? colors.primary : colors.destructive, backgroundColor: colors.secondary, gap: 3 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: latestAttempt.succeeded ? colors.primary : colors.destructive }}>
                  {latestAttempt.succeeded ? 'SUCCESS' : 'FAILED'} · {latestAttempt.systemName}
                </Text>
                <Text style={{ fontSize: 11, color: colors.foreground }}>
                  <Text>Repair check:</Text> {latestAttempt.checkRoll} vs {latestAttempt.repairSkill}%
                </Text>
                {latestAttempt.succeeded ? (
                  <Text style={{ fontSize: 11, color: colors.foreground }}>
                    <Text>3d10:</Text> {latestAttempt.repairDice.join(' + ')} = {latestAttempt.rolledRepairHp} · <Text>HP restored:</Text> {latestAttempt.restoredHp}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>No HP restored.</Text>
                )}
              </View>
            )}

            {(vehicle?.repairHistory?.length ?? 0) > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>REPAIR HISTORY</Text>
                {[...(vehicle?.repairHistory ?? [])].reverse().slice(0, 8).map(record => (
                  <View key={record.id} style={{ padding: 8, borderRadius: 6, backgroundColor: colors.secondary }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: record.succeeded ? colors.primary : colors.destructive }}>
                      {record.succeeded ? 'SUCCESS' : 'FAILED'} · {record.systemName} · {record.mechanicName}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.foreground }}>
                      <Text>Repair check:</Text> {record.checkRoll} vs {record.repairSkill}%
                    </Text>
                    {record.succeeded ? (
                      <Text style={{ fontSize: 10, color: colors.foreground }}>
                        <Text>3d10:</Text> {record.repairDice.join(' + ')} = {record.rolledRepairHp} · <Text>HP restored:</Text> {record.restoredHp}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 10, color: colors.mutedForeground }}>No HP restored.</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: 8, borderRadius: 6, backgroundColor: colors.secondary }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
