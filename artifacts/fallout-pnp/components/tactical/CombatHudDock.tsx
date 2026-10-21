import React from 'react';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LocalizedText as Text } from '@/components/LocalizedText';
import type { Character } from '@/context/types';
import { useColors } from '@/hooks/useColors';
import CombatantPortrait from './CombatantPortrait';
import { tr } from './i18n';

export interface CombatHudModeCost {
  key: 'S' | 'A' | 'B' | 'D';
  name: 'Single' | 'Targeted' | 'Burst' | 'Double';
  ap: number;
}

export interface CombatHudWeaponSlot {
  id: string;
  hand: string;
  name: string;
  modes: CombatHudModeCost[];
}

interface CombatHudDockProps {
  attacker: Character | null;
  active: boolean;
  currentAP: number;
  maxAP: number;
  weaponSlots: CombatHudWeaponSlot[];
  selectedWeaponId: string | null;
  selectedFireMode: CombatHudModeCost['key'];
  logEntries: string[];
  compact: boolean;
  bottomInset: number;
  onSelectWeapon: (id: string) => void;
  onSelectFireMode: (mode: CombatHudModeCost['key']) => void;
  targeting: boolean;
  canAttack: boolean;
  onTarget: () => void;
  onAttack: () => void;
  onOpenActions: () => void;
  onEndTurn: () => void;
  endTurnLabel?: string;
  canEndTurn: boolean;
}

