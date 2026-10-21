import React, { useState } from 'react';
import { View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { Character } from '@/context/types';
import { footprint, type BoardCell, type BoardToken, type TacticalBoard } from '@/data/tacticalBoard';
import { Btn, Label, Note, Row, Section, Stepper } from './ui';
import { tr } from './i18n';
import { translateText } from '@/data/localization';
import { pickBoardImage } from './boardAssets';

const HEX_DIRS: BoardCell[] = [{ q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: -1, r: 1 }];
const SQ_DIRS: BoardCell[] = [{ q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }];

export default function TokenPanel(props: {
  board: TacticalBoard; characters: readonly Character[]; token: BoardToken | undefined;
  actorId: string; attackerId: string | null; defenderId: string | null; gm: boolean;
  patch: (id: string, p: Partial<BoardToken>) => void;
  move: (id: string, cell: BoardCell) => void;
  remove: (id: string) => void;
  setAttacker: (id: string) => void; setDefender: (id: string) => void; openCalculator: () => void;
  assignCrew: (vehicleId: string, role: 'pilotCharacterId' | 'gunnerCharacterId', id: string | undefined) => void;
}) {
  const c = useColors();
  const { token, board } = props;
  const [msg, setMsg] = useState('');
  if (!token) return <Section title="TOKEN"><Note>Tap a token on the board, or add one from the Spawn tab.</Note></Section>;
  const ch = props.characters.find(x => x.id === token.characterId);
  const actor = props.characters.find(x => x.id === props.actorId);
  const crew = props.actorId !== token.characterId;
  const veh = !!ch?.vehicle;
  const dirs = board.grid === 'hex' ? HEX_DIRS : SQ_DIRS;
  const crewPool = props.characters.filter(x => !x.vehicle && !x.inStorage && !x.combatDevice);
  const pilotId = ch?.vehicleCrew?.pilotCharacterId, gunnerId = ch?.vehicleCrew?.gunnerCharacterId;
  const crewRow = (role: 'pilotCharacterId' | 'gunnerCharacterId', cur: string | undefined, title: string) => (
    <View style={{ gap: 4 }}>
      <Label>{title}</Label>
      <Row>
        <Btn compact label="NONE" active={!cur} onPress={() => props.assignCrew(token.characterId, role, undefined)} />
        {crewPool.map(p => <Btn key={p.id} compact label={p.name} active={cur === p.id} onPress={() => props.assignCrew(token.characterId, role, p.id)} />)}
      </Row>
    </View>
  );
  const pickSkin = async () => {
    const r = await pickBoardImage(board, token.imageDataUri?.length ?? 0);
    if (!r) return;
    if ('error' in r) setMsg(r.error); else { setMsg(''); props.patch(token.characterId, { imageDataUri: r.uri }); }
  };
  return (
    <View style={{ gap: 8 }}>
      <Section title="TOKEN">
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{actor?.name ?? props.actorId}</Text>
        {actor ? <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{tr('HP {0}/{1} AP {2}/{3} {4}', actor.currentHp, actor.maxHp, actor.currentAP, actor.maxAP, translateText(actor.position))}</Text> : null}
        {crew ? <Note>{tr('Boarded in {0}: position, facing, and movement are inherited from the vehicle.', ch?.name ?? translateText('vehicle'))}</Note> : null}
        <Row>
          <Btn icon="crosshair" label="ATTACKER" active={props.attackerId === props.actorId} onPress={() => props.setAttacker(props.actorId)} />
          <Btn icon="target" label="TARGET" active={props.defenderId === props.actorId} onPress={() => props.setDefender(props.actorId)} />
          <Btn icon="shield" label="OPEN CALCULATOR" onPress={props.openCalculator} />
        </Row>
      </Section>
      {crew ? null : <><Section title={props.gm ? 'GM PLACEMENT (FREE)' : 'MOVE (RULES-BASED)'}>
        <Note tone={props.gm ? 'warn' : 'info'}>
          {props.gm ? 'GM placement ignores AP and movement rules.' : veh ? 'Vehicles move through queued driving paths. Turn on GM placement to reposition freely.' : 'Dragging or nudging spends AP by distance, terrain, and posture.'}
        </Note>
        <Row>
          {dirs.map((d, i) => (
            <Btn key={i} compact icon={d.q > 0 && d.r === 0 ? 'arrow-right' : d.q < 0 && d.r === 0 ? 'arrow-left' : d.r > 0 ? 'arrow-down' : 'arrow-up'}
              label={board.grid === 'hex' ? `${d.q},${d.r}` : ''} onPress={() => props.move(token.characterId, { q: token.q + d.q, r: token.r + d.r })} />
          ))}
        </Row>
        <Label>{tr('Cell {0}, {1}. Footprint {2} cells.', token.q, token.r, footprint(token, board.grid).length)}</Label>
      </Section>
      <Section title="FOOTPRINT, FACING, ARTWORK">
        <Row>
          <Stepper label="WIDTH" value={token.width} min={1} max={20} onChange={n => props.patch(token.characterId, { width: n })} />
          <Stepper label="LENGTH" value={token.length} min={1} max={20} onChange={n => props.patch(token.characterId, { length: n })} />
          <Stepper label="FACING" value={token.facing} min={-3600} max={3600} step={15} fmt={n => `${n}`} onChange={n => props.patch(token.characterId, { facing: n })} />
        </Row>
        <Row>
          <Btn compact label="-90" onPress={() => props.patch(token.characterId, { facing: token.facing - 90 })} />
          <Btn compact label="+90" onPress={() => props.patch(token.characterId, { facing: token.facing + 90 })} />
          <Btn compact label="NORTH" onPress={() => props.patch(token.characterId, { facing: 0 })} />
        </Row>
        {!veh ? (
          <Row>
            <Stepper label="PORTRAIT ZOOM" value={token.imageScale ?? 1} min={0.25} max={4} step={0.25} onChange={n => props.patch(token.characterId, { imageScale: n })} />
            <Stepper label="SHIFT X" value={token.imageOffsetX ?? 0} min={-1} max={1} step={0.1} onChange={n => props.patch(token.characterId, { imageOffsetX: n })} />
            <Stepper label="SHIFT Y" value={token.imageOffsetY ?? 0} min={-1} max={1} step={0.1} onChange={n => props.patch(token.characterId, { imageOffsetY: n })} />
          </Row>
        ) : null}
        <Row>
          <Btn icon="image" label={veh ? 'UPLOAD SKIN (PNG/GIF)' : 'BOARD PORTRAIT'} onPress={() => void pickSkin()} />
          {token.imageDataUri ? <Btn icon="trash-2" danger label="CLEAR" onPress={() => props.patch(token.characterId, { imageDataUri: undefined })} /> : null}
        </Row>
        <Note>{veh ? 'Skins live only on the board. Transparent PNG and GIF are supported.' : 'Board framing never changes the character-sheet portrait.'}</Note>
        {msg ? <Note tone="error">{msg}</Note> : null}
      </Section>
      </>}
      {veh && !crew ? <Section title="CREW">{crewRow('pilotCharacterId', pilotId, 'PILOT')}{crewRow('gunnerCharacterId', gunnerId, 'GUNNER')}</Section> : null}
      {crew ? null : <Btn icon="trash-2" danger label="REMOVE FROM BOARD" onPress={() => props.remove(token.characterId)} />}
    </View>
  );
}
