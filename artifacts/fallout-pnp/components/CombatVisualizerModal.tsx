import React, { useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LocalizedText as Text, LocalizedTouchableOpacity as Touch } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import type { AreaDamageProfile } from '@/data/areaEffects';
import {
  boardTokenFor, burstCorridor, cellDistance, footprint, tokenDistance,
  type BoardCell, type BoardToken, type TacticalBoard,
} from '@/data/tacticalBoard';
import BoardCanvas, { type BoardCanvasHandle, type BoardHit } from './tactical/BoardCanvas';
import Board3DCanvas from './tactical/Board3DCanvas';
import BlastPanel, { ZONE_COLORS, blastZones } from './tactical/BlastPanel';
import DrivingPanel from './tactical/DrivingPanel';
import TokenPanel from './tactical/TokenPanel';
import SpawnPanel from './tactical/SpawnPanel';
import SettingsPanel from './tactical/SettingsPanel';
import { Btn, Note, type FeatherName } from './tactical/ui';
import { effectivePilotSkill } from './tactical/pilotSheet';
import { VehicleFormModal } from './VehicleFormModal';
import { assignCrewExclusive } from './tactical/crew';
import { tr } from './tactical/i18n';
import { translateText } from '@/data/localization';
import CombatantPortrait from './tactical/CombatantPortrait';

type Tab = 'token' | 'drive' | 'blast' | 'spawn' | 'settings' | null;
export interface CombatVisualizerModalProps {
  visible: boolean; onClose: () => void;
  attackerId: string | null; defenderId: string | null;
  onAttackerChange: (id: string) => void; onDefenderChange: (id: string) => void;
  combatPanel: React.ReactNode; isBurst: boolean; burstRangeCells: number;
  onAreaAttack: (profileId: string, assignments: Record<string, string>) => void;
  areaProfiles: readonly AreaDamageProfile[];
  /** Parent-provided follow-up for rounds that missed during a burst; the board never starts attacks itself. */
  onResolveStray?: (targetId: string) => void;
  /** Aim point of a same-attack burst follow-up; the corridor is computed against it when given. */
  burstAim?: BoardCell;
  /** True while a follow-up reroll of missed rounds is in progress. */
  burstFollowupActive?: boolean;
}

