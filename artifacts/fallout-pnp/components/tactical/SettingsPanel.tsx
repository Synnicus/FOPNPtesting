import React, { useState } from 'react';
import { View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { MAX_BOARD_TOTAL_ASSETS, type BoardObstacle, type TacticalBoard } from '@/data/tacticalBoard';
import { translateText } from '@/data/localization';
import { Btn, Label, Note, NumInput, Row, Section, Stepper } from './ui';
import { tr } from './i18n';
import { boardAssetTotal, pickBoardImage } from './boardAssets';

export default function SettingsPanel(props: {
  board: TacticalBoard; update: (fn: (b: TacticalBoard) => TacticalBoard) => void;
  obstacleId: string | null; onObstacle: (id: string | null) => void; centerCell: { q: number; r: number };
}) {
  const c = useColors();
  const { board } = props;
  const [msg, setMsg] = useState('');
  const set = (p: Partial<TacticalBoard>) => props.update(b => ({ ...b, ...p }));
  const ob = board.obstacles.find(o => o.id === props.obstacleId);
  const patchOb = (p: Partial<BoardObstacle>) => props.update(b => ({ ...b, obstacles: b.obstacles.map(o => o.id === props.obstacleId ? { ...o, ...p } : o) }));
  const upBg = async () => {
    const r = await pickBoardImage(board, board.backgroundDataUri?.length ?? 0, 0.8);
    if (!r) return; if ('error' in r) setMsg(r.error); else { setMsg(''); set({ backgroundDataUri: r.uri }); }
  };
  const upOb = async () => {
    const r = await pickBoardImage(board);
    if (!r) return; if ('error' in r) { setMsg(r.error); return; }
    if (board.obstacles.length >= 100) { setMsg('The board holds at most 100 obstacles.'); return; }
    const id = `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMsg('');
    props.update(b => ({ ...b, obstacles: [...b.obstacles, { id, name: r.name || translateText('Obstacle'), imageDataUri: r.uri, ...props.centerCell, width: 2, length: 2, facing: 0 }] }));
    props.onObstacle(id);
  };
  return (
    <View style={{ gap: 8 }}>
      <Section title="GRID">
        <Row>
          <Btn label="HEX" active={board.grid === 'hex'} onPress={() => set({ grid: 'hex' })} />
          <Btn label="SQUARE" active={board.grid === 'square'} onPress={() => set({ grid: 'square' })} />
        </Row>
        <Row>
          <NumInput label="METERS PER CELL" value={board.metersPerCell} onChange={n => n >= 0.25 && n <= 100 && set({ metersPerCell: n })} width={90} />
          <NumInput label="COLUMNS" value={board.columns} onChange={n => Number.isInteger(n) && n >= 10 && n <= 200 && set({ columns: n })} />
          <NumInput label="ROWS" value={board.rows} onChange={n => Number.isInteger(n) && n >= 10 && n <= 200 && set({ rows: n })} />
        </Row>
        <Label>MOVEMENT TERRAIN (AP MULTIPLIER)</Label>
        <Row>{([1, 2, 3] as const).map(t => <Btn key={t} compact label={`x${t}`} active={board.movementTerrain === t} onPress={() => set({ movementTerrain: t })} />)}</Row>
        <Note>{board.grid === 'square' ? 'Square grids count diagonal steps as one cell (Chebyshev distance).' : 'Hex distance counts cells center to center; range uses the nearest footprint cells.'}</Note>
      </Section>
      <Section title="TERRAIN IMAGE">
        <Row>
          <Btn icon="image" label="UPLOAD TERRAIN" onPress={() => void upBg()} />
          {board.backgroundDataUri ? <Btn icon="rotate-ccw" label="USE DEFAULT DESERT" onPress={() => set({ backgroundDataUri: undefined })} /> : null}
        </Row>
        <Stepper label="TERRAIN SCALE" value={board.backgroundScale} min={0.1} max={10} step={0.1} onChange={n => set({ backgroundScale: n })} />
        <Label>{tr('Image budget {0} / {1} MB', (boardAssetTotal(board) / 1e6).toFixed(1), (MAX_BOARD_TOTAL_ASSETS / 1e6).toFixed(0))}</Label>
        {msg ? <Note tone="error">{msg}</Note> : null}
      </Section>
      <Section title="OBSTACLE STICKERS">
        <Note tone="warn">Visual only. Obstacles do not block movement or sight, grant cover, or trigger collisions.</Note>
        <Row>
          <Btn icon="plus" label="UPLOAD OBSTACLE" onPress={() => void upOb()} />
          {board.obstacles.map(o => <Btn key={o.id} compact label={o.name} active={o.id === props.obstacleId} onPress={() => props.onObstacle(o.id)} />)}
        </Row>
        {ob ? (
          <View style={{ gap: 8 }}>
            <TextInput value={ob.name} onChangeText={name => patchOb({ name })} accessibilityLabel="Obstacle name"
              style={{ color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 7, padding: 8, backgroundColor: c.background }} />
            <Row>
              <Stepper label="WIDTH" value={ob.width} min={1} max={20} onChange={n => patchOb({ width: n })} />
              <Stepper label="LENGTH" value={ob.length} min={1} max={20} onChange={n => patchOb({ length: n })} />
              <Stepper label="ROTATE" value={ob.facing} min={-3600} max={3600} step={15} onChange={n => patchOb({ facing: n })} />
            </Row>
            <Row>
              <Btn compact icon="arrow-left" label="" onPress={() => patchOb({ q: ob.q - 1 })} />
              <Btn compact icon="arrow-right" label="" onPress={() => patchOb({ q: ob.q + 1 })} />
              <Btn compact icon="arrow-up" label="" onPress={() => patchOb({ r: ob.r - 1 })} />
              <Btn compact icon="arrow-down" label="" onPress={() => patchOb({ r: ob.r + 1 })} />
              <Btn compact icon="trash-2" danger label="DELETE" onPress={() => { props.update(b => ({ ...b, obstacles: b.obstacles.filter(o => o.id !== ob.id) })); props.onObstacle(null); }} />
            </Row>
          </View>
        ) : null}
      </Section>
    </View>
  );
}
