import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { Character } from '@/context/types';
import { PILOT_TERRAINS, planDriving, type BoardCell, type BoardPath, type BoardToken, type TacticalBoard } from '@/data/tacticalBoard';
import { tr } from './i18n';
import { translateText } from '@/data/localization';
import { Btn, Label, Note, NumInput, Row, Section } from './ui';

export default function DrivingPanel(props: {
  board: TacticalBoard; characters: readonly Character[]; token: BoardToken | undefined; round: number;
  onPreview: (cells: BoardCell[] | null) => void;
  update: (fn: (b: TacticalBoard) => TacticalBoard) => void;
  resolve: () => void; error: string | null; effectivePilot: (c: Character) => number;
  combatActive: boolean; activeActorId: string | null; gm: boolean;
}) {
  const c = useColors();
  const { token, board, round } = props;
  const veh = token ? props.characters.find(ch => ch.id === token.characterId) : undefined;
  const pilot = props.characters.find(ch => ch.id === veh?.vehicleCrew?.pilotCharacterId);
  const [speed, setSpeed] = useState(0);
  const [maneuver, setManeuver] = useState<BoardPath['maneuver']>('straight');
  const [terrain, setTerrain] = useState(2);
  const [weather, setWeather] = useState(0);
  const [night, setNight] = useState(false);
  const [attacked, setAttacked] = useState(false);
  const [gmBonus, setGmBonus] = useState(0);
  const [crashRolls, setCrashRolls] = useState<number[] | null>(null);
  const [manual, setManual] = useState(1);
  let sheetPilot = 0;
  let sheetError: string | null = null;
  try { sheetPilot = pilot ? props.effectivePilot(pilot) : 0; } catch (e) { sheetError = e instanceof Error ? e.message : 'Pilot sheet could not be resolved.'; }
  const skill = sheetPilot + gmBonus;
  const turnBlocked = props.combatActive && !props.gm && (!pilot || props.activeActorId !== pilot.id);
  useEffect(() => { setSpeed(token?.speedKph ?? 0); setGmBonus(0); setCrashRolls(null); }, [pilot?.id, token?.characterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = useMemo(() => {
    if (sheetError) return { path: null as BoardPath | null, error: null as string | null };
    if (!token || !veh?.vehicle) return { path: null as BoardPath | null, error: null as string | null };
    try {
      return { path: planDriving(token, veh.vehicle, { speedKph: speed, maneuver, pilotSkill: skill, terrainModifier: PILOT_TERRAINS[terrain].modifier, weatherModifier: weather, night, driverAttacked: attacked, round }, board), error: null };
    } catch (e) { return { path: null, error: e instanceof Error ? e.message : 'Invalid driving plan.' }; }
  }, [sheetError, token, veh, speed, maneuver, skill, terrain, weather, night, attacked, round, board]);
  const queued = token?.path?.round === round ? token.path : undefined;
  const planCells = plan.path?.cells ?? null;
  useEffect(() => { props.onPreview(queued ? null : planCells); }, [planCells, queued]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => props.onPreview(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !veh?.vehicle) return <Section title="DRIVING"><Note>Select a vehicle token on the board to plan its path.</Note></Section>;
  const crashDice = Math.floor((queued?.speedKph ?? 0) / 10);
  const boat = veh.vehicle.category === 'boat';
  const occupants = [pilot, props.characters.find(ch => ch.id === veh.vehicleCrew?.gunnerCharacterId)].filter(Boolean) as Character[];
  const patch = (path: BoardPath | undefined) => props.update(b => ({ ...b, tokens: b.tokens.map(t => t.characterId === token.characterId ? { ...t, path } : t) }));
  const queuePath = (path: BoardPath) => props.update(b => ({ ...b, tokens: b.tokens.map(t =>
    t.characterId === token.characterId && t.lastMovedRound !== round && t.path?.round !== round ? { ...t, path } : t) }));
  const forceStop = () => props.update(b => ({ ...b, tokens: b.tokens.map(t => t.characterId === token.characterId && t.lastMovedRound !== round ? { ...t, speedKph: 0, path: undefined, lastMovedRound: round } : t) }));
  const setCheck = (check: 'success' | 'failure', roll?: number) => queued && patch({ ...queued, check, roll });
  const autoRoll = () => { const r = 1 + Math.floor(Math.random() * 100); setCheck(r <= queued!.target ? 'success' : 'failure', r); };
  const moved = token.lastMovedRound === round;
  const pendingCount = board.tokens.filter(t => t.path?.round === round && t.lastMovedRound !== round).length;
  const target = plan.path?.target;
  return (
    <View style={{ gap: 8 }}>
      <Section title={tr('DRIVING: {0}', veh.name)}>
        <Note>{pilot ? tr('Pilot: {0}. Effective Pilot {1} from the character sheet (armor, perks, race, conditions, radiation), total {2} with GM bonus.', pilot.name, sheetPilot, skill) : 'No pilot assigned. Assign a pilot in the token tab; without one the Pilot value is 0 plus any GM bonus.'}</Note>
        <Note>Driving costs no AP. Paths are queued, Pilot checks resolved, then every vehicle moves together at round end.</Note>
        {moved ? <Note tone="warn">This vehicle already moved this round.</Note> : null}
        <Row>
          <NumInput label="SPEED KPH" value={speed} onChange={setSpeed} />
          <NumInput label="GM PILOT BONUS" value={gmBonus} onChange={setGmBonus} width={90} />
          <NumInput label="WEATHER MOD" value={weather} onChange={setWeather} />
        </Row>
        <Label>MANEUVER</Label>
        <Row>
          {(['left', 'straight', 'right'] as const).map(m => <Btn key={m} compact label={translateText(m.toUpperCase())} active={maneuver === m} icon={m === 'left' ? 'corner-up-left' : m === 'right' ? 'corner-up-right' : 'arrow-up'} onPress={() => setManeuver(m)} />)}
          <Btn compact label="NIGHT" active={night} onPress={() => setNight(!night)} />
          <Btn compact label="DRIVER ATTACKED" active={attacked} onPress={() => setAttacked(!attacked)} />
        </Row>
        <Label>TERRAIN</Label>
        <Row>
          {PILOT_TERRAINS.map((t, i) => <Btn key={t.label} compact active={terrain === i} label={`${translateText(t.label)} (${t.modifier >= 0 ? '+' : ''}${t.modifier})`} onPress={() => setTerrain(i)} />)}
        </Row>
        {sheetError ? <Note tone="error">{tr('Pilot skill could not be resolved: {0}', sheetError)}</Note> : null}
        {turnBlocked ? <Note tone="warn">Paths can be queued only on the pilot's own turn. GM placement overrides this.</Note> : null}
        {plan.error ? <Note tone="error">{plan.error}</Note> : plan.path ? (
          <Note>{tr('Preview: {0} cells, final facing {1} degrees. Pilot target {2} or lower on d100.', plan.path.cells.length, plan.path.facing, target ?? 0)}</Note>
        ) : null}
        <Row>
          <Btn icon="flag" label="QUEUE PATH" disabled={!plan.path || moved || !!queued || !!sheetError || turnBlocked} onPress={() => plan.path && queuePath(plan.path)} />
          {queued ? <Btn icon="trash-2" danger label="CANCEL QUEUED PATH" onPress={() => patch(undefined)} /> : null}
        </Row>
      </Section>
      {queued ? (
        <Section title="PILOT CHECK">
          <Text style={{ color: c.text }}>{queued.roll ? tr('Target {0}. Status: {1}, rolled {2}.', queued.target, translateText(queued.check.toUpperCase()), queued.roll) : tr('Target {0}. Status: {1}.', queued.target, translateText(queued.check.toUpperCase()))}</Text>
          <Row>
            <Btn icon="shuffle" label="AUTO-ROLL D100" onPress={autoRoll} />
            <NumInput label="PHYSICAL ROLL" value={manual} onChange={setManual} width={60} />
            <Btn label="APPLY ROLL" disabled={manual < 1 || manual > 100 || !Number.isInteger(manual)} onPress={() => setCheck(manual <= queued.target ? 'success' : 'failure', manual)} />
          </Row>
          <Row>
            <Btn label="MARK PASSED" icon="check" onPress={() => setCheck('success')} />
            <Btn label="MARK FAILED" icon="x" danger onPress={() => setCheck('failure')} />
          </Row>
          {queued.check === 'failure' ? (
            <View style={{ gap: 6 }}>
              <Note tone="error">{tr('Pilot check failed at {0} kph. The vehicle does not move; the GM distributes the consequences.', queued.speedKph)}</Note>
              {boat ? <Note tone="warn">Sea vehicles overturn instead of taking ordinary crash damage. The GM adjudicates the overturn and its occupants.</Note> : (
                <>
                  <Note tone="warn">{tr('Crash damage: floor({0} / 10) = {1}d10 for each occupant (manual pp. 38-39). The vehicle also takes damage distributed among its systems.', queued.speedKph, crashDice)}</Note>
                  <Note>Each occupant has a broken-limb chance equal to the speed in KPH (halved, rounded up, with a restraint). A roll of 5 or less also causes a head wound and unconsciousness: 10 HP, waking after 15 rounds minus Endurance. Occupants need at least one full round to get out, three with broken limbs.</Note>
                  <Row>
                    <Btn icon="shuffle" label={tr('ROLL {0}D10 PER OCCUPANT', crashDice)} disabled={crashDice < 1} onPress={() => setCrashRolls(Array.from({ length: Math.max(1, occupants.length) * crashDice }, () => 1 + Math.floor(Math.random() * 10)))} />
                  </Row>
                  {crashRolls ? occupants.length ? occupants.map((o, i) => (
                    <Text key={o.id} style={{ color: c.text, fontSize: 11 }}>{tr('{0}: {1} = {2} damage', o.name, crashRolls.slice(i * crashDice, (i + 1) * crashDice).join(', '), crashRolls.slice(i * crashDice, (i + 1) * crashDice).reduce((n, v) => n + v, 0))}</Text>
                  )) : <Text style={{ color: c.text, fontSize: 11 }}>{tr('One occupant: {0} = {1} damage', crashRolls.join(', '), crashRolls.reduce((n, v) => n + v, 0))}</Text> : null}
                  {crashRolls ? <Note>Apply damage, injuries, and system damage from the character and vehicle sheets; the board does not auto-apply it.</Note> : null}
                </>
              )}
            </View>
          ) : null}
        </Section>
      ) : null}
      <Section title="GM ADJUDICATION">
        <Note>If the vehicle cannot drive (disabled engine, controls or wheels), the GM can force a stop. The vehicle halts at its current position with speed 0, any queued path is cleared, and it counts as having moved this round so round end is not blocked. Resolve occupant and vehicle consequences by hand.</Note>
        <Btn icon="octagon" danger label="FORCED STOP AND CLEAR PATH" disabled={moved} onPress={forceStop} />
      </Section>
      <Section title="ROUND END">
        <Note>{tr('{0} vehicle path(s) queued for round {1}.', pendingCount, round)}</Note>
        {props.error ? <Note tone="error">{props.error}</Note> : null}
        <Btn icon="play" label="RESOLVE ALL VEHICLE MOVEMENT" disabled={!pendingCount} onPress={props.resolve} />
      </Section>
    </View>
  );
}
