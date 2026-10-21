import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, PanResponder, Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, G, Circle, Path, Polygon, Rect, Text as SvgText, Image as SvgImage } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { visibleTokens } from './crew';
import { raceIconPath } from './raceIcons';
import { vehicleTopDownSilhouette } from '@/data/vehicleSilhouettes';
import type { Character } from '@/context/types';
import {
  cellPoint, footprint, pointCell,
  type BoardCell, type BoardToken, type TacticalBoard,
} from '@/data/tacticalBoard';

export const CELL = 32;
const HEX_R = CELL / Math.sqrt(3);
// Preserve Metro's image source: SVG resolves numeric IDs on native and URI
// objects on web, where Image.resolveAssetSource is not available.
const DEFAULT_TERRAIN = require('../../assets/images/combat-desert.jpg');

export type BoardHit = { kind: 'token' | 'obstacle' | 'crew'; id: string };
export interface BoardCanvasHandle { zoomBy: (factor: number) => void; fit: () => void }
export interface BoardRing { radius: number; color: string }

interface Props {
  board: TacticalBoard;
  characters: readonly Character[];
  selectedId: string | null;
  attackerId: string | null;
  defenderId: string | null;
  activeId: string | null;
  pathCells?: BoardCell[] | null;
  impact?: BoardCell | null;
  rings?: BoardRing[];
  burstCells?: BoardCell[];
  burstTargetIds?: string[];
  selectedObstacleId?: string | null;
  dragEnabled: boolean;
  cameraControlsEnabled: boolean;
  centerRef: React.MutableRefObject<BoardCell>;
  onTap: (cell: BoardCell, hit: BoardHit | null) => void;
  onDrop: (characterId: string, cell: BoardCell) => void;
}

const hexPoints = (cx: number, cy: number, r = HEX_R) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (60 * k - 30) * Math.PI / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

