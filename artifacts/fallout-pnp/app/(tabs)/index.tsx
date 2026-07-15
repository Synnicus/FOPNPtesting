import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Armor, Character, Weapon } from '@/context/types';
import CharacterAvatar from '@/components/CharacterAvatar';
import HPBar from '@/components/HPBar';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

function rollD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}
function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

interface ShotResult {
  index: number;
  penalty: number;
  attackTotal: number;
  hit: boolean;
  margin: number;
  cpsEarned: number;
}

interface ShotDamage {
  shotIndex: number;
  baseRolls: number[];
  baseDmg: number;
  cpRolls: number[];
  cpBonusDmg: number;
  combinedDT: number;
  finalDmg: number;
}

// ─── Character Picker Modal ─────────────────────────────────────────────────

function CharacterPickerModal({
  visible,
  onClose,
  onSelect,
  title,
  characters,
  allWeapons,
  allArmor,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  title: string;
  characters: Character[];
  allWeapons: Weapon[];
  allArmor: Armor[];
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ maxHeight: '80%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {characters.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
                No characters yet. Add them in the Characters tab.
              </Text>
            </View>
          ) : (
            <FlatList
              data={characters}
              keyExtractor={c => c.id}
              renderItem={({ item: c }) => {
                const weapon = allWeapons.find(w => w.id === c.equippedWeaponId);
                return (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => { onSelect(c.id); onClose(); }}
                  >
                    <CharacterAvatar portrait={c.portrait} name={c.name} size={40} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{c.name}</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                        HP {c.currentHp}/{c.maxHp} · Evasion {c.evasion} {weapon ? `· ${weapon.name}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: c.type === 'pc' ? colors.primary : colors.destructive }}>
                      {c.type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Animated Die ────────────────────────────────────────────────────────────

function DieFace({ value, rolling }: { value: number | null; rolling: boolean }) {
  const colors = useColors();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (rolling) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 80 }),
        withTiming(0.9, { duration: 80 }),
        withTiming(1.08, { duration: 60 }),
        withTiming(1, { duration: 60 }),
      );
    }
  }, [value, rolling]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          width: 72,
          height: 72,
          borderRadius: 12,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondary,
          borderColor: rolling ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={{ fontSize: 32, fontFamily: 'Inter_700Bold', color: value !== null ? colors.primary : colors.mutedForeground }}>
        {value !== null ? value : '?'}
      </Text>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: -4, color: colors.mutedForeground }}>d10</Text>
    </Animated.View>
  );
}

// ─── Main Combat Screen ──────────────────────────────────────────────────────

export default function CombatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { characters, allWeapons, allArmor, applyDamage } = useApp();

  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [defenderId, setDefenderId] = useState<string | null>(null);
  const [die1, setDie1] = useState<number | null>(null);
  const [die2, setDie2] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [isBurst, setIsBurst] = useState(false);
  const [burstShots, setBurstShots] = useState(1);
  const [cpSpent, setCpSpent] = useState<number[]>([]);
  const [shotDamages, setShotDamages] = useState<(ShotDamage | null)[] | null>(null);
  const [showAttackerPicker, setShowAttackerPicker] = useState(false);
  const [showDefenderPicker, setShowDefenderPicker] = useState(false);
  const [damageApplied, setDamageApplied] = useState(false);

  const attacker = characters.find(c => c.id === attackerId) ?? null;
  const defender = characters.find(c => c.id === defenderId) ?? null;
  const weapon = attacker?.equippedWeaponId ? allWeapons.find(w => w.id === attacker.equippedWeaponId) ?? null : null;
  const bodyArmor = defender?.equippedBodyArmorId ? allArmor.find(a => a.id === defender.equippedBodyArmorId) ?? null : null;
  const helmet = defender?.equippedHelmetId ? allArmor.find(a => a.id === defender.equippedHelmetId) ?? null : null;

  const maxShots = (isBurst && weapon && weapon.burstLimit > 1) ? burstShots : 1;
  const shotPenalties = Array.from({ length: maxShots }, (_, i) => (i === 0 ? 0 : i === 1 ? -5 : -10));

  const shotResults: ShotResult[] = (die1 !== null && die2 !== null && attacker && defender && weapon)
    ? shotPenalties.map((penalty, i) => {
        const skill = attacker.skills[weapon.skill];
        const total = die1 + die2 + skill + penalty;
        const hit = total >= defender.evasion;
        const margin = total - defender.evasion;
        const cpsEarned = hit ? Math.floor(margin / 5) : 0;
        return { index: i, penalty, attackTotal: total, hit, margin, cpsEarned };
      })
    : [];

  // Reset CP spent when roll or combatants change
  useEffect(() => {
    setCpSpent(shotResults.map(() => 0));
    setShotDamages(null);
    setDamageApplied(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [die1, die2, attackerId, defenderId, isBurst, burstShots]);

  // Reset burst toggle when attacker changes
  useEffect(() => {
    setIsBurst(false);
    setBurstShots(1);
  }, [attackerId]);

  const rollDice = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRolling(true);
    setDie1(rollD10());
    setDie2(rollD10());
    setShotDamages(null);
    setDamageApplied(false);
    setTimeout(() => setRolling(false), 350);
  }, []);

  const toggleCPSpent = useCallback((shotIdx: number, delta: number) => {
    setCpSpent(prev => {
      const next = [...prev];
      const maxCp = shotResults[shotIdx]?.cpsEarned ?? 0;
      next[shotIdx] = Math.max(0, Math.min(maxCp, (next[shotIdx] ?? 0) + delta));
      return next;
    });
    setShotDamages(null);
    setDamageApplied(false);
  }, [shotResults]);

  const calculateDamage = useCallback(() => {
    if (!weapon || shotResults.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const halfDie = Math.ceil(weapon.damageDie / 2);
    const dtKey = weapon.damageType === 'normal' ? 'dtNormal' : weapon.damageType === 'bio' ? 'dtBio' : 'dtEnergy';
    const combinedDT = (bodyArmor ? (bodyArmor as Record<string, number>)[dtKey] ?? 0 : 0)
      + (helmet ? (helmet as Record<string, number>)[dtKey] ?? 0 : 0);

    const damages = shotResults.map((shot, i) => {
      if (!shot.hit) return null;
      const baseRolls = Array.from({ length: weapon.damageDieCount }, () => rollDie(weapon.damageDie));
      const baseDmg = baseRolls.reduce((a, b) => a + b, 0) + weapon.damageBonus;
      const cps = cpSpent[i] ?? 0;
      const cpRolls = Array.from({ length: cps }, () => rollDie(halfDie));
      const cpBonusDmg = cpRolls.reduce((a, b) => a + b, 0);
      const finalDmg = Math.max(0, baseDmg + cpBonusDmg - combinedDT);
      return { shotIndex: i, baseRolls, baseDmg, cpRolls, cpBonusDmg, combinedDT, finalDmg };
    });
    setShotDamages(damages);
    setDamageApplied(false);
  }, [weapon, shotResults, cpSpent, bodyArmor, helmet]);

  const totalDamage = shotDamages
    ? shotDamages.reduce((sum, d) => sum + (d?.finalDmg ?? 0), 0)
    : 0;

  const handleApplyDamage = useCallback(() => {
    if (!defender || totalDamage === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    applyDamage(defender.id, totalDamage);
    setDamageApplied(true);
  }, [defender, totalDamage, applyDamage]);

  const dtKey = weapon?.damageType === 'normal' ? 'dtNormal' : weapon?.damageType === 'bio' ? 'dtBio' : 'dtEnergy';
  const combinedDT = (bodyArmor ? (bodyArmor as Record<string, number>)[dtKey ?? 'dtNormal'] ?? 0 : 0)
    + (helmet ? (helmet as Record<string, number>)[dtKey ?? 'dtNormal'] ?? 0 : 0);

  const s = makeStyles(colors);

  return (
    <View style={[s.screen, { paddingTop: Platform.OS === 'web' ? 67 : 0 }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={s.screenTitle}>COMBAT CALCULATOR</Text>
        <Text style={s.screenSub}>Joshua Sawyer Fallout PnP 2.0</Text>

        {/* ─── Combatants ─── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>COMBATANTS</Text>
          <View style={s.row}>
            {/* Attacker */}
            <TouchableOpacity
              style={[s.combatantSlot, { borderColor: attacker ? colors.primary : colors.border }]}
              onPress={() => setShowAttackerPicker(true)}
            >
              {attacker ? (
                <>
                  <CharacterAvatar portrait={attacker.portrait} name={attacker.name} size={44} />
                  <View style={s.combatantInfo}>
                    <Text style={[s.combatantName, { color: colors.foreground }]} numberOfLines={1}>{attacker.name}</Text>
                    <Text style={[s.combatantSub, { color: colors.primary }]}>
                      {weapon ? weapon.name : 'No weapon'}
                    </Text>
                    {weapon && (
                      <Text style={[s.combatantSub, { color: colors.mutedForeground }]}>
                        Skill: {attacker.skills[weapon.skill]}
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                <View style={s.combatantEmpty}>
                  <Feather name="plus-circle" size={22} color={colors.mutedForeground} />
                  <Text style={[s.combatantEmptyText, { color: colors.mutedForeground }]}>Attacker</Text>
                </View>
              )}
              <Text style={[s.combatantTag, { color: colors.primary }]}>ATK</Text>
            </TouchableOpacity>

            <Feather name="arrow-right" size={20} color={colors.mutedForeground} style={{ alignSelf: 'center' }} />

            {/* Defender */}
            <TouchableOpacity
              style={[s.combatantSlot, { borderColor: defender ? colors.destructive : colors.border }]}
              onPress={() => setShowDefenderPicker(true)}
            >
              {defender ? (
                <>
                  <CharacterAvatar portrait={defender.portrait} name={defender.name} size={44} />
                  <View style={s.combatantInfo}>
                    <Text style={[s.combatantName, { color: colors.foreground }]} numberOfLines={1}>{defender.name}</Text>
                    <Text style={[s.combatantSub, { color: colors.destructive }]}>
                      Evasion: {defender.evasion}
                    </Text>
                    <Text style={[s.combatantSub, { color: colors.mutedForeground }]}>
                      DT {weapon?.damageType?.toUpperCase() ?? 'NRM'}: {combinedDT}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={s.combatantEmpty}>
                  <Feather name="plus-circle" size={22} color={colors.mutedForeground} />
                  <Text style={[s.combatantEmptyText, { color: colors.mutedForeground }]}>Defender</Text>
                </View>
              )}
              <Text style={[s.combatantTag, { color: colors.destructive }]}>DEF</Text>
            </TouchableOpacity>
          </View>
          {/* Defender HP */}
          {defender && (
            <View style={{ marginTop: 10 }}>
              <HPBar current={defender.currentHp} max={defender.maxHp} height={6} showText />
            </View>
          )}
        </View>

        {/* ─── Roll Dice ─── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>ATTACK ROLL (2d10)</Text>
          <View style={s.diceRow}>
            <DieFace value={die1} rolling={rolling} />
            <Text style={[s.dicePlus, { color: colors.mutedForeground }]}>+</Text>
            <DieFace value={die2} rolling={rolling} />
            {die1 !== null && die2 !== null && (
              <>
                <Text style={[s.dicePlus, { color: colors.mutedForeground }]}>= {die1 + die2}</Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={[s.rollButton, { backgroundColor: colors.primary }]}
            onPress={rollDice}
            disabled={!attacker || !defender || !weapon}
          >
            <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
            <Text style={[s.rollButtonText, { color: colors.primaryForeground }]}>ROLL 2d10</Text>
          </TouchableOpacity>
          {(!attacker || !defender || !weapon) && (
            <Text style={[s.hint, { color: colors.mutedForeground }]}>
              Select an attacker with a weapon and a defender first.
            </Text>
          )}
        </View>

        {/* ─── Burst Fire ─── */}
        {weapon && weapon.burstLimit > 1 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>BURST FIRE</Text>
            <View style={s.burstRow}>
              <TouchableOpacity
                style={[s.toggleBtn, { backgroundColor: !isBurst ? colors.primary : colors.secondary, borderColor: colors.border }]}
                onPress={() => setIsBurst(false)}
              >
                <Text style={[s.toggleBtnText, { color: !isBurst ? colors.primaryForeground : colors.mutedForeground }]}>SINGLE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, { backgroundColor: isBurst ? colors.primary : colors.secondary, borderColor: colors.border }]}
                onPress={() => setIsBurst(true)}
              >
                <Text style={[s.toggleBtnText, { color: isBurst ? colors.primaryForeground : colors.mutedForeground }]}>BURST</Text>
              </TouchableOpacity>
            </View>
            {isBurst && (
              <View style={s.shotsRow}>
                <Text style={[s.shotsLabel, { color: colors.foreground }]}>Shots:</Text>
                <TouchableOpacity
                  style={[s.stepBtn, { borderColor: colors.border }]}
                  onPress={() => setBurstShots(s => Math.max(1, s - 1))}
                >
                  <Feather name="minus" size={16} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[s.shotsValue, { color: colors.primary }]}>{burstShots}</Text>
                <TouchableOpacity
                  style={[s.stepBtn, { borderColor: colors.border }]}
                  onPress={() => setBurstShots(s => Math.min(weapon.burstLimit, s + 1))}
                >
                  <Feather name="plus" size={16} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[s.shotsHint, { color: colors.mutedForeground }]}>(max {weapon.burstLimit})</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Shot Results ─── */}
        {shotResults.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>SHOT RESULTS</Text>
            {shotResults.map((shot, i) => (
              <View key={i} style={[s.shotRow, { borderBottomColor: colors.border }]}>
                <View style={[s.shotIndicator, { backgroundColor: shot.hit ? '#4a8c3f' : colors.destructive }]}>
                  <Text style={[s.shotIndicatorText, { color: '#fff' }]}>{shot.hit ? 'HIT' : 'MISS'}</Text>
                </View>
                <View style={s.shotDetails}>
                  <Text style={[s.shotText, { color: colors.foreground }]}>
                    Shot {i + 1}
                    {shot.penalty !== 0 && (
                      <Text style={{ color: colors.mutedForeground }}> ({shot.penalty})</Text>
                    )}
                    {'  '}
                    <Text style={{ color: colors.primary }}>{shot.attackTotal}</Text>
                    {' vs '}
                    <Text style={{ color: colors.destructive }}>{defender?.evasion}</Text>
                  </Text>
                  {shot.hit && (
                    <Text style={[s.shotCp, { color: colors.primary }]}>
                      Margin +{shot.margin} → {shot.cpsEarned} CP{shot.cpsEarned !== 1 ? 's' : ''} earned
                    </Text>
                  )}
                </View>
                {/* CP Spending */}
                {shot.hit && shot.cpsEarned > 0 && (
                  <View style={s.cpRow}>
                    <Text style={[s.cpLabel, { color: colors.mutedForeground }]}>Spend CP:</Text>
                    <TouchableOpacity
                      style={[s.cpBtn, { borderColor: colors.border }]}
                      onPress={() => toggleCPSpent(i, -1)}
                    >
                      <Feather name="minus" size={14} color={colors.foreground} />
                    </TouchableOpacity>
                    <Text style={[s.cpValue, { color: colors.primary }]}>
                      {cpSpent[i] ?? 0}/{shot.cpsEarned}
                    </Text>
                    <TouchableOpacity
                      style={[s.cpBtn, { borderColor: colors.border }]}
                      onPress={() => toggleCPSpent(i, 1)}
                    >
                      <Feather name="plus" size={14} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ─── Damage ─── */}
        {shotResults.some(s => s.hit) && weapon && (
          <View style={s.card}>
            <Text style={s.cardLabel}>DAMAGE CALCULATION</Text>
            <View style={s.damageInfo}>
              <Text style={[s.damageInfoText, { color: colors.mutedForeground }]}>
                Weapon: {weapon.damageDieCount}d{weapon.damageDie}{weapon.damageBonus > 0 ? `+${weapon.damageBonus}` : ''}
                {'  ·  '}
                Type: {weapon.damageType.toUpperCase()}
                {'  ·  '}
                Critical die: d{Math.ceil(weapon.damageDie / 2)}
              </Text>
              <Text style={[s.damageInfoText, { color: colors.mutedForeground }]}>
                Combined DT ({weapon.damageType.toUpperCase()}): {combinedDT}
              </Text>
            </View>

            {!shotDamages ? (
              <TouchableOpacity
                style={[s.rollButton, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary }]}
                onPress={calculateDamage}
              >
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={[s.rollButtonText, { color: colors.primary }]}>ROLL DAMAGE</Text>
              </TouchableOpacity>
            ) : (
              <>
                {shotDamages.map((dmg, i) => {
                  if (!dmg) return (
                    <View key={i} style={[s.dmgShotRow, { borderColor: colors.border }]}>
                      <Text style={[s.dmgShotLabel, { color: colors.mutedForeground }]}>Shot {i + 1}: MISS</Text>
                    </View>
                  );
                  return (
                    <View key={i} style={[s.dmgShotRow, { borderColor: colors.border }]}>
                      <Text style={[s.dmgShotLabel, { color: colors.primary }]}>Shot {i + 1}</Text>
                      <Text style={[s.dmgRollText, { color: colors.foreground }]}>
                        Base: [{dmg.baseRolls.join(', ')}]
                        {weapon.damageBonus > 0 ? ` +${weapon.damageBonus}` : ''}
                        {' = '}{dmg.baseDmg}
                      </Text>
                      {dmg.cpRolls.length > 0 && (
                        <Text style={[s.dmgRollText, { color: colors.foreground }]}>
                          CP bonus: [{dmg.cpRolls.join(', ')}] = +{dmg.cpBonusDmg}
                        </Text>
                      )}
                      <Text style={[s.dmgRollText, { color: colors.mutedForeground }]}>
                        DT: -{dmg.combinedDT}
                      </Text>
                      <Text style={[s.dmgFinal, { color: dmg.finalDmg > 0 ? colors.destructive : colors.mutedForeground }]}>
                        = {dmg.finalDmg} damage
                      </Text>
                    </View>
                  );
                })}

                <View style={[s.totalRow, { borderTopColor: colors.border }]}>
                  <Text style={[s.totalLabel, { color: colors.foreground }]}>TOTAL DAMAGE</Text>
                  <Text style={[s.totalValue, { color: colors.destructive }]}>{totalDamage}</Text>
                </View>

                {!damageApplied ? (
                  <TouchableOpacity
                    style={[s.applyButton, { backgroundColor: colors.destructive }]}
                    onPress={handleApplyDamage}
                    disabled={totalDamage === 0}
                  >
                    <Feather name="activity" size={16} color="#fff" />
                    <Text style={[s.applyButtonText, { color: '#fff' }]}>
                      APPLY {totalDamage} DMG TO {defender?.name?.toUpperCase() ?? 'DEFENDER'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[s.appliedBadge, { backgroundColor: '#4a8c3f22', borderColor: '#4a8c3f' }]}>
                    <Feather name="check-circle" size={16} color="#4a8c3f" />
                    <Text style={{ color: '#4a8c3f', fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>
                      Damage applied to {defender?.name}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.rerollBtn, { borderColor: colors.border }]}
                  onPress={calculateDamage}
                >
                  <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                  <Text style={[s.rerollText, { color: colors.mutedForeground }]}>Re-roll damage</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Pickers */}
      <CharacterPickerModal
        visible={showAttackerPicker}
        onClose={() => setShowAttackerPicker(false)}
        onSelect={setAttackerId}
        title="SELECT ATTACKER"
        characters={characters}
        allWeapons={allWeapons}
        allArmor={allArmor}
      />
      <CharacterPickerModal
        visible={showDefenderPicker}
        onClose={() => setShowDefenderPicker(false)}
        onSelect={setDefenderId}
        title="SELECT DEFENDER"
        characters={characters}
        allWeapons={allWeapons}
        allArmor={allArmor}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 12 },
    screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 },
    screenSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    cardLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    combatantSlot: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.secondary,
      borderRadius: colors.radius,
      borderWidth: 1,
      padding: 10,
      gap: 10,
      minHeight: 72,
    },
    combatantInfo: { flex: 1 },
    combatantName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
    combatantSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
    combatantEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
    combatantEmptyText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
    combatantTag: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
    diceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    dieFace: {
      width: 72,
      height: 72,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dieValue: { fontSize: 32, fontFamily: 'Inter_700Bold' },
    dieLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: -4 },
    dicePlus: { fontSize: 20, fontFamily: 'Inter_400Regular' },
    rollButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: colors.radius,
      paddingVertical: 12,
      gap: 8,
    },
    rollButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
    hint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
    burstRow: { flexDirection: 'row', gap: 10 },
    toggleBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: colors.radius,
      borderWidth: 1,
    },
    toggleBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
    shotsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    shotsLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
    stepBtn: {
      width: 34,
      height: 34,
      borderRadius: 6,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shotsValue: { fontSize: 22, fontFamily: 'Inter_700Bold', minWidth: 30, textAlign: 'center' },
    shotsHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
    shotRow: { paddingBottom: 10, borderBottomWidth: 1, gap: 6 },
    shotIndicator: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    shotIndicatorText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
    shotDetails: { gap: 2 },
    shotText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
    shotCp: { fontSize: 12, fontFamily: 'Inter_400Regular' },
    cpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    cpLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
    cpBtn: {
      width: 28,
      height: 28,
      borderRadius: 4,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cpValue: { fontSize: 16, fontFamily: 'Inter_700Bold', minWidth: 40, textAlign: 'center' },
    damageInfo: { gap: 2 },
    damageInfoText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
    dmgShotRow: {
      borderWidth: 1,
      borderRadius: colors.radius,
      padding: 10,
      gap: 4,
    },
    dmgShotLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
    dmgRollText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
    dmgFinal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      paddingTop: 10,
    },
    totalLabel: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
    totalValue: { fontSize: 36, fontFamily: 'Inter_700Bold' },
    applyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: colors.radius,
      paddingVertical: 14,
      gap: 8,
    },
    applyButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
    appliedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: colors.radius,
      borderWidth: 1,
    },
    rerollBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderWidth: 1,
      borderRadius: colors.radius,
    },
    rerollText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalSheet: {
      maxHeight: '80%',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
    emptyState: { padding: 40, alignItems: 'center', gap: 12 },
    emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderBottomWidth: 1,
    },
    pickerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
    pickerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
    pickerBadge: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  });
}