export default function CombatHudDock({
  attacker, active, currentAP, maxAP, weaponSlots, selectedWeaponId,
  selectedFireMode, logEntries, compact, bottomInset, onSelectWeapon, onSelectFireMode,
  targeting, canAttack, onTarget, onAttack, onOpenActions, onEndTurn, endTurnLabel = 'END TURN', canEndTurn,
}: CombatHudDockProps) {
  const colors = useColors();
  const ap = Math.max(0, currentAP);
  const apLimit = Math.max(1, maxAP);
  const apPercent = Math.min(100, Math.round((ap / apLimit) * 100));

  return (
    <View
      testID="combat-hud-dock"
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: compact ? 5 : 8,
        paddingHorizontal: compact ? 7 : 12,
        paddingTop: 7,
        paddingBottom: Math.max(bottomInset, Platform.OS === 'web' ? 12 : 7),
        borderTopWidth: 2,
        borderTopColor: colors.primary,
        backgroundColor: colors.card,
      }}
    >
      <View style={{
        width: compact ? 82 : 190,
        minWidth: compact ? 72 : 150,
        paddingHorizontal: 6,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 5,
        backgroundColor: colors.background,
        justifyContent: 'center',
      }}>
        <Text style={{ color: colors.primary, fontSize: compact ? 7 : 9, fontWeight: '900', letterSpacing: 1 }}>
          {tr('COMBAT LOG')}
        </Text>
        <View style={{ marginTop: 3, gap: 2 }}>
          {(logEntries.length ? logEntries.slice(-2).reverse() : [tr('Select a combatant to view controls.')]).map((entry, index) => (
            <Text
              key={`${index}-${entry}`}
              numberOfLines={compact ? 2 : 1}
              style={{
                color: index === 0 ? colors.foreground : colors.mutedForeground,
                fontSize: compact ? 8 : 10,
                lineHeight: compact ? 10 : 13,
                opacity: index === 0 ? 1 : 0.72,
              }}
            >
              {entry}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ width: compact ? 46 : 62, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <CombatantPortrait character={attacker ?? undefined} size={compact ? 42 : 56} active={active} />
        <Text numberOfLines={1} style={{ maxWidth: compact ? 48 : 66, color: colors.foreground, fontSize: compact ? 7 : 9, fontWeight: '700', textAlign: 'center' }}>
          {attacker?.name ?? tr('No attacker')}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 5 }}>
        <View style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: compact ? 8 : 9, fontWeight: '800', letterSpacing: 1 }}>
              {tr('AP REMAINING')}
            </Text>
            <Text
              accessibilityLabel={tr('AP {0}/{1}', ap, maxAP)}
              style={{ color: colors.primary, fontSize: compact ? 10 : 12, fontWeight: '900', fontVariant: ['tabular-nums'] }}
            >
              {tr('AP {0}/{1}', ap, maxAP)}
            </Text>
          </View>
          <View style={{ height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.border }}>
            <View style={{ width: `${apPercent}%`, height: '100%', backgroundColor: colors.primary }} />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, alignItems: 'stretch' }}>
          {weaponSlots.length ? weaponSlots.map(slot => {
            const selected = slot.id === selectedWeaponId;
            const costSummary = slot.modes.map(mode => `${mode.key}${mode.ap}`).join(' ');
            const accessibleModes = slot.modes.map(mode => `${tr(mode.name)} ${mode.ap} AP`).join(', ');
            return (
              <TouchableOpacity
                key={`${slot.hand}-${slot.id}`}
                testID={`combat-hud-weapon-${slot.id}`}
                accessibilityRole="button"
                accessibilityLabel={tr('Select weapon {0}', `${slot.hand}, ${slot.name}. ${accessibleModes}`)}
                accessibilityState={{ selected }}
                onPress={() => onSelectWeapon(slot.id)}
                style={{
                  minWidth: compact ? 67 : 94,
                  maxWidth: compact ? 110 : 168,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  justifyContent: 'center',
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? colors.primary : colors.border,
                  borderRadius: 4,
                  backgroundColor: selected ? colors.secondary : colors.background,
                  opacity: attacker ? 1 : 0.55,
                }}
              >
                <Text numberOfLines={1} style={{ color: selected ? colors.primary : colors.mutedForeground, fontSize: 7, fontWeight: '800', letterSpacing: 0.5 }}>
                  {slot.hand.toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: compact ? 8 : 10, fontWeight: '800' }}>
                  {slot.name}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 7, fontVariant: ['tabular-nums'] }}>
                  {costSummary || '—'}
                </Text>
              </TouchableOpacity>
            );
          }) : (
            <View style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{tr('No weapons in hand')}</Text>
            </View>
          )}
        </ScrollView>
        {(() => {
          const selected = weaponSlots.find(slot => slot.id === selectedWeaponId);
          return selected?.modes.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, alignItems: 'center' }}>
              {selected.modes.map(mode => {
                const isSelected = mode.key === selectedFireMode;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    testID={`combat-hud-fire-mode-${mode.key.toLowerCase()}`}
                    accessibilityRole="button"
                    accessibilityLabel={tr('Select {0} attack mode, {1} AP', tr(mode.name), mode.ap)}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onSelectFireMode(mode.key)}
                    style={{
                      minWidth: compact ? 47 : 68,
                      paddingHorizontal: compact ? 4 : 7,
                      paddingVertical: 3,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: 4,
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      alignItems: 'center',
                      opacity: attacker ? 1 : 0.55,
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: compact ? 6 : 8, fontWeight: '900', letterSpacing: 0.3 }}>
                      {tr(mode.name).toUpperCase()}
                    </Text>
                    <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: compact ? 6 : 7 }}>
                      {mode.ap} AP
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null;
        })()}
      </View>

      <View style={{ width: compact ? 108 : 166, flexDirection: 'row', gap: 4 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <TouchableOpacity
            testID="combat-hud-target"
            accessibilityRole="button"
            accessibilityLabel={tr(targeting ? 'Cancel target selection' : 'Select a defender')}
            accessibilityState={{ selected: targeting }}
            onPress={onTarget}
            style={{
              flex: 1,
              minHeight: 34,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderWidth: 1,
              borderColor: targeting ? colors.primary : colors.border,
              borderRadius: 5,
              backgroundColor: targeting ? colors.primary : colors.background,
            }}
          >
            <Feather name="target" size={compact ? 12 : 15} color={targeting ? colors.primaryForeground : colors.primary} />
            <Text style={{ color: targeting ? colors.primaryForeground : colors.primary, fontSize: compact ? 6 : 8, fontWeight: '900' }}>
              {tr('TARGET')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="combat-hud-attack"
            accessibilityRole="button"
            accessibilityLabel={tr('Open attack roll')}
            accessibilityState={{ disabled: !canAttack }}
            disabled={!canAttack}
            onPress={onAttack}
            style={{
              flex: 1,
              minHeight: 34,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 5,
              backgroundColor: colors.secondary,
              opacity: canAttack ? 1 : 0.45,
            }}
          >
            <Feather name="crosshair" size={compact ? 12 : 15} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: compact ? 6 : 8, fontWeight: '900' }}>
              {tr('ATTACK')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
        <TouchableOpacity
          testID="combat-hud-open-actions"
          accessibilityRole="button"
          accessibilityLabel={tr('Open combat actions')}
          onPress={onOpenActions}
          style={{
            flex: 1,
            minHeight: 34,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 5,
            backgroundColor: colors.secondary,
          }}
        >
          <Feather name="menu" size={compact ? 15 : 18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: compact ? 7 : 9, fontWeight: '900', letterSpacing: compact ? 0.5 : 1 }}>
            {tr('ACTIONS')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="combat-hud-end-turn"
          accessibilityRole="button"
          accessibilityLabel={tr(endTurnLabel === 'END VEHICLE TURN' ? 'End vehicle turn' : 'End turn')}
          accessibilityState={{ disabled: !canEndTurn }}
          disabled={!canEndTurn}
          onPress={onEndTurn}
          style={{
            flex: 1,
            minHeight: 34,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 5,
            backgroundColor: colors.background,
            opacity: canEndTurn ? 1 : 0.5,
          }}
        >
          <Feather name="skip-forward" size={compact ? 12 : 14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: compact ? 6 : 8, fontWeight: '900', letterSpacing: 0.3 }}>
            {tr(endTurnLabel)}
          </Text>
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
