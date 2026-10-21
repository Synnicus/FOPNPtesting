import React, { useState } from 'react';
import { View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { Character, VehicleProfile } from '@/context/types';
import { makeBoardToken, type BoardCell, type TacticalBoard } from '@/data/tacticalBoard';
import { spawnVehicleCharacter, vehicleBoardFootprint } from '@/data/vehicles';
import { PREMADE_CHARACTERS, createCharacterFromPremade } from '@/data/premades';
import { Btn, Label, Note, NumInput, Row, Section } from './ui';
import { tr } from './i18n';
import { pickPortrait } from './boardAssets';
import { assignCrewExclusive, boardedIds } from './crew';

const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function SpawnPanel(props: {
  board: TacticalBoard; characters: readonly Character[]; vehicles: readonly VehicleProfile[]; spawnCell: BoardCell;
  addCharacter: (c: Character) => void; updateCharacter: (c: Character) => void;
  update: (fn: (b: TacticalBoard) => TacticalBoard) => void; onSelect: (id: string) => void;
}) {
  const c = useColors();
  const [pending, setPending] = useState<Character | null>(null);
  const [q, setQ] = useState('');
  const [pName, setPName] = useState('');
  const [pSkill, setPSkill] = useState(50);
  const [pPortrait, setPPortrait] = useState<string | undefined>();
  const [err, setErr] = useState('');
  const onBoard = new Set(props.board.tokens.map(t => t.characterId));
  const addToken = (id: string, vehicle: boolean, profile?: VehicleProfile) => {
    const footprint = profile ? vehicleBoardFootprint(profile) : undefined;
    props.update(b => ({ ...b, tokens: [...b.tokens, makeBoardToken(id, props.spawnCell, vehicle, footprint)] }));
    props.onSelect(id);
  };
  const spawn = (v: VehicleProfile) => {
    const ch = spawnVehicleCharacter(v, newId('veh'));
    props.addCharacter(ch); addToken(ch.id, true, v); setPending(ch);
  };
  const crewPilot = (pilotId?: string) => {
    if (pending && pilotId) {
      assignCrewExclusive({ characters: [...props.characters.filter(x => x.id !== pending.id), pending], vehicleId: pending.id, role: 'pilotCharacterId', crewId: pilotId, updateCharacter: props.updateCharacter, updateBoard: props.update });
    }
    setPending(null);
  };
  const createPilot = () => {
    if (!pName.trim()) { setErr('Enter a pilot name.'); return; }
    if (!Number.isInteger(pSkill) || pSkill < 1 || pSkill > 200) { setErr('Pilot skill must be a whole number from 1 to 200.'); return; }
    const base = createCharacterFromPremade(PREMADE_CHARACTERS[0], newId('pilot'));
    const pilot: Character = { ...base, name: pName.trim(), type: 'npc', portrait: pPortrait, skills: { ...base.skills, pilot: pSkill } };
    props.addCharacter(pilot); setPName(''); setPPortrait(undefined); setErr('');
    if (pending) crewPilot(pilot.id);
  };
  const boarded = boardedIds(props.characters);
  const people = props.characters.filter(x => !x.vehicle && !x.inStorage && !onBoard.has(x.id) && !boarded.has(x.id));
  const devices = people.filter(x => x.combatDevice);
  const vehs = props.vehicles.filter(v => v.name.toLowerCase().includes(q.toLowerCase()));
  const crewCandidates = props.characters.filter(x => !x.vehicle && !x.inStorage && !x.combatDevice);
  return (
    <View style={{ gap: 8 }}>
      {pending ? (
        <Section title={tr('PILOT FOR {0}', pending.name.toUpperCase())}>
          <Note>Choose a pilot, create one, or place the vehicle with no pilot for GM placement.</Note>
          <Row>
            <Btn icon="user-x" label="UNASSIGNED / GM PLACEMENT" onPress={() => crewPilot(undefined)} />
           {crewCandidates.map(p => <Btn key={p.id} compact portrait={p} label={p.name} onPress={() => crewPilot(p.id)} />)}
          </Row>
        </Section>
      ) : null}
      <Section title="QUICK PILOT">
        <TextInput value={pName} onChangeText={setPName} placeholder="Pilot name" accessibilityLabel="Pilot name"
          style={{ color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 7, padding: 8, backgroundColor: c.background }} />
        <Row>
          <NumInput label="PILOT SKILL 1-200" value={pSkill} onChange={setPSkill} width={90} />
          <Btn icon="image" label={pPortrait ? 'PORTRAIT SET' : 'PORTRAIT'} onPress={() => void pickPortrait().then(u => u && setPPortrait(u))} />
          <Btn icon="user-plus" label="CREATE PILOT" onPress={createPilot} />
        </Row>
        {err ? <Note tone="error">{err}</Note> : null}
      </Section>
       <Section title="ADD EXISTING TO BOARD">
         <Note>Tap a character or vehicle below to add its icon at the map center. Drag it to a starting hex; drag empty map space to pan.</Note>
         {people.length ? <Row>{people.map(p => <Btn key={p.id} compact portrait={p} icon="plus" label={p.name} onPress={() => addToken(p.id, false)} />)}</Row>
          : <Note>Every active character is already on the board.</Note>}
        {devices.length ? <Label>Placed mines and traps appear in the list above.</Label> : null}
      </Section>
      <Section title="VEHICLE LIBRARY">
        <TextInput value={q} onChangeText={setQ} placeholder="Search vehicles" accessibilityLabel="Search vehicles"
          style={{ color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 7, padding: 8, backgroundColor: c.background }} />
         <Row>{vehs.map(v => <Btn key={v.id} compact portraitImageUri={v.portrait} portraitVehicle icon="truck" label={v.name} onPress={() => spawn(v)} />)}</Row>
        {!vehs.length ? <Text style={{ color: c.mutedForeground }}>No vehicles match.</Text> : null}
      </Section>
    </View>
  );
}
