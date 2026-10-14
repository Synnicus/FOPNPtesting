import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Armor, Character, Weapon, WeaponAmmoState } from '@/context/types';
import { armorConditionModifier, armorHits, setArmorHits } from '@/data/armorCondition';
import { computeModEffects } from '@/data/mods';
import { CONDITION_BOXES_MAX, clampConditionBoxes, conditionLabel } from '@/data/condition';

type SetChar = (fn: (c: Character) => Character) => void;

/** Row of tappable segments. Tapping segment n sets the count to n, or n-1 when n is already the top filled one. */
function Meter({ label, count, total, onSet, color }: {
  label: string; count: number; total: number; onSet: (n: number) => void; color: string;
}) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}: ${count} of ${total}`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => onSet(e.nativeEvent.actionName === 'increment' ? Math.min(total, count + 1) : Math.max(0, count - 1))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <TouchableOpacity accessibilityLabel={`Decrease ${label}`} onPress={() => onSet(Math.max(0, count - 1))} style={{ width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="minus" size={14} color={colors.foreground} />
      </TouchableOpacity>
      <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const filled = n <= count;
          return (
            <TouchableOpacity
              key={n}
              accessibilityLabel={`${label} segment ${n}`}
              accessibilityState={{ selected: filled }}
              onPress={() => onSet(n === count ? n - 1 : n)}
              style={{ flex: 1, height: 28, borderRadius: 3, borderWidth: 1, borderColor: filled ? color : colors.border, backgroundColor: filled ? color : colors.background }}
            />
          );
        })}
      </View>
      <TouchableOpacity accessibilityLabel={`Increase ${label}`} onPress={() => onSet(Math.min(total, count + 1))} style={{ width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="plus" size={14} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

function RepairButton({ label, detail, disabled, onConfirm }: { label: string; detail: string; disabled: boolean; onConfirm: () => void }) {
  const colors = useColors();
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <View style={{ gap: 6, padding: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary }}>
        <Text style={{ fontSize: 12, color: colors.foreground, fontFamily: 'Inter_400Regular' }}>GM confirms: {detail}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity accessibilityRole="button" onPress={() => { setArmed(false); onConfirm(); }} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, backgroundColor: colors.primary }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>CONFIRM REPAIR</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setArmed(false)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>NOT YET</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={() => setArmed(true)} style={{ minHeight: 40, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, opacity: disabled ? 0.35 : 1 }}>
      <Feather name="tool" size={13} color={colors.primary} />
      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 0.5 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const setHitsOn = (setChar: SetChar, id: string, hits: number) =>
  setChar(c => ({ ...c, armorConditionStates: setArmorHits(c.armorConditionStates, id, hits) }));

/** Rendered directly under a body or helmet selection slot. */
export function ArmorConditionMeter({ char, setChar, armor, inactive }: { char: Character; setChar: SetChar; armor?: Armor; inactive?: boolean }) {
  const colors = useColors();
  if (!armor) return null;
  const hits = armorHits(char.armorConditionStates, armor.id);
  const boxes = Math.floor(hits / 5);
  const pen = Math.round(armorConditionModifier(hits) * 100);
  const setHits = (n: number) => setHitsOn(setChar, armor.id, n);
  const stepBtn = { width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ gap: 6, padding: 12, marginTop: -6, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      {inactive && (
        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive }}>
          Inactive: this helmet contributes no protection while the suit prohibits, integrates or is incompatible with it. Stored condition is kept.
        </Text>
      )}
      <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>
        Ten bars, five hit segments each. Chart by boxes: 0-3 none, 4 5%, 5 10%, 6 20%, 7 30%, 8 40%, 9 50%, 10 60% (DT/DR only, AC unchanged). Aimed head or eyes hits wear a separate valid helmet; other hits wear the body armor or integrated suit.
      </Text>
      <View accessible accessibilityRole="adjustable" accessibilityLabel={`${armor.name} hits: ${hits} of 50`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => setHits(hits + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TouchableOpacity accessibilityLabel={`Remove one hit from ${armor.name}`} onPress={() => setHits(hits - 1)} style={stepBtn}>
          <Feather name="minus" size={14} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: 10 }, (_, bar) => (
            <View key={bar} style={{ width: '18%', flexGrow: 1, flexDirection: 'row', gap: 1 }}>
              {Array.from({ length: 5 }, (_, seg) => {
                const g = bar * 5 + seg + 1;
                const filled = g <= hits;
                return (
                  <TouchableOpacity key={g} accessibilityLabel={`${armor.name} hit segment ${g}`} accessibilityState={{ selected: filled }}
                    onPress={() => setHits(g === hits ? g - 1 : g)}
                    style={{ flex: 1, height: 26, borderWidth: 1, borderRadius: 2, borderColor: filled ? colors.destructive : colors.border, backgroundColor: filled ? colors.destructive : colors.background }} />
                );
              })}
            </View>
          ))}
        </View>
        <TouchableOpacity accessibilityLabel={`Add one hit to ${armor.name}`} onPress={() => setHits(hits + 1)} style={stepBtn}>
          <Feather name="plus" size={14} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: pen > 0 ? colors.destructive : colors.foreground }}>
        {hits}/50 hits · {boxes}/10 boxes · {pen > 0 ? `DT/DR -${pen}% (AC unchanged)` : 'No DT/DR penalty'}
      </Text>
      <RepairButton label="REPAIR ARMOR" detail="Repair succeeded and took 4 hours. Clears 2 boxes (10 hit segments)."
        disabled={hits === 0} onConfirm={() => setHits(Math.max(0, hits - 10))} />
    </View>
  );
}

/** Rendered immediately beneath a carried weapon entry. */
export function WeaponConditionMeter({ char, setChar, weapon }: { char: Character; setChar: SetChar; weapon: Weapon }) {
  const colors = useColors();
  const boxes = clampConditionBoxes(char.weaponAmmoStates?.find(s => s.weaponId === weapon.id)?.conditionBoxes ?? 0);
  const setBoxes = (boxesNext: number) =>
    setChar(c => {
      const states = c.weaponAmmoStates ?? [];
      const n = clampConditionBoxes(boxesNext);
      const next: WeaponAmmoState[] = states.some(s => s.weaponId === weapon.id)
        ? states.map(s => s.weaponId === weapon.id ? { ...s, conditionBoxes: n } : s)
        : [...states, { weaponId: weapon.id, currentAmmo: Math.round(weapon.magazineSize * computeModEffects(weapon).magazineMult), conditionBoxes: n }];
      return { ...c, weaponAmmoStates: next };
    });
  return (
    <View style={{ gap: 6, padding: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      <Meter label={`${weapon.name} condition`} count={boxes} total={CONDITION_BOXES_MAX} color={boxes >= 8 ? colors.destructive : colors.primary} onSet={setBoxes} />
      <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>{boxes}/10 boxes · {conditionLabel(boxes)}</Text>
      <RepairButton label="REPAIR WEAPON (-2 BOXES)" detail="Successful Repair roll, 1 hour. Clears 2 boxes."
        disabled={boxes === 0} onConfirm={() => setBoxes(boxes - 2)} />
      <RepairButton label="WEAPON SKILL FALLBACK (-1 BOX)" detail="Repair failed, but the weapon skill roll succeeded. Clears exactly 1 box temporarily; the GM tracks this temporary fix."
        disabled={boxes === 0} onConfirm={() => setBoxes(boxes - 1)} />
    </View>
  );
}