const BoardCanvas = forwardRef<BoardCanvasHandle, Props>(function BoardCanvas(props, ref) {
  const c = useColors();
  const { board } = props;
  const rowH = board.grid === 'hex' ? CELL * Math.sqrt(3) / 2 : CELL;
  const boardW = (board.columns - 1) * CELL + CELL;
  const boardH = (board.rows - 1) * rowH + CELL;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [drag, setDrag] = useState<{ id: string; cell: BoardCell } | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const propsRef = useRef(props); propsRef.current = props;
  const sizeRef = useRef(size); sizeRef.current = size;
  const g = useRef({ sx: 0, sy: 0, start: view, moved: false, hit: null as BoardHit | null, pinch: null as null | { d: number; z: number } }).current;

  const fit = () => {
    const s = sizeRef.current; if (!s.w) return;
    const z = Math.min(s.w / boardW, s.h / boardH);
    setView({ z, x: (s.w - boardW * z) / 2 + CELL / 2 * z, y: (s.h - boardH * z) / 2 + CELL / 2 * z });
  };
  const fitRef = useRef(fit); fitRef.current = fit;
  useImperativeHandle(ref, () => ({
    fit: () => fitRef.current(),
    zoomBy: factor => setView(v => {
      const s = sizeRef.current; const z = Math.min(6, Math.max(0.15, v.z * factor));
      const k = z / v.z; return { z, x: s.w / 2 - (s.w / 2 - v.x) * k, y: s.h / 2 - (s.h / 2 - v.y) * k };
    }),
  }));
  const fitted = useRef(false);
  useEffect(() => {
    if (!size.w || fitted.current) return;
    fitted.current = true;
    const focus = board.tokens[0] ?? { q: 5, r: 5 };
    const p = cellPoint(focus, board.grid, CELL);
    // Start at a usable token scale, rather than fitting 80 columns into a phone.
    setView({ z: 0.85, x: size.w / 2 - p.x * 0.85, y: size.h / 2 - p.y * 0.85 });
  }, [size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!size.w) return;
    props.centerRef.current = pointCell((size.w / 2 - view.x) / view.z, (size.h / 2 - view.y) / view.z, board.grid, CELL);
  }, [view, size, board.grid, props.centerRef]);

  const toCell = (px: number, py: number) => {
    const v = viewRef.current;
    return pointCell((px - v.x) / v.z, (py - v.y) / v.z, propsRef.current.board.grid, CELL);
  };
  const hitAt = (cell: BoardCell, px: number, py: number): BoardHit | null => {
    const b = propsRef.current.board;
    const vis = visibleTokens(b, propsRef.current.characters);
    const v = viewRef.current;
    const wx = (px - v.x) / v.z, wy = (py - v.y) / v.z;
    for (const t of vis) {
      const ch = propsRef.current.characters.find(k => k.id === t.characterId);
      if (!ch?.vehicle) continue;
      const tp = cellPoint(t, b.grid, CELL);
      const ids = [ch.vehicleCrew?.pilotCharacterId, ch.vehicleCrew?.gunnerCharacterId].filter(Boolean) as string[];
      for (let i = 0; i < ids.length; i++) {
        const slot = ids.length === 2 ? i : 0;
        if (Math.hypot(wx - (tp.x - 9 + slot * 18), wy - (tp.y - CELL * 0.44 - 2)) <= 9) return { kind: 'crew', id: ids[i] };
      }
    }
    const inFp = (t: BoardToken) => footprint(t, b.grid).some(f => f.q === cell.q && f.r === cell.r);
    const t = [...vis].reverse().find(inFp);
    if (t) return { kind: 'token', id: t.characterId };
    const o = [...b.obstacles].reverse().find(ob => inFp(ob as unknown as BoardToken));
    return o ? { kind: 'obstacle', id: o.id } : null;
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      g.sx = e.nativeEvent.locationX; g.sy = e.nativeEvent.locationY; g.start = viewRef.current; g.moved = false; g.pinch = null;
      g.hit = hitAt(toCell(g.sx, g.sy), g.sx, g.sy);
    },
    onPanResponderMove: (e, gs) => {
      const touches = e.nativeEvent.touches;
      if (touches && touches.length >= 2) {
        if (!propsRef.current.cameraControlsEnabled) { g.moved = true; return; }
        const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        if (!g.pinch) g.pinch = { d, z: viewRef.current.z };
        g.moved = true;
        const z = Math.min(6, Math.max(0.15, g.pinch.z * d / Math.max(1, g.pinch.d)));
        setView(v => { const s = sizeRef.current; const k = z / v.z; return { z, x: s.w / 2 - (s.w / 2 - v.x) * k, y: s.h / 2 - (s.h / 2 - v.y) * k }; });
        return;
      }
      if (Math.abs(gs.dx) + Math.abs(gs.dy) > 7) g.moved = true;
      if (!g.moved || g.pinch) return;
      if (g.hit?.kind === 'token' && propsRef.current.dragEnabled) setDrag({ id: g.hit.id, cell: toCell(g.sx + gs.dx, g.sy + gs.dy) });
      else if (propsRef.current.cameraControlsEnabled) setView({ ...g.start, x: g.start.x + gs.dx, y: g.start.y + gs.dy });
    },
    onPanResponderRelease: (_e, gs) => {
      const p = propsRef.current;
      if (!g.moved) p.onTap(toCell(g.sx, g.sy), g.hit);
      else if (g.hit?.kind === 'token' && p.dragEnabled && !g.pinch) p.onDrop(g.hit.id, toCell(g.sx + gs.dx, g.sy + gs.dy));
      g.moved = false; g.pinch = null; setDrag(null);
    },
    onPanResponderTerminate: () => { g.moved = false; g.pinch = null; setDrag(null); },
  })).current;

  // Smooth token moves: eased interpolation of a display offset; skipped under reduced motion.
  const [reduceMotion, setReduceMotion] = useState(false);
  const [, tick] = useState(0);
  const anim = useRef(new Map<string, { fx: number; fy: number; tx: number; ty: number; t0: number }>()).current;
  const lastPos = useRef(new Map<string, { x: number; y: number }>()).current;
  const raf = useRef<number | null>(null);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => { sub?.remove?.(); if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, []);
  const easeAt = (a: { t0: number }, now: number) => { const k = Math.min(1, (now - a.t0) / 280); return { k, e: 1 - Math.pow(1 - k, 3) }; };
  useEffect(() => {
    const now = Date.now();
    const ids = new Set<string>();
    for (const t of board.tokens) {
      ids.add(t.characterId);
      const p = cellPoint(t, board.grid, CELL);
      const prev = lastPos.get(t.characterId);
      if (prev && !reduceMotion && Math.hypot(prev.x - p.x, prev.y - p.y) > 0.5) {
        const cur = anim.get(t.characterId);
        let fx = prev.x, fy = prev.y;
        if (cur) { const { e } = easeAt(cur, now); fx = cur.fx + (cur.tx - cur.fx) * e; fy = cur.fy + (cur.ty - cur.fy) * e; }
        anim.set(t.characterId, { fx, fy, tx: p.x, ty: p.y, t0: now });
      }
      lastPos.set(t.characterId, p);
    }
    for (const id of [...lastPos.keys()]) if (!ids.has(id)) { lastPos.delete(id); anim.delete(id); }
    const step = () => {
      raf.current = null;
      const n = Date.now();
      for (const [id, a] of [...anim]) if (easeAt(a, n).k >= 1) anim.delete(id);
      tick(v => v + 1);
      if (anim.size) raf.current = requestAnimationFrame(step);
    };
    if (anim.size && raf.current === null) raf.current = requestAnimationFrame(step);
  }, [board.tokens, board.grid, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps
  const offsetFor = (id: string, p: { x: number; y: number }) => {
    const a = anim.get(id);
    if (!a) return { x: 0, y: 0 };
    const { e } = easeAt(a, Date.now());
    return { x: a.fx + (a.tx - a.fx) * e - p.x, y: a.fy + (a.ty - a.fy) * e - p.y };
  };

  const gridPath = useMemo(() => {
    const parts: string[] = [];
    if (board.grid === 'square') {
      for (let q = 0; q <= board.columns; q++) parts.push(`M${(q - 0.5) * CELL} ${-CELL / 2}V${(board.rows - 0.5) * CELL}`);
      for (let r = 0; r <= board.rows; r++) parts.push(`M${-CELL / 2} ${(r - 0.5) * CELL}H${(board.columns - 0.5) * CELL}`);
      return parts.join('');
    }
    for (let r = 0; r < board.rows; r++) for (let i = 0; i < board.columns; i++) {
      const q = i - Math.floor(r / 2); const p = cellPoint({ q, r }, 'hex', CELL);
      parts.push(`M${hexPoints(p.x, p.y).replace(/ /g, 'L')}Z`);
    }
    return parts.join('');
  }, [board.grid, board.columns, board.rows]);

  const shape = (cell: BoardCell, fill: string, stroke: string, key: string, opacity = 0.35) => {
    const p = cellPoint(cell, board.grid, CELL);
    return board.grid === 'hex'
      ? <Polygon key={key} points={hexPoints(p.x, p.y)} fill={fill} fillOpacity={opacity} stroke={stroke} strokeWidth={1} />
      : <Rect key={key} x={p.x - CELL / 2} y={p.y - CELL / 2} width={CELL} height={CELL} fill={fill} fillOpacity={opacity} stroke={stroke} strokeWidth={1} />;
  };

  const charOf = (id: string) => props.characters.find(ch => ch.id === id);
  const bg = board.backgroundDataUri ?? DEFAULT_TERRAIN;
  const bgS = board.backgroundScale;

  const renderToken = (t: BoardToken) => {
    const ch = charOf(t.characterId);
    const veh = !!ch?.vehicle;
    const p = cellPoint(t, board.grid, CELL);
    const fp = footprint(t, board.grid);
    const sel = props.selectedId === t.characterId;
    const role = props.attackerId === t.characterId ? c.destructive : props.defenderId === t.characterId ? c.text : null;
    const burst = props.burstTargetIds?.includes(t.characterId);
    const r = CELL * 0.44;
    const uri = veh ? (t.mapIconDataUri ?? t.imageDataUri) : (t.imageDataUri ?? ch?.portrait);
    const sc = t.imageScale ?? 1;
    const iconW = Math.max(16, t.width * CELL - 6);
    const iconH = Math.max(16, t.length * (board.grid === 'hex' ? CELL * Math.sqrt(3) / 2 : CELL) - 6);
    const tokenR = veh ? Math.max(iconW, iconH) / 2 : r;
    const vehiclePaths = veh ? vehicleTopDownSilhouette(ch?.vehicle?.category) : null;
    const hpPct = ch ? Math.max(0, Math.min(1, ch.currentHp / Math.max(1, ch.maxHp))) : 1;
    const act = props.activeId === t.characterId;
    const hue = c.secondary;
    const off = offsetFor(t.characterId, p);
    const crew = ch?.vehicle ? [ch.vehicleCrew?.pilotCharacterId, ch.vehicleCrew?.gunnerCharacterId].filter(Boolean).map(id => charOf(id as string)).filter(m => !!m && !m.inStorage) as Character[] : [];
    return (
      <G key={t.characterId} opacity={drag?.id === t.characterId ? 0.45 : 1} transform={`translate(${off.x} ${off.y})`}>
        {fp.map((f, i) => shape(f, sel ? c.primary : hue, role ?? (act ? c.primary : c.mutedForeground), `${t.characterId}-${i}`, veh ? 0.18 : 0.12))}
        {veh && uri ? (
          <G transform={`translate(${p.x} ${p.y}) rotate(${t.facing})`}>
            <SvgImage href={uri} x={(-Math.floor(t.width / 2) - 0.5) * CELL} y={(-Math.floor(t.length / 2) - 0.5) * CELL}
              width={t.width * CELL} height={t.length * CELL} preserveAspectRatio="xMidYMid meet" />
          </G>
        ) : veh ? (
          <G transform={`translate(${p.x} ${p.y}) rotate(${t.facing})`}>
            {uri ? (
              <SvgImage href={uri} x={-iconW / 2} y={-iconH / 2} width={iconW} height={iconH} preserveAspectRatio="xMidYMid meet" />
            ) : vehiclePaths ? (
              <G transform={`translate(${-iconW / 2} ${-iconH / 2}) scale(${iconW / 100} ${iconH / 80})`}>
                <Path d={vehiclePaths.body} fill={c.primary} stroke={c.background} strokeWidth={2.5} strokeLinejoin="round" />
                {vehiclePaths.detail.map((path, index) => (
                  <Path key={index} d={path} fill="none" stroke={c.background} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </G>
            ) : null}
          </G>
        ) : (
          <G>
            <Defs><ClipPath id={`clip-${t.characterId}`}><Circle cx={p.x} cy={p.y} r={r} /></ClipPath></Defs>
            <Circle cx={p.x} cy={p.y} r={r} fill={c.card} />
            {uri ? (
              <SvgImage href={uri} clipPath={`url(#clip-${t.characterId})`} preserveAspectRatio="xMidYMid slice"
                x={p.x - r * sc + (t.imageOffsetX ?? 0) * r} y={p.y - r * sc + (t.imageOffsetY ?? 0) * r} width={2 * r * sc} height={2 * r * sc} />
            ) : (
              <G transform={`translate(${p.x - r * 0.75} ${p.y - r * 0.75}) scale(${(r * 1.5) / 24})`}>
                <Path d={raceIconPath(ch?.race)} fill="none" stroke={c.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </G>
            )}
            <Circle cx={p.x} cy={p.y} r={r} fill="none" stroke={sel ? c.primary : c.background} strokeWidth={2} />
          </G>
        )}
        {role || burst ? <Circle cx={p.x} cy={p.y} r={tokenR + 4} fill="none" stroke={role ?? c.primary} strokeWidth={2} strokeDasharray={burst ? '3 3' : undefined} /> : null}
        <Rect x={p.x - tokenR} y={p.y + tokenR + 2} width={2 * tokenR} height={3} fill={c.border} />
        <Rect x={p.x - tokenR} y={p.y + tokenR + 2} width={2 * tokenR * hpPct} height={3} fill={hpPct > 0.5 ? c.primary : c.destructive} />
        <SvgText x={p.x} y={p.y + tokenR + 14} fontSize={8} fontWeight="bold" fill={c.text} stroke={c.background} strokeWidth={2.5} strokeLinejoin="round" textAnchor="middle">
          {(ch?.name ?? '?').slice(0, 14)}
        </SvgText>
        {crew.map((m, i) => {
          const cx = p.x - 9 + (crew.length === 2 ? i : 0) * 18;
          return (
            <G key={m.id}>
              <Circle cx={cx} cy={p.y - r - 2} r={7} fill={props.selectedId === m.id ? c.primary : c.background} stroke={c.primary} strokeWidth={1} />
              <SvgText x={cx} y={p.y - r + 1} fontSize={8} fontWeight="bold" fill={props.selectedId === m.id ? c.primaryForeground : c.primary} textAnchor="middle">
                {m.id === ch?.vehicleCrew?.pilotCharacterId ? 'P' : 'G'}
              </SvgText>
            </G>
          );
        })}
        {t.path ? <Path d={t.path.cells.map((cl, i) => { const q = cellPoint(cl, board.grid, CELL); return `${i ? 'L' : `M${p.x} ${p.y}L`}${q.x} ${q.y}`; }).join('')}
          stroke={t.path.check === 'failure' ? c.destructive : c.primary} strokeWidth={2} strokeDasharray="5 4" fill="none" /> : null}
      </G>
    );
  };

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const webWheel = Platform.OS === 'web' ? {
    onWheel: (e: { deltaY: number }) => {
      if (!propsRef.current.cameraControlsEnabled) return;
      setView(v => {
      const s = sizeRef.current; const z = Math.min(6, Math.max(0.15, v.z * (e.deltaY < 0 ? 1.12 : 0.89))); const k = z / v.z;
      return { z, x: s.w / 2 - (s.w / 2 - v.x) * k, y: s.h / 2 - (s.h / 2 - v.y) * k };
      });
    },
  } : {};

  return (
    <View onLayout={onLayout} style={[{ flex: 1, overflow: 'hidden', backgroundColor: c.background }, Platform.OS === 'web' ? ({ touchAction: 'none' } as object) : null]} {...(webWheel as object)}>
      <Svg width={size.w} height={size.h} pointerEvents="none">
        <G transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
          {bg ? <SvgImage href={bg} x={-CELL / 2} y={-CELL / 2} width={boardW * bgS} height={boardH * bgS} preserveAspectRatio="none" /> : null}
          <Path d={gridPath} stroke={c.text} strokeOpacity={0.28} strokeWidth={0.7 / Math.max(0.6, view.z)} fill="none" />
          {board.obstacles.map(o => {
            const p = cellPoint(o, board.grid, CELL);
            return (
              <G key={o.id} transform={`translate(${p.x} ${p.y}) rotate(${o.facing})`}>
                <SvgImage href={o.imageDataUri} x={(-Math.floor(o.width / 2) - 0.5) * CELL} y={(-Math.floor(o.length / 2) - 0.5) * CELL}
                  width={o.width * CELL} height={o.length * CELL} preserveAspectRatio="xMidYMid meet" />
                {props.selectedObstacleId === o.id ? <Rect x={(-Math.floor(o.width / 2) - 0.5) * CELL} y={(-Math.floor(o.length / 2) - 0.5) * CELL}
                  width={o.width * CELL} height={o.length * CELL} fill="none" stroke={c.primary} strokeWidth={1.5} strokeDasharray="4 3" /> : null}
              </G>
            );
          })}
          {(props.burstCells ?? []).map((cl, i) => shape(cl, c.destructive, c.destructive, `b${i}`, 0.22))}
          {(props.pathCells ?? []).map((cl, i) => shape(cl, c.primary, c.primary, `pp${i}`, 0.3))}
          {visibleTokens(board, props.characters).map(renderToken)}
          {props.impact ? (() => {
            const p = cellPoint(props.impact, board.grid, CELL);
            return (
              <G>
                {[...(props.rings ?? [])].sort((a, b) => b.radius - a.radius).map((ring, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={ring.radius * CELL} fill={ring.color} fillOpacity={0.14} stroke={ring.color} strokeWidth={2} />
                ))}
                <Path d={`M${p.x - 8} ${p.y}H${p.x + 8}M${p.x} ${p.y - 8}V${p.y + 8}`} stroke={c.destructive} strokeWidth={2.5} />
              </G>
            );
          })() : null}
          {drag ? shape(drag.cell, c.primary, c.primary, 'drag', 0.5) : null}
        </G>
      </Svg>
      <View {...responder.panHandlers} accessibilityLabel="Tactical board" testID="tactical-board-surface" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
    </View>
  );
});

export default BoardCanvas;
