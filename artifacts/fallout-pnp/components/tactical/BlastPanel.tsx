import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { LocalizedText as Text, LocalizedTouchableOpacity as Touch } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { Character } from '@/context/types';
import { buildAreaDamageZones, type AreaDamageProfile, type AreaDamageZone, type AreaProfileRangeOverrides } from '@/data/areaEffects';
import { cellDistance, footprint, type BoardCell, type TacticalBoard } from '@/data/tacticalBoard';
import { visibleTokens } from './crew';
import { tr } from './i18n';
import { Btn, Label, Note, Row, Section } from './ui';

export const ZONE_COLORS = ['#c0392b', '#d9822b', '#d4b83a', '#5f9e5a', '#4a8fb0', '#7a5fa8'];

export function blastZones(profile: AreaDamageProfile | undefined, overrides: AreaProfileRangeOverrides = {}): AreaDamageZone[] {
  return profile ? buildAreaDamageZones(profile, overrides, {}) : [];
}

/** Distance from the impact cell to the nearest cell of the token footprint, in the profile's unit. */
export function blastDistance(board: TacticalBoard, impact: BoardCell, characterId: string, unit: 'hex' | 'm'): number | null {
  const t = board.tokens.find(k => k.characterId === characterId);
  if (!t) return null;
  const cells = Math.min(...footprint(t, board.grid).map(f => cellDistance(impact, f, board.grid)));
  // The manual's range unit is a one-meter hex, not a resized display cell.
  return cells * board.metersPerCell;
}

export function autoAssign(board: TacticalBoard, zones: AreaDamageZone[], impact: BoardCell | null, tokens = board.tokens): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (!impact || !zones.length) return out;
  for (const t of tokens) {
    const d = blastDistance(board, impact, t.characterId, zones[0].rangeUnit);
    out[t.characterId] = d === null ? undefined : zones.find(z => Math.ceil(d) >= z.minDistance && d <= z.maxDistance)?.id;
  }
  return out;
}

export default function BlastPanel(props: {
  board: TacticalBoard; characters: readonly Character[]; profiles: readonly AreaDamageProfile[];
  profileId: string | null; onProfile: (id: string | null) => void;
  impact: BoardCell | null; overrides: Record<string, string | 'none'>; onOverride: (id: string, zone: string | 'none') => void;
  onClear: () => void; onConfirm: (profileId: string, assignments: Record<string, string>) => void;
  rangeOverrides?: AreaProfileRangeOverrides;
}) {
  const c = useColors();
  const [crewOn, setCrewOn] = useState<Record<string, boolean>>({});
  const profile = props.profiles.find(p => p.id === props.profileId);
  const zones = blastZones(profile, props.rangeOverrides);
  const shown = visibleTokens(props.board, props.characters);
  const auto = autoAssign(props.board, zones, props.impact, shown);
  const final: Record<string, string> = {};
  for (const t of shown) {
    const o = props.overrides[t.characterId];
    const z = o === 'none' ? undefined : o ?? auto[t.characterId];
    if (z) final[t.characterId] = z;
  }
  const crewEntries = shown.flatMap(t => {
    const v = props.characters.find(x => x.id === t.characterId);
    if (!v?.vehicle) return [];
    return [v.vehicleCrew?.pilotCharacterId, v.vehicleCrew?.gunnerCharacterId].filter(id => !!id && !props.characters.find(x => x.id === id)?.inStorage).map(id => ({ id: id as string, vehicleId: t.characterId }));
  });
  for (const m of crewEntries) {
    if (!crewOn[m.id]) continue;
    const o = props.overrides[m.id];
    const z = o === 'none' ? undefined : o ?? final[m.vehicleId] ?? auto[m.vehicleId];
    if (z) final[m.id] = z;
  }
  const colorOf = (zid: string) => ZONE_COLORS[Math.max(0, zones.findIndex(z => z.id === zid)) % ZONE_COLORS.length];
  const cycle = (id: string) => {
    const order = [...zones.map(z => z.id), 'none'];
    const cur = final[id] ?? 'none';
    props.onOverride(id, order[(order.indexOf(cur) + 1) % order.length]);
  };
  const nameOf = (id: string) => props.characters.find(ch => ch.id === id)?.name ?? id;
  return (
    <View style={{ gap: 8 }}>
      <Section title="BLAST PROFILE">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {props.profiles.map(p => (
            <Btn key={p.id} compact label={p.name} active={p.id === props.profileId} onPress={() => props.onProfile(p.id)} />
          ))}
        </ScrollView>
        {!props.profiles.length ? <Note>No area profile is available for the current weapon. Choose an explosive or area weapon in the calculator first.</Note> : null}
        {profile && !zones.length ? <Note tone="warn">This profile has no configured zone distances. Set them in the calculator before using the board.</Note> : null}
        {profile ? <Note>{props.impact ? 'Impact placed. Tap the board to move it.' : 'Tap the board to place the impact center.'}</Note> : null}
      </Section>
      {profile && zones.length ? (
        <Section title="ZONES AND TARGETS">
          <Row>
            {zones.map((z, i) => (
              <View key={z.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                <Text style={{ color: c.text, fontSize: 11 }}>{z.label}</Text>
              </View>
            ))}
          </Row>
          {props.impact ? shown.map(t => {
            const z = final[t.characterId];
            const d = blastDistance(props.board, props.impact!, t.characterId, zones[0].rangeUnit);
            return (
              <Touch key={t.characterId} onPress={() => cycle(t.characterId)} accessibilityLabel={nameOf(t.characterId)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.background }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: z ? colorOf(z) : c.border }} />
                <Text style={{ flex: 1, color: c.text, fontWeight: '700' }} numberOfLines={1}>{nameOf(t.characterId)}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{d === null ? '' : `${d} ${zones[0].rangeUnit}`}</Text>
                <Text style={{ color: z ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: '700' }}>{z ? zones.find(q => q.id === z)?.label : 'Outside'}</Text>
              </Touch>
            );
          }) : null}
          {props.impact && crewEntries.length ? (
            <View style={{ gap: 6 }}>
              <Label>BOARDED CREW (EXCLUDED UNLESS CHECKED)</Label>
              {crewEntries.map(m => {
                const on = !!crewOn[m.id]; const z = final[m.id];
                return (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Btn compact icon={on ? 'check-square' : 'square'} label="" active={on} onPress={() => setCrewOn(o => ({ ...o, [m.id]: !o[m.id] }))} />
                    <Text style={{ flex: 1, color: c.text }} numberOfLines={1}>{tr('{0} (in {1})', nameOf(m.id), nameOf(m.vehicleId))}</Text>
                    {on ? <Btn compact label={z ? zones.find(q => q.id === z)?.label ?? 'Outside' : 'Outside'} onPress={() => cycle(m.id)} /> : null}
                  </View>
                );
              })}
              <Note>The GM decides whether the cabin protects occupants. Nothing is applied to them automatically.</Note>
            </View>
          ) : null}
          {props.impact ? <Label>Tap a row to change its zone. Zones come from footprint distance to the impact center.</Label> : null}
          <Row>
            <Btn icon="check" label="CONFIRM IN CALCULATOR" disabled={!props.impact || !Object.keys(final).length}
              onPress={() => props.onConfirm(profile.id, final)} />
            <Btn icon="x" label="CLEAR" onPress={props.onClear} />
          </Row>
          <Note>Confirming hands the assignments to the existing area-damage resolver. Nothing is damaged from the board directly.</Note>
        </Section>
      ) : null}
    </View>
  );
}