export default function CombatVisualizerModal(p: CombatVisualizerModalProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 560;
  const app = useApp();
  const board: TacticalBoard = app.tacticalBoard;
  const chars = app.characters;
  const canvas = useRef<BoardCanvasHandle>(null);
  const centerRef = useRef<BoardCell>({ q: 5, r: 5 });
  const [tab, setTab] = useState<Tab>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [obstacleId, setObstacleId] = useState<string | null>(null);
  const [pick, setPick] = useState<'attacker' | 'defender' | null>(null);
  const [gm, setGm] = useState(false);
  const [calc, setCalc] = useState(false);
  const [notice, setNotice] = useState('');
  const [pathCells, setPathCells] = useState<BoardCell[] | null>(null);
  const [blastId, setBlastId] = useState<string | null>(null);
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [impact, setImpact] = useState<BoardCell | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [threeD, setThreeD] = useState(false);
  const [cameraPan, setCameraPan] = useState(false);

  const topPad = Math.max(insets.top, Platform.OS === 'web' ? 12 : 8);
  const sideL = insets.left, sideR = insets.right;
  const update = (fn: (b: TacticalBoard) => TacticalBoard) => { try { app.updateTacticalBoard(fn); setNotice(''); } catch (e) { setNotice(e instanceof Error ? e.message : 'Board update rejected.'); } };
  const patch = (id: string, pt: Partial<BoardToken>) => update(b => ({ ...b, tokens: b.tokens.map(t => t.characterId === id ? { ...t, ...pt } : t) }));
  const isVehicle = (id: string) => !!chars.find(x => x.id === id)?.vehicle;
  const move = (id: string, cell: BoardCell) => {
    try {
      if (isVehicle(id)) {
        if (!gm) { setNotice('Vehicles move by queued driving paths. Turn on GM placement to reposition freely.'); return; }
        patch(id, cell);
      } else app.moveTacticalToken(id, cell, gm);
      setNotice('');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Move rejected.'); }
  };
  const assignCrew = (vid: string, role: 'pilotCharacterId' | 'gunnerCharacterId', id: string | undefined) => {
    assignCrewExclusive({ characters: chars, vehicleId: vid, role, crewId: id, updateCharacter: app.updateCharacter, updateBoard: update });
  };

  const sel = selectedId ? boardTokenFor(selectedId, board, chars) : undefined;
  const aTok = p.attackerId ? boardTokenFor(p.attackerId, board, chars) : undefined;
  const dTok = p.defenderId ? boardTokenFor(p.defenderId, board, chars) : undefined;
  const nameOf = (id: string | null) => chars.find(x => x.id === id)?.name ?? translateText('None');
  const activeId = app.initiativeEntries.find(e => e.isActive)?.characterId ?? null;

  const profile = p.areaProfiles.find(x => x.id === blastId);
  const zones = useMemo(() => blastZones(profile, app.areaProfileRangeOverrides), [profile, app.areaProfileRangeOverrides]);
  const rings = zones.map((z, i) => ({
    radius: z.maxDistance / board.metersPerCell + 0.5,
    color: ZONE_COLORS[i % ZONE_COLORS.length],
  }));

  const burst = useMemo(() => {
    if (!p.isBurst || !aTok || (!dTok && !p.burstAim)) return null;
    const cells = burstCorridor(aTok, (p.burstAim ?? dTok)!, board.grid, p.burstRangeCells);
    const inside = board.tokens.filter(t => t !== aTok && footprint(t, board.grid).some(f => cells.some(k => k.q === f.q && k.r === f.r)))
      .sort((a, b) => tokenDistance(aTok, a, board) - tokenDistance(aTok, b, board));
    return { cells, inside };
  }, [p.isBurst, p.burstRangeCells, p.burstAim, aTok, dTok, board]);
  const nearest = burst?.inside[0];

  const onTap = (cell: BoardCell, hit: BoardHit | null) => {
    if (tab === 'blast' && !pick) { setImpact(cell); return; }
    if (hit?.kind === 'token' || hit?.kind === 'crew') {
      if (pick === 'attacker') p.onAttackerChange(hit.id);
      else if (pick === 'defender') p.onDefenderChange(hit.id);
      setPick(null); setSelectedId(hit.id); setObstacleId(null);
      if (tab === null) setTab('token');
    } else if (hit?.kind === 'obstacle') { setObstacleId(hit.id); setTab('settings'); }
    else { setSelectedId(null); setObstacleId(null); }
  };
  const resolveDriving = () => { try { app.resolveTacticalDriving(); setNotice(''); } catch (e) { setNotice(e instanceof Error ? e.message : 'Round-end movement rejected.'); } };
  const openTab = (t: Tab) => { setTab(tab === t ? null : t); setPathCells(null); };

  const tools: { t: Exclude<Tab, null>; icon: FeatherName; label: string }[] = [
    { t: 'token', icon: 'user', label: 'TOKEN' }, { t: 'drive', icon: 'navigation', label: 'DRIVE' },
    { t: 'blast', icon: 'target', label: 'BLAST' }, { t: 'spawn', icon: 'plus-circle', label: 'SPAWN' }, { t: 'settings', icon: 'sliders', label: 'GRID' },
  ];
  const dist = aTok && dTok ? tokenDistance(aTok, dTok, board) : null;
  const err = notice || app.tacticalError;

  return (
    <Modal visible={p.visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: topPad, paddingLeft: sideL, paddingRight: sideR }}>
        <View style={{ gap: 6, paddingHorizontal: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Touch accessibilityLabel="Close board" onPress={p.onClose} style={{ padding: 8 }}><Feather name="arrow-left" size={20} color={c.primary} /></Touch>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: c.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>{tr('TACTICAL BOARD R{0}', app.currentRound)}</Text>
              <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 10 }}>
                {dist !== null ? tr('Edge to edge: {0} m', dist) : 'Pick an attacker and a target'}
              </Text>
            </View>
            <Btn compact icon="shield" a11y="Calculator" label={narrow ? '' : 'CALC'} onPress={() => setCalc(true)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Btn compact portrait={chars.find(ch => ch.id === p.attackerId)} icon="crosshair" a11y={tr('Select attacker: {0}', nameOf(p.attackerId))} label={nameOf(p.attackerId)} active={pick === 'attacker'} onPress={() => setPick(pick === 'attacker' ? null : 'attacker')} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Btn compact portrait={chars.find(ch => ch.id === p.defenderId)} icon="target" a11y={tr('Select target: {0}', nameOf(p.defenderId))} label={nameOf(p.defenderId)} active={pick === 'defender'} onPress={() => setPick(pick === 'defender' ? null : 'defender')} />
            </View>
          </View>
        </View>
        <View style={{ paddingHorizontal: 10, paddingTop: 7, gap: 2, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Text style={{ color: c.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{tr('INITIATIVE TRACKER')}</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 10 }}>{tr('Combatants appear in turn order here; the active combatant is highlighted.')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.border }} contentContainerStyle={{ gap: 6, padding: 6, alignItems: 'center' }}>
          {app.initiativeEntries.map(e => {
            const t = e.characterId ? boardTokenFor(e.characterId, board, chars) : undefined;
            const actor = chars.find(ch => ch.id === e.characterId);
            return (
              <Touch key={e.id} accessibilityRole="button" accessibilityLabel={tr('Initiative {0}: {1}, HP {2} of {3}, AP {4} of {5}{6}', e.initiative, e.name, e.currentHp, e.maxHp, e.currentAP, e.maxAP, e.isActive ? `, ${tr('active turn')}` : '')}
                onPress={() => { if (t) { setSelectedId(t.characterId); setTab('token'); } }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 144, maxWidth: 220, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: e.isActive ? 2 : 1, borderColor: e.isActive ? c.primary : c.border, backgroundColor: e.isActive ? c.secondary : c.card, opacity: e.hasActed ? 0.6 : 1 }}>
                <CombatantPortrait character={actor} size={28} active={e.isActive} />
                <View style={{ minWidth: 0, flexShrink: 1 }}>
                  <Text style={{ color: c.text, fontSize: 11, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{`${e.initiative} ${e.name}`}</Text>
                  <Text style={{ color: c.mutedForeground, fontSize: 9 }} numberOfLines={1}>{tr(t ? 'HP {0}/{1} AP {2}/{3}' : 'HP {0}/{1} AP {2}/{3} off board', e.currentHp, e.maxHp, e.currentAP, e.maxAP)}</Text>
                  {e.isActive ? <Text style={{ color: c.primary, fontSize: 8, fontWeight: '900' }}>{tr('ACTIVE TURN')}</Text> : null}
                </View>
              </Touch>
            );
          })}
          {!app.initiativeEntries.length ? <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{tr("No initiative order yet. Open the calculator's Initiative / Round Tracker to start combat.")}</Text> : null}
          <Btn compact icon="skip-forward" label="NEXT TURN" onPress={app.nextTurn} disabled={!app.initiativeEntries.length} />
        </ScrollView>

        <View style={{ flex: 1 }}>
          {threeD ? (
            <Board3DCanvas ref={canvas} board={board} characters={chars} selectedId={selectedId} attackerId={p.attackerId} defenderId={p.defenderId}
              activeId={activeId} pathCells={tab === 'drive' ? pathCells : null} impact={tab === 'blast' ? impact : null} rings={tab === 'blast' ? rings : []}
              burstCells={burst?.cells} burstTargetIds={burst?.inside.map(t => t.characterId)} selectedObstacleId={obstacleId}
              centerRef={centerRef} panMode={cameraPan} dragEnabled={tab !== 'blast' && !pick} onTap={onTap}
              onDrop={(id, cell) => { setSelectedId(id); move(id, cell); }}
              onFallback={message => { setNotice(message); setThreeD(false); setCameraPan(false); }} />
          ) : (
            <BoardCanvas ref={canvas} board={board} characters={chars} selectedId={selectedId} attackerId={p.attackerId} defenderId={p.defenderId}
              activeId={activeId} pathCells={tab === 'drive' ? pathCells : null} impact={tab === 'blast' ? impact : null} rings={tab === 'blast' ? rings : []}
              burstCells={burst?.cells} burstTargetIds={burst?.inside.map(t => t.characterId)} selectedObstacleId={obstacleId}
              dragEnabled={tab !== 'blast' && !pick} centerRef={centerRef} onTap={onTap}
              onDrop={(id, cell) => { setSelectedId(id); move(id, cell); }} />
          )}
          <View style={{ position: 'absolute', right: 8, top: 8, gap: 6 }}>
            <Btn compact icon={threeD ? 'map' : 'box'} active={threeD}
              a11y={tr(threeD ? 'Switch to 2D board' : 'Switch to 3D board')}
              label={narrow ? '' : tr(threeD ? '2D' : '3D')}
              onPress={() => { setThreeD(!threeD); setCameraPan(false); }} />
            {threeD ? <Btn compact icon={cameraPan ? 'move' : 'rotate-cw'} active={cameraPan}
              a11y={tr(cameraPan ? 'Orbit camera' : 'Pan camera')}
              label={narrow ? '' : tr(cameraPan ? 'PAN' : 'ORBIT')}
              onPress={() => setCameraPan(!cameraPan)} /> : null}
            {tools.map(x => <Btn key={x.t} compact icon={x.icon} active={tab === x.t} onPress={() => openTab(x.t)} label="" />)}
            <Btn compact icon="plus" onPress={() => canvas.current?.zoomBy(1.25)} label="" />
            <Btn compact icon="minus" onPress={() => canvas.current?.zoomBy(0.8)} label="" />
            <Btn compact icon="maximize" onPress={() => canvas.current?.fit()} label="" />
            <Btn compact icon="unlock" active={gm} onPress={() => setGm(!gm)} label="" />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 8, gap: 4, maxWidth: '70%' }}>
            {threeD ? <Note>{tr('Drag to orbit; use PAN for single-drag movement. Use two fingers or the mouse wheel to zoom.')}</Note> : null}
            {pick ? <Note tone="warn">{pick === 'attacker' ? 'Tap a token to set the attacker.' : 'Tap a token to set the target.'}</Note> : null}
            {gm ? <Note tone="warn">GM free placement is on: drags ignore AP and rules.</Note> : null}
            {burst ? <Note tone={nearest && nearest.characterId !== dTok?.characterId ? 'warn' : 'info'}>
              {nearest ? tr('Burst corridor: {0} in line. Nearest: {1}.', burst.inside.length, nameOf(nearest.characterId)) : 'Burst corridor has no targets.'}
            </Note> : null}
            {err ? <Note tone="error">{err}</Note> : null}
          </View>
        </View>

        {tab ? (
          <View style={{ maxHeight: '46%', borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background, paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 4) }}>
            <ScrollView contentContainerStyle={{ padding: 8, gap: 8 }} keyboardShouldPersistTaps="handled">
              {tab === 'token' ? <TokenPanel board={board} characters={chars} token={sel} actorId={selectedId ?? ''} attackerId={p.attackerId} defenderId={p.defenderId} gm={gm}
                patch={patch} move={move} remove={id => { update(b => ({ ...b, tokens: b.tokens.filter(t => t.characterId !== id) })); setSelectedId(null); }}
                 setAttacker={p.onAttackerChange} setDefender={p.onDefenderChange} openCalculator={() => setCalc(true)} assignCrew={assignCrew} /> : null}
               {tab === 'token' && chars.find(ch => ch.id === selectedId)?.vehicle ? <Btn icon="edit" label="EDIT VEHICLE / WEAPONS" onPress={() => setEditVehicleId(selectedId)} /> : null}
              {tab === 'drive' ? <DrivingPanel board={board} characters={chars} token={sel && isVehicle(sel.characterId) ? sel : undefined} round={app.currentRound}
                onPreview={setPathCells} update={update} resolve={resolveDriving} error={app.tacticalError}
                combatActive={app.initiativeEntries.length > 0} activeActorId={activeId} gm={gm}
                effectivePilot={ch => effectivePilotSkill(ch, { allArmor: app.allArmor, hardcoreRadiationRules: app.hardcoreRadiationRules, mutantGhoulRadiationRules: app.mutantGhoulRadiationRules, ghoulRadiationHealingOption: app.ghoulRadiationHealingOption })} /> : null}
              {tab === 'blast' ? (
                <>
                  <BlastPanel board={board} characters={chars} profiles={p.areaProfiles} profileId={blastId} onProfile={id => { setBlastId(id); setOverrides({}); }}
                    rangeOverrides={app.areaProfileRangeOverrides}
                    impact={impact} overrides={overrides} onOverride={(id, z) => setOverrides(o => ({ ...o, [id]: z }))} onClear={() => { setImpact(null); setOverrides({}); }}
                    onConfirm={(pid, a) => { p.onAreaAttack(pid, a); setCalc(true); }} />
                  {burst ? (
                    <View style={{ gap: 6 }}>
                      {p.burstFollowupActive
                        ? <Note tone="warn">Follow-up in progress: the same attack rerolls the remaining missed rounds, with no extra AP or ammunition.</Note>
                        : <Note tone="warn">{tr('Burst corridor: first hex, then three hexes wide. The nearest creature ({0}) must be the target.', nearest ? nameOf(nearest.characterId) : translateText('none'))}</Note>}
                      {burst.inside.map((t, i) => <Note key={t.characterId}>{tr(i === 0 ? '{0}. {1} at {2} m (nearest)' : '{0}. {1} at {2} m', i + 1, nameOf(t.characterId), tokenDistance(aTok!, t, board))}</Note>)}
                      {!p.burstFollowupActive && nearest && dTok && dTok.characterId !== nearest.characterId ? <Btn label="SET NEAREST AS TARGET" onPress={() => p.onDefenderChange(nearest.characterId)} /> : null}
                      <Note>Rounds that miss the target are resolved as a follow-up from the same attack in the calculator. Starting another attack would spend ammunition again, so the board does not do that.</Note>
                      {p.onResolveStray ? burst.inside.slice(1).map(t => <Btn key={t.characterId} compact label={tr('RESOLVE MISSED ROUNDS AT {0}', nameOf(t.characterId).toUpperCase())} onPress={() => { p.onResolveStray!(t.characterId); setCalc(true); }} />) : <Note tone="warn">Missed-round follow-up is not connected yet.</Note>}
                    </View>
                  ) : null}
                </>
              ) : null}
               {tab === 'spawn' ? <SpawnPanel board={board} characters={chars} vehicles={app.allVehicles.map(v => ({
                 ...v, portrait: app.vehicleCatalogPortraits[v.id] ?? v.portrait,
                 ...(app.vehicleCatalogPortraitSettings[v.id] ?? {}),
               }))} spawnCell={centerRef.current}
                addCharacter={app.addCharacter} updateCharacter={app.updateCharacter} update={update} onSelect={id => { setSelectedId(id); }} /> : null}
              {tab === 'settings' ? <>
                <Note>Board changes save automatically with this campaign.</Note>
                <SettingsPanel board={board} update={update} obstacleId={obstacleId} onObstacle={setObstacleId} centerCell={centerRef.current} />
              </> : null}
            </ScrollView>
          </View>
        ) : <View style={{ height: Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 4) }} />}

        <VehicleFormModal visible={!!editVehicleId} initial={chars.find(ch => ch.id === editVehicleId)?.vehicle ?? null}
          initialCrew={chars.find(ch => ch.id === editVehicleId)?.vehicleCrew}
          crewCandidates={chars.filter(ch => !ch.inStorage && !ch.vehicle && !ch.combatDevice)}
          weaponOptions={app.allWeapons}
          onClose={() => setEditVehicleId(null)}
          onSave={(vehicle, crew) => {
            const actor = chars.find(ch => ch.id === editVehicleId);
            if (!actor) return;
            const structure = vehicle.systems.find(s => s.kind === 'structure') ?? vehicle.systems[0];
            const updated = { ...actor, name: vehicle.name, vehicle,
              maxHp: structure?.maxHp ?? actor.maxHp, currentHp: structure?.currentHp ?? actor.currentHp };
            app.updateCharacter(updated);
            let snapshot = chars.map(ch => ch.id === actor.id ? updated : ch);
            for (const role of ['pilotCharacterId', 'gunnerCharacterId'] as const) {
              assignCrewExclusive({ characters: snapshot, vehicleId: actor.id, role, crewId: crew?.[role],
                updateCharacter: ch => { app.updateCharacter(ch); snapshot = snapshot.map(old => old.id === ch.id ? ch : old); },
                updateBoard: update });
            }
            setEditVehicleId(null);
          }} />
        {calc ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background, paddingTop: topPad }} testID="tactical-calculator-overlay">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Touch accessibilityLabel="Close calculator" onPress={() => setCalc(false)} style={{ padding: 8 }}><Feather name="x" size={20} color={c.primary} /></Touch>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>COMBAT CALCULATOR</Text>
                <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 10 }}>
                  {dist !== null ? tr('{0} vs {1}: {2} m ({3} grid, {4} m per cell, nearest footprint cells)', nameOf(p.attackerId), nameOf(p.defenderId), dist, translateText(board.grid), board.metersPerCell) : tr('{0} vs {1}', nameOf(p.attackerId), nameOf(p.defenderId))}
                </Text>
              </View>
              <Btn compact icon="map" label="BOARD" onPress={() => setCalc(false)} />
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }} keyboardShouldPersistTaps="handled">{p.combatPanel}</ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
