import { useEffect, useRef, useState, type DOMAttributes, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import { DEFAULT_COLOR, FIX, ITEM_LABEL, ITEM_SIZE, ROOM_LABEL, SHUTOFF, type FixTool, type Material, type Tool } from './game/buildings';
import { isDrag } from './game/gesture';
import { footprint, recognized, roomAt, usedCells } from './game/plan';
import { isPlaced, openTargets } from './game/rules';
import type { Building, Edge, Furniture, Item, PieceKind, Project, Target } from './game/types';

const ST = { stroke: '#5a3a1c', strokeWidth: 2.5, strokeLinejoin: 'round' as const };
type Box = Pick<Target, 'kind' | 'x' | 'y' | 'w' | 'h' | 'lean'>;
/** Logs seen from the side (long bars) and end-on (round, frame pieces running lengthwise). */
const BAR = new Set<PieceKind>(['log', 'wall', 'tie', 'gable']);
const ROUND = new Set<PieceKind>(['sill', 'joist', 'purlin', 'ridge']);
/** Sisätyöt: the pieces tried out in a finished room, and what each one turns on. */
const USABLE = new Set<PieceKind>(['switch', 'tap', 'shower', 'control']);
const POWERED_BY: Partial<Record<PieceKind, PieceKind[]>> = { light: ['switch'], lamp: ['control'], kiuas: ['control'] };
/** Shut-offs are tapped, not placed: the ring says what tapping does. */
const SHUT_VERB: Partial<Record<PieceKind, string>> = { breaker: 'Katkaise virta', valve: 'Sulje vesi' };
const ON_VERB: Partial<Record<PieceKind, string>> = { breaker: 'Kytke virta', valve: 'Avaa vesi' };

// A lean roof is a 20-unit thick slab rising from bottom-left to top-right.
const roofPoints = ({ x, y, w, h, lean }: Box) =>
  lean ? `${x},${y + h - 20} ${x + w},${y} ${x + w},${y + 20} ${x},${y + h}` : `${x},${y + h} ${x + w},${y + h} ${x + w / 2},${y}`;

/** A placed piece. `on`: power or water on, the light lit, the tap running. */
function Shape({ t, fill, on = false }: { t: Box; fill: string; on?: boolean }) {
  const { x, y, w, h } = t;
  // The lever's position and its I / 0 mark show the state, not the colour.
  if (t.kind === 'breaker')
    return (
      <>
        <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} {...ST} />
        <rect x={x + w / 2 - 7} y={y + 8} width={14} height={h - 16} rx={4} fill="#5a5a52" />
        <rect x={x + w / 2 - 10} y={on ? y + 8 : y + h / 2} width={20} height={h / 2 - 8} rx={4} fill="#f4f0e8" {...ST} />
        <text x={x + w / 2} y={(on ? y + 8 : y + h / 2) + h / 4 + 1} textAnchor="middle" fontSize={14} fontWeight={700} fill="#2b2118">{on ? 'I' : '0'}</text>
      </>
    );
  // Handle along the pipe = open, across it = closed.
  if (t.kind === 'valve')
    return (
      <>
        <rect x={x} y={y + h - 14} width={w} height={14} rx={7} fill={DEFAULT_COLOR.pipe} {...ST} />
        <rect x={x + w / 2 - 4} y={y + h - 26} width={8} height={14} fill="#9aa3ab" {...ST} />
        {on ? <rect x={x + 2} y={y + h - 34} width={w - 4} height={9} rx={4} fill={fill} {...ST} /> : <rect x={x + w / 2 - 5} y={y} width={10} height={h - 24} rx={4} fill={fill} {...ST} />}
      </>
    );
  if (t.kind === 'cable' || t.kind === 'pipe')
    return (
      <>
        <rect x={x} y={y + 2} width={w} height={h - 4} rx={(h - 4) / 2} fill={fill} {...ST} />
        {Array.from({ length: Math.floor(w / 50) }, (_, i) => <rect key={i} x={x + 22 + 50 * i} y={y} width={6} height={h} rx={2} fill="#9aa3ab" {...ST} />)}
      </>
    );
  if (t.kind === 'switch' || t.kind === 'socket' || t.kind === 'control') {
    const s = Math.min(w, h);
    return (
      <>
        <rect x={x + w / 2 - 4} y={y} width={8} height={h - s} fill={DEFAULT_COLOR.cable} {...ST} />
        <rect x={x} y={y + h - s} width={w} height={s} rx={6} fill={fill} {...ST} />
        {t.kind === 'switch' ? (
          <rect x={x + w / 2 - 6} y={y + h - s * 0.8} width={12} height={s * 0.6} rx={3} fill="#fff" {...ST} />
        ) : t.kind === 'control' ? (
          <>
            <rect x={x + 5} y={y + h - s * 0.78} width={w - 10} height={s * 0.36} rx={3} fill="#cfe8d0" {...ST} />
            <text x={x + w / 2} y={y + h - s * 0.48} textAnchor="middle" fontSize={s * 0.24} fontWeight={700} fill="#2b2118">{on ? '80°' : '–'}</text>
          </>
        ) : (
          <>
            <circle cx={x + w / 2} cy={y + h - s / 2} r={s * 0.32} fill="#e2e2dc" {...ST} />
            <circle cx={x + w / 2 - s * 0.12} cy={y + h - s / 2} r={2.5} fill="#2b2118" />
            <circle cx={x + w / 2 + s * 0.12} cy={y + h - s / 2} r={2.5} fill="#2b2118" />
          </>
        )}
      </>
    );
  }
  // A lit lamp has rays as well as a glow. Light never takes taps, so the tap or kiuas under it stays usable.
  if (t.kind === 'light')
    return (
      <>
        {on && (
          <g pointerEvents="none">
            <circle cx={x + w / 2} cy={y + h - 12} r={w * 0.7} fill="#fff3a0" fillOpacity={0.8} />
            <path d={`M${x + w / 2} ${y + h}v18M${x - 4} ${y + h - 4}l-12 10M${x + w + 4} ${y + h - 4}l12 10`} stroke="#e6b422" strokeWidth={4} strokeLinecap="round" />
          </g>
        )}
        <line x1={x + w / 2} x2={x + w / 2} y1={y} y2={y + 20} stroke="#5a3a1c" strokeWidth={3} />
        <rect x={x + w / 2 - 10} y={y} width={20} height={6} rx={2} fill={fill} {...ST} />
        <polygon points={`${x + w * 0.3},${y + 18} ${x + w * 0.7},${y + 18} ${x + w},${y + h - 14} ${x},${y + h - 14}`} fill={fill} {...ST} />
        <circle cx={x + w / 2} cy={y + h - 10} r={8} fill={on ? '#fff3a0' : '#e2e2dc'} {...ST} />
      </>
    );
  if (t.kind === 'wc')
    return (
      <>
        <rect x={x + w * 0.3} y={y + h * 0.55} width={w * 0.4} height={h * 0.45 - 6} fill={fill} {...ST} />
        <rect x={x + 4} y={y + h - 8} width={w - 8} height={8} rx={3} fill={fill} {...ST} />
        <rect x={x + 6} y={y + h * 0.42 + 8} width={w - 12} height={h * 0.22} rx={10} fill={fill} {...ST} />
        <rect x={x} y={y + h * 0.42} width={w} height={12} rx={6} fill={fill} {...ST} />
        <rect x={x + 8} y={y} width={w - 16} height={h * 0.38} rx={4} fill={fill} {...ST} />
        <rect x={x + w / 2 - 7} y={y + 5} width={14} height={6} rx={2} fill="#9aa3ab" {...ST} />
      </>
    );
  // Suihku: rail, head and hose; the mixer at the bottom joins the water pipe. Running water is drawn as drops.
  if (t.kind === 'shower')
    return (
      <>
        {on && [-8, 0, 8].map((d) => <path key={d} d={`M${x + w * 0.3 + d} ${y + 22}v${h * 0.6}`} stroke="#5b9bd5" strokeWidth={3} strokeDasharray="6 5" />)}
        <rect x={x + w - 10} y={y + 10} width={6} height={h * 0.75} rx={3} fill={fill} {...ST} />
        <path d={`M${x + w * 0.3} ${y + 16}Q${x + w * 0.3} ${y + 4} ${x + w - 7} ${y + 12}`} fill="none" stroke="#5a3a1c" strokeWidth={3} />
        <ellipse cx={x + w * 0.3} cy={y + 18} rx={11} ry={6} fill={fill} {...ST} />
        <rect x={x + w / 2 - 3} y={y + h * 0.82} width={6} height={h * 0.18} fill={DEFAULT_COLOR.pipe} {...ST} />
        <rect x={x} y={y + h * 0.76} width={w} height={14} rx={7} fill={fill} {...ST} />
      </>
    );
  if (t.kind === 'basin')
    return (
      <>
        <path d={`M${x} ${y + 6}H${x + w}Q${x + w} ${y + h} ${x + w / 2} ${y + h}Q${x} ${y + h} ${x} ${y + 6}Z`} fill={fill} {...ST} />
        <rect x={x} y={y} width={w} height={12} rx={5} fill={fill} {...ST} />
      </>
    );
  if (t.kind === 'vent')
    return (
      <>
        <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} {...ST} />
        <circle cx={x + w / 2} cy={y + h / 2} r={h * 0.3} fill="#d9d4c8" {...ST} />
      </>
    );
  // Saunavalaisin: a wooden slatted shade; lit, it gets rays as well as a glow.
  if (t.kind === 'lamp')
    return (
      <>
        {on && <ellipse cx={x + w / 2} cy={y + h / 2} rx={w * 0.75} ry={h} fill="#fff3a0" fillOpacity={0.8} pointerEvents="none" />}
        <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={on ? '#fff3a0' : '#e2e2dc'} {...ST} />
        {[0.3, 0.5, 0.7].map((f) => <rect key={f} x={x + w * f - 3} y={y} width={6} height={h} fill={fill} {...ST} />)}
        {on && <path d={`M${x + w / 2} ${y + h + 4}v12M${x - 6} ${y + h / 2}h-10M${x + w + 6} ${y + h / 2}h10`} stroke="#e6b422" strokeWidth={4} strokeLinecap="round" pointerEvents="none" />}
      </>
    );
  // Sähkökiuas: stones on top, knobs on the front; when hot, heat rises in waves.
  if (t.kind === 'kiuas')
    return (
      <>
        {on && [0.3, 0.5, 0.7].map((f) => <path key={f} d={`M${x + w * f} ${y + h * 0.25}q-6 -8 0 -15t0 -15`} fill="none" stroke="#c0392b" strokeWidth={3} strokeLinecap="round" />)}
        <rect x={x + 6} y={y + h - 10} width={8} height={10} fill="#2b2118" />
        <rect x={x + w - 14} y={y + h - 10} width={8} height={10} fill="#2b2118" />
        <rect x={x} y={y + h * 0.38} width={w} height={h * 0.62 - 8} rx={4} fill={fill} {...ST} />
        {[0.15, 0.38, 0.62, 0.85, 0.27, 0.5, 0.73].map((f, i) => (
          <circle key={f} cx={x + w * f} cy={y + h * (i < 4 ? 0.36 : 0.29)} r={w * 0.12} fill="#8a8a82" {...ST} />
        ))}
        <circle cx={x + w * 0.35} cy={y + h * 0.6} r={5} fill="#d8d8d0" {...ST} />
        <circle cx={x + w * 0.65} cy={y + h * 0.6} r={5} fill="#d8d8d0" {...ST} />
      </>
    );
  // Lauteet: legs, the lower step (askellauta) and the upper seat.
  if (t.kind === 'bench')
    return (
      <>
        {[0.04, 0.48, 0.92].map((f) => <rect key={f} x={x + w * f} y={y + 10} width={w * 0.04} height={h - 10} fill={fill} {...ST} />)}
        <rect x={x + w * 0.4} y={y + h * 0.55} width={w * 0.6} height={12} rx={2} fill={fill} {...ST} />
        <rect x={x} y={y} width={w} height={14} rx={2} fill={fill} {...ST} />
      </>
    );
  if (t.kind === 'alarm')
    return (
      <>
        <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} {...ST} />
        <circle cx={x + w / 2} cy={y + h / 2} r={4} fill="#c0392b" />
      </>
    );
  if (t.kind === 'heater')
    return (
      <>
        <rect x={x} y={y} width={w} height={h} rx={14} fill={fill} {...ST} />
        <circle cx={x + w / 2} cy={y + 28} r={10} fill="#fff" {...ST} />
        <line x1={x + w / 2} x2={x + w / 2 + 6} y1={y + 28} y2={y + 22} stroke="#5a3a1c" strokeWidth={2.5} />
      </>
    );
  // Tiskiallas: cabinet, worktop and the basin in it.
  if (t.kind === 'sink')
    return (
      <>
        <rect x={x + 4} y={y + 12} width={w - 8} height={h - 12} fill={fill} {...ST} />
        <line x1={x + w / 2} x2={x + w / 2} y1={y + 20} y2={y + h - 6} {...ST} />
        <circle cx={x + w / 2 - 8} cy={y + 34} r={3} fill="#5a3a1c" />
        <circle cx={x + w / 2 + 8} cy={y + 34} r={3} fill="#5a3a1c" />
        <rect x={x} y={y} width={w} height={14} rx={3} fill="#d9d4c8" {...ST} />
        <rect x={x + w * 0.28} y={y + 3} width={w * 0.44} height={8} rx={3} fill="#b8c0c6" {...ST} />
      </>
    );
  // Running water is drawn as drops, so it does not rely on colour.
  if (t.kind === 'tap')
    return (
      <>
        {on && <path d={`M${x + 8} ${y + 20}v${h}`} stroke="#5b9bd5" strokeWidth={5} strokeDasharray="6 4" />}
        <rect x={x + w - 12} y={y + 6} width={8} height={h - 6} fill={fill} {...ST} />
        <path d={`M${x + w - 8} ${y + 8}H${x + 8}v10`} fill="none" stroke="#5a3a1c" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M${x + w - 8} ${y + 8}H${x + 8}v10`} fill="none" stroke={fill} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  if (ROUND.has(t.kind))
    return (
      <>
        <circle cx={x + w / 2} cy={y + h / 2} r={w / 2 - 1} fill={fill} {...ST} />
        <circle cx={x + w / 2} cy={y + h / 2} r={w * 0.28} fill="none" stroke="#5a3a1c" strokeOpacity={0.5} strokeWidth={1.5} />
        <circle cx={x + w / 2} cy={y + h / 2} r={2} fill="#5a3a1c" />
      </>
    );
  if (BAR.has(t.kind))
    return (
      <>
        <rect x={x} y={y + 1} width={w} height={h - 2} rx={h / 2 - 1} fill={fill} {...ST} />
        <circle cx={x + h * 0.45} cy={y + h / 2} r={h * 0.3} fill="#e8c28a" {...ST} />
        <circle cx={x + w - h * 0.45} cy={y + h / 2} r={h * 0.3} fill="#e8c28a" {...ST} />
        <line x1={x + h} x2={x + w - h} y1={y + h * 0.3} y2={y + h * 0.3} stroke="#fff" strokeOpacity={0.35} strokeWidth={3} strokeLinecap="round" />
      </>
    );
  if (t.kind === 'roof') return <polygon points={roofPoints(t)} fill={fill} {...ST} />;
  if (t.kind === 'chimney')
    return (
      <>
        <rect x={x} y={y} width={w} height={h} fill={fill} {...ST} />
        <rect x={x - 4} y={y} width={w + 8} height={7} rx={2} fill={fill} {...ST} />
      </>
    );
  if (t.kind === 'fire')
    return (
      <>
        <path d={`M${x + w * 0.2} ${y + h - 8}Q${x + w * 0.1} ${y + h * 0.4} ${x + w / 2} ${y}Q${x + w * 0.9} ${y + h * 0.4} ${x + w * 0.8} ${y + h - 8}Z`} fill={fill} {...ST} />
        <path d={`M${x} ${y + h - 2}L${x + w} ${y + h - 12}M${x} ${y + h - 12}L${x + w} ${y + h - 2}`} stroke="#5a3a1c" strokeWidth={7} strokeLinecap="round" />
      </>
    );
  // The lake under the pier is part of the piece and stays blue when painted; it spills below the box onto the ground.
  if (t.kind === 'pier')
    return (
      <>
        <rect x={x - 40} y={y + h - 4} width={w + 30} height={26} rx={10} fill="#5b9bd5" />
        {[x + 6, x + w / 2 - 3, x + w - 12].map((px) => <rect key={px} x={px} y={y + 18} width={6} height={h + 2} fill={fill} {...ST} />)}
        <rect x={x} y={y + 12} width={w} height={9} rx={2} fill={fill} {...ST} />
      </>
    );
  // Kuisti: steps, two posts and a small gable roof over the door.
  if (t.kind === 'porch')
    return (
      <>
        <rect x={x} y={y + h - 10} width={w} height={10} fill={fill} {...ST} />
        <rect x={x + 8} y={y + h - 18} width={w - 16} height={8} fill={fill} {...ST} />
        <rect x={x + 4} y={y + 30} width={8} height={h - 48} fill={fill} {...ST} />
        <rect x={x + w - 12} y={y + 30} width={8} height={h - 48} fill={fill} {...ST} />
        <polygon points={`${x - 4},${y + 32} ${x + w + 4},${y + 32} ${x + w / 2},${y}`} fill={fill} {...ST} />
      </>
    );
  if (t.kind === 'door')
    return (
      <>
        <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} {...ST} />
        <circle cx={x + w - 9} cy={y + h / 2} r={4} fill="#2b2118" />
      </>
    );
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} {...ST} />
      <line x1={x + w / 2} x2={x + w / 2} y1={y} y2={y + h} {...ST} />
      <line x1={x} x2={x + w} y1={y + h / 2} y2={y + h / 2} {...ST} />
    </>
  );
}

/** An empty slot: a plain solid shadow. The active one is yellow with a blue edge and a plus mark. */
function Slot({ t, hot }: { t: Target; hot: boolean }) {
  // A shut-off is the object itself: an outline round it and the ＋ at its corner, so the lever stays visible.
  if (t.kind in SHUTOFF)
    return (
      <>
        <rect x={t.x - 6} y={t.y - 6} width={t.w + 12} height={t.h + 12} rx={8} fill="transparent" stroke="#0b5cad" strokeWidth={5} />
        <circle cx={t.x + t.w + 4} cy={t.y - 4} r={14} fill="#0b5cad" />
        <path d={`M${t.x + t.w - 3} ${t.y - 4}h14M${t.x + t.w + 4} ${t.y - 11}v14`} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
      </>
    );
  const cx = t.x + t.w / 2;
  const cy = t.kind === 'roof' && !t.lean ? t.y + t.h * 0.65 : t.y + t.h / 2;
  const common = {
    fill: hot ? '#fff1b8' : '#fff', fillOpacity: hot ? 1 : 0.45,
    stroke: hot ? '#0b5cad' : '#8a8a8a', strokeWidth: hot ? 5 : 2, strokeLinejoin: 'round' as const,
  };
  return (
    <>
      {t.kind === 'roof' ? (
        <polygon points={roofPoints(t)} {...common} />
      ) : (
        <rect x={t.x} y={t.y + 1} width={t.w} height={t.h - 2} rx={ROUND.has(t.kind) ? t.w / 2 : BAR.has(t.kind) ? t.h / 2 - 1 : 4} {...common} />
      )}
      {hot && (
        <>
          <circle cx={cx} cy={cy} r={14} fill="#0b5cad" />
          <path d={`M${cx - 7} ${cy}h14M${cx} ${cy - 7}v14`} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
        </>
      )}
    </>
  );
}

const press = (fn: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick: fn,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  },
});

interface SceneProps {
  building: Building;
  project: Project;
  selKind?: PieceKind | null;
  thumb?: boolean;
  svgRef?: Ref<SVGSVGElement>;
  onSlot?: (id: string) => void;
  onPaint?: (id: string) => void;
  /** Sisätyöt, finished room: tap the switch or the tap to try it. `lit` = kinds switched on. */
  onUse?: (id: string) => void;
  lit?: PieceKind[];
  /** Sisusta: a piece is chosen (from the tray or the plan), so the free cells take taps. */
  placing?: boolean;
  selPiece?: string | null;
  onCell?: (x: number, y: number) => void;
  onPiece?: (id: string) => void;
  /** Sisusta: pointer handlers that let a placed piece be dragged, and where a dragged piece would land. */
  grab?: (id: string) => DOMAttributes<Element>;
  preview?: Furniture | null;
  /** Drawn inside another SVG (the finish view), so it needs its own size there. */
  nest?: boolean;
}

/** Hirren veisto, side view: the log as five tappable parts. A part's `level` = steps already done to it. */
export function CarveLog({ step, done, parts, label, onPart }: { step: number; done: number[]; parts: number[]; label: string; onPart: (i: number) => void }) {
  // Swipe: once the pointer moves past the tap threshold, every open part it passes over is hewn.
  // `sent` stops one part from being hewn (and beeping) several times before the next render.
  const swipe = useRef<{ x: number; y: number; start: number; active: boolean; sent: number[] } | null>(null);
  const partAt = (e: PointerEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM();
    const p = m && new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return p && p.y > 30 && p.y < 170 ? Math.floor((p.x - 30) / 68) : -1;
  };
  const hew = (i: number) => {
    const s = swipe.current;
    if (!s || s.sent.includes(i) || !parts.includes(i) || done.includes(i)) return;
    s.sent.push(i);
    onPart(i);
  };
  const end = () => { swipe.current = null; };
  return (
    <svg
      viewBox="0 0 400 200" role="group" aria-label={label} style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY, start: partAt(e), active: false, sent: [] };
      }}
      onPointerMove={(e) => {
        const s = swipe.current;
        if (!s) return;
        if (!s.active && isDrag(e.clientX - s.x, e.clientY - s.y)) {
          // Capture only now: capturing on pointerdown would send a plain tap's click to the svg instead of the part.
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
          s.active = true; hew(s.start);
        }
        if (s.active) hew(partAt(e));
      }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
    >
      {/* One log seen from the side: the parts share one outline, so hewing never changes its height. */}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 30 + 68 * i;
        const level = step + (done.includes(i) ? 1 : 0);
        return (
          <g key={i}>
            <rect x={x} y={56} width={68} height={88} fill={!level ? '#6b4a2b' : level === 1 ? '#e2b47a' : '#ebc792'} />
            {!level && [76, 100, 124].map((y) => <path key={y} d={`M${x + 8} ${y}q15 -6 26 0t26 0`} fill="none" stroke="#3d2a17" strokeWidth={3} />)}
            {level === 1 && <line x1={x} x2={x + 68} y1={74} y2={74} stroke="#fff" strokeOpacity={0.45} strokeWidth={6} />}
            {/* Veisto: the face is flat with axe marks (hakkuujälki). */}
            {level >= 2 && [10, 30, 50].map((d) => <path key={d} d={`M${x + d} 70l8 22M${x + d + 4} 100l8 22`} stroke="#b9884f" strokeWidth={2.5} strokeLinecap="round" />)}
            {/* Vara: the groove along the underside. */}
            {level >= 3 && <rect x={x} y={132} width={68} height={12} fill="#5a3a1c" />}
          </g>
        );
      })}
      {[1, 2, 3, 4].map((i) => <line key={i} x1={30 + 68 * i} x2={30 + 68 * i} y1={56} y2={144} stroke="#5a3a1c" strokeOpacity={0.35} strokeWidth={1.5} />)}
      <rect x={30} y={56} width={340} height={88} rx={6} fill="none" {...ST} />
      {/* Salvos: a notch cut up into the underside near each end; the fill hides the outline below it. */}
      {[0, 4].filter((i) => step + (done.includes(i) ? 1 : 0) >= 4).map((i) => {
        const nx = i ? 308 : 62;
        return <path key={i} d={`M${nx} 145.5V114H${nx + 30}V145.5`} fill="#dcebf2" {...ST} />;
      })}
      {parts.filter((i) => !done.includes(i)).map((i) => {
        const x = 30 + 68 * i;
        return (
          <g key={i} className="slot" aria-label={`Osa ${i + 1}`} {...press(() => onPart(i))}>
            <rect x={x + 4} y={52} width={60} height={96} rx={12} fill="transparent" stroke="#0b5cad" strokeWidth={5} />
            <circle cx={x + 34} cy={100} r={14} fill="#0b5cad" />
            <path d={`M${x + 27} 100h14M${x + 34} 93v14`} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

// A sofa with n seat cushions.
const couch = (w: number, h: number, n: number) => (
  <>
    <rect width={w} height={h * 0.35} rx={4} {...FL('#4f7aa6')} />
    <rect width={9} height={h} rx={4} {...FL('#4f7aa6')} />
    <rect x={w - 9} width={9} height={h} rx={4} {...FL('#4f7aa6')} />
    {Array.from({ length: n }, (_, i) => <rect key={i} x={9 + (i * (w - 18)) / n} y={h * 0.35} width={(w - 18) / n} height={h * 0.65} {...FL('#7fa7d9')} />)}
  </>
);
// Sisusta: furniture seen from above, drawn in its unturned box (w×h units); the front faces down.
const FL = (fill: string) => ({ fill, ...ST });
const DRAW: Record<Item, (w: number, h: number) => JSX.Element> = {
  bed: (w, h) => (
    <>
      <rect width={w} height={h} rx={4} {...FL('#f4f0e8')} />
      <rect x={5} y={5} width={w - 10} height={14} rx={5} {...FL('#fff')} />
      <rect y={h * 0.3} width={w} height={h * 0.7} rx={4} {...FL('#7fa7d9')} />
    </>
  ),
  // A bedside table with a lamp on it.
  nightstand: (w, h) => <><rect width={w} height={h} rx={3} {...FL('#b07a42')} /><circle cx={w / 2} cy={h / 2} r={w * 0.26} {...FL('#fff3a0')} /></>,
  sofa: (w, h) => couch(w, h, 3),
  loveseat: (w, h) => couch(w, h, 2),
  // A low stand with the screen standing at its back edge.
  tv: (w, h) => <><rect y={h * 0.3} width={w} height={h * 0.7} rx={3} {...FL('#b07a42')} /><rect x={w * 0.1} y={h * 0.12} width={w * 0.8} height={h * 0.28} rx={2} {...FL('#2b2118')} /></>,
  table: (w, h) => <><rect width={w} height={h} rx={6} {...FL('#c98a4b')} />{[0.27, 0.73].map((f) => <circle key={f} cx={w * f} cy={h / 2} r={h * 0.27} {...FL('#fff')} />)}</>,
  chair: (w, h) => <><rect x={4} y={h * 0.3} width={w - 8} height={h * 0.66} rx={4} {...FL('#c98a4b')} /><rect x={2} y={2} width={w - 4} height={h * 0.26} rx={3} {...FL('#8f5e30')} /></>,
  coats: (w) => (
    <>
      <rect x={2} y={2} width={w - 4} height={6} rx={2} {...FL('#b07a42')} />
      {['#a63a2a', '#2f6db5', '#3f7f4a'].map((c, i) => <rect key={c} x={4 + i * ((w - 8) / 3)} y={10} width={(w - 8) / 3 - 1} height={20} rx={3} {...FL(c)} />)}
    </>
  ),
  shoes: (w, h) => (
    <>
      <rect width={w} height={h} rx={3} {...FL('#d9b48a')} />
      {[0.3, 0.7].map((f) => <g key={f}><ellipse cx={w * f - 3} cy={h / 2} rx={3.5} ry={9} {...FL('#5a3a1c')} /><ellipse cx={w * f + 3} cy={h / 2} rx={3.5} ry={9} {...FL('#5a3a1c')} /></g>)}
    </>
  ),
  coffee: (w, h) => <><rect x={3} y={h * 0.15} width={w - 6} height={h * 0.7} rx={6} {...FL('#c98a4b')} /><rect x={w * 0.35} y={h * 0.32} width={w * 0.3} height={h * 0.36} rx={2} {...FL('#fff')} /></>,
  armchair: (w, h) => (
    <>
      <rect width={w} height={h * 0.35} rx={4} {...FL('#a65a4a')} />
      <rect width={7} height={h} rx={3} {...FL('#a65a4a')} />
      <rect x={w - 7} width={7} height={h} rx={3} {...FL('#a65a4a')} />
      <rect x={7} y={h * 0.35} width={w - 14} height={h * 0.65} {...FL('#d98a7a')} />
    </>
  ),
  // Two doors seen from above, handles at the front.
  wardrobe: (w, h) => <><rect width={w} height={h} rx={2} {...FL('#e0c79e')} /><line x1={w / 2} y1={0} x2={w / 2} y2={h} {...ST} />{[-5, 5].map((d) => <circle key={d} cx={w / 2 + d} cy={h - 6} r={2.5} fill="#5a3a1c" />)}</>,
  // A chest of drawers from above: the drawer fronts and their knobs face down.
  dresser: (w, h) => <><rect width={w} height={h} rx={2} {...FL('#9c6a3c')} /><rect x={3} y={h - 10} width={w - 6} height={7} rx={2} {...FL('#c98a4b')} />{[0.25, 0.5, 0.75].map((f) => <circle key={f} cx={w * f} cy={h - 6.5} r={2} fill="#3a2614" />)}</>,
  plant: (w, h) => <><circle cx={w / 2} cy={h / 2} r={w * 0.3} {...FL('#b5653a')} />{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={w / 2} cy={h / 2 - 9} rx={5} ry={10} transform={`rotate(${a} ${w / 2} ${h / 2})`} {...FL('#4f9a4a')} />)}</>,
  // A bench seen from above: two boards.
  bench: (w, h) => <><rect y={h * 0.2} width={w} height={h * 0.6} rx={3} {...FL('#d9b48a')} /><line x1={0} y1={h / 2} x2={w} y2={h / 2} {...ST} /></>,
  // A long farmhouse table: thick boards end to end.
  longtable: (w, h) => <><rect width={w} height={h} rx={3} {...FL('#b07a42')} />{[1 / 3, 2 / 3].map((f) => <line key={f} x1={0} y1={h * f} x2={w} y2={h * f} {...ST} />)}</>,
  // Sauna benches: light boards with gaps, the step in front.
  platform: (w, h) => <><rect width={w} height={h} rx={2} {...FL('#e8cfa0')} />{[0.25, 0.5].map((f) => <line key={f} x1={0} y1={h * f} x2={w} y2={h * f} {...ST} />)}<rect y={h * 0.7} width={w} height={h * 0.3} rx={2} {...FL('#d9b48a')} /></>,
  // A wooden bucket with water and its ladle.
  bucket: (w, h) => <><line x1={w / 2} y1={h / 2} x2={w - 3} y2={3} {...ST} /><circle cx={w / 2} cy={h / 2} r={w * 0.3} {...FL('#b07a42')} /><circle cx={w / 2} cy={h / 2} r={w * 0.2} {...FL('#cfe6ea')} /></>,
  stove: (w, h) => <><rect width={w} height={h} rx={3} {...FL('#e8e8e2')} />{[[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].map(([a, b]) => <circle key={`${a}${b}`} cx={w * a!} cy={h * b!} r={w * 0.15} fill="#3a3a38" />)}</>,
  sink: (w, h) => <><rect width={w} height={h} rx={3} {...FL('#d8d8d0')} /><rect x={5} y={10} width={w - 10} height={h - 15} rx={4} {...FL('#9aa3ab')} /><circle cx={w / 2} cy={6} r={3} fill="#5a5a52" /></>,
  shower: (w, h) => <><rect width={w} height={h} rx={3} {...FL('#e4ecef')} /><circle cx={w / 2} cy={h / 2} r={4} {...FL('#9aa3ab')} /><circle cx={7} cy={7} r={5} {...FL('#9aa3ab')} /></>,
  toilet: (w) => <><rect x={6} y={0} width={w - 12} height={10} rx={2} {...FL('#f4f0e8')} /><ellipse cx={w / 2} cy={22} rx={11} ry={12} {...FL('#f4f0e8')} /><ellipse cx={w / 2} cy={23} rx={6} ry={7} {...FL('#cfe6ea')} /></>,
  // An electric kiuas: a dark box full of stones.
  heater: (w, h) => <><rect width={w} height={h} rx={3} {...FL('#3a3a38')} />{[[0.3, 0.3], [0.7, 0.3], [0.5, 0.55], [0.3, 0.78], [0.7, 0.78]].map(([a, b]) => <circle key={`${a}${b}`} cx={w * a!} cy={h * b!} r={w * 0.14} fill="#9a948a" />)}</>,
  // A copper water kettle in its frame, the lid on top.
  kettle: (w, h) => <><rect width={w} height={h} rx={3} {...FL('#3a3a38')} /><circle cx={w / 2} cy={h / 2} r={w * 0.36} {...FL('#c06a3a')} /><circle cx={w / 2} cy={h / 2} r={w * 0.16} {...FL('#e09a6a')} /></>,
  // A square white basin with its tap at the wall: unlike the toilet's oval, so the two never look alike.
  basin: (w, h) => <><rect x={2} width={w - 4} height={h * 0.8} rx={6} {...FL('#fff')} /><rect x={8} y={9} width={w - 16} height={h * 0.8 - 14} rx={5} {...FL('#cfe6ea')} /><circle cx={w / 2} cy={5} r={3} fill="#5a5a52" /></>,
};
const CELL = 40;
const inner = (n: number) => CELL * n - 6;
/** Draws a piece in its cells, turned about its centre. */
function Piece({ f }: { f: Furniture }) {
  const [w, h] = footprint(f);
  const [w0, h0] = ITEM_SIZE[f.item];
  const cx = CELL * (f.x + w / 2);
  const cy = CELL * (f.y + h / 2);
  return <g transform={`translate(${cx} ${cy}) rotate(${f.turn * 90}) translate(${-inner(w0) / 2} ${-inner(h0) / 2})`}>{DRAW[f.item](inner(w0), inner(h0))}</g>;
}
export function ItemIcon({ item }: { item: Item }) {
  const [w, h] = ITEM_SIZE[item].map(inner) as [number, number];
  return <svg viewBox={`-3 -3 ${w + 6} ${h + 6}`} aria-hidden="true">{DRAW[item](w, h)}</svg>;
}
/** The plan cell under a screen point, or null outside the house. */
export function planCell(svg: SVGSVGElement, cols: number, rows: number, x: number, y: number): [number, number] | null {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(x, y).matrixTransform(m.inverse());
  const c: [number, number] = [Math.floor(p.x / CELL), Math.floor(p.y / CELL)];
  return c[0] >= 0 && c[0] < cols && c[1] >= 0 && c[1] < rows ? c : null;
}
const WALL = '#4a3b2c';
const FLOOR = '#efe9dc';

function PlanScene({ building, project, thumb, svgRef, placing, selPiece, onCell, onPiece, grab, preview, nest }: SceneProps) {
  const plan = building.plan!;
  const furn = project.furniture ?? [];
  const used = usedCells(plan, furn);
  // A room that has just become furnished gets its tag until the next move or for 4 s (faded by CSS), so tags never cover furniture for long.
  const named = recognized(plan, furn);
  const prev = useRef(named);
  const [fresh, setFresh] = useState<{ ids: string[]; n: number }>({ ids: [], n: 0 });
  useEffect(() => {
    const ids = Object.keys(named).filter((id) => named[id]!.some((k) => !prev.current[id]?.includes(k)));
    prev.current = named;
    // The next move hides an earlier tag (its timer is cleared with this effect).
    if (!ids.length) { setFresh((f) => (f.ids.length ? { ...f, ids: [] } : f)); return; }
    setFresh((f) => ({ ids, n: f.n + 1 }));
    const t = setTimeout(() => setFresh((f) => ({ ...f, ids: [] })), 4000);
    return () => clearTimeout(t);
  }, [project.furniture]);
  const cells = Array.from({ length: plan.cols * plan.rows }, (_, i) => [i % plan.cols, Math.floor(i / plan.cols)] as const);
  const at = (x: number, y: number) => ({ X: CELL * x, Y: CELL * y });
  // A door is a gap in the wall with its leaf swung open into the cell inside the house.
  const door = (d: Edge) => {
    const { X, Y } = at(d.x, d.y);
    const s = (d.side === 'top' ? d.y < plan.rows : d.x < plan.cols) ? 1 : -1;
    const path = d.side === 'top'
      ? `M${X + 3} ${Y}v${s * 34}M${X + 37} ${Y}A34 34 0 0 ${s > 0 ? 1 : 0} ${X + 3} ${Y + s * 34}`
      : `M${X} ${Y + 3}h${s * 34}M${X} ${Y + 37}A34 34 0 0 ${s > 0 ? 0 : 1} ${X + s * 34} ${Y + 3}`;
    return (
      <g key={`d${d.x},${d.y}${d.side}`}>
        <rect x={d.side === 'top' ? X + 3 : X - 6} y={d.side === 'top' ? Y - 6 : Y + 3} width={d.side === 'top' ? 34 : 12} height={d.side === 'top' ? 12 : 34} fill={FLOOR} />
        <path d={path} fill="none" stroke={WALL} strokeWidth={2} strokeDasharray="4 3" />
      </g>
    );
  };
  const win = (d: Edge) => {
    const { X, Y } = at(d.x, d.y);
    return <rect key={`w${d.x},${d.y}${d.side}`} x={d.side === 'top' ? X + 6 : X - 4} y={d.side === 'top' ? Y - 4 : Y + 6} width={d.side === 'top' ? 28 : 8} height={d.side === 'top' ? 8 : 28} fill="#bfe3f5" stroke={WALL} strokeWidth={1.5} />;
  };
  return (
    // No browser panning on the plan: a finger on it drags furniture.
    <svg ref={svgRef} viewBox={`-8 -8 ${CELL * plan.cols + 16} ${CELL * plan.rows + 16}`} role={thumb ? 'img' : 'group'} aria-label={building.name} aria-hidden={thumb || undefined}
      style={thumb ? undefined : { touchAction: 'none' }} {...(nest && { x: -8, y: -8, width: CELL * plan.cols + 16, height: CELL * plan.rows + 16 })}>
      <rect x={-8} y={-8} width={CELL * plan.cols + 16} height={CELL * plan.rows + 16} fill="#7fae7a" />
      {plan.rooms.map((r) => <rect key={r.id} x={at(r.x, r.y).X} y={at(r.x, r.y).Y} width={CELL * r.w} height={CELL * r.h} fill={FLOOR} />)}
      {/* The grid: furniture snaps to these cells. */}
      {!thumb && cells.map(([x, y]) => <rect key={`g${x},${y}`} x={at(x, y).X} y={at(x, y).Y} width={CELL} height={CELL} fill="none" stroke="#d6cdb8" strokeWidth={1} />)}
      {/* While a piece is chosen every cell takes a tap; the free ones are yellow (taps on the rest get a hint). */}
      {placing && onCell && cells.map(([x, y]) => {
        const r = roomAt(plan, x, y)!;
        const free = !used.has(`${x},${y}`);
        return (
          <rect key={`c${x},${y}`} className="slot" x={at(x, y).X + 2} y={at(x, y).Y + 2} width={CELL - 4} height={CELL - 4} rx={4}
            fill={free ? '#fff1b8' : 'transparent'} aria-label={`${r.name}, ruutu ${(y - r.y) * r.w + x - r.x + 1}${free ? '' : ', varattu'}`} {...press(() => onCell(x, y))} />
        );
      })}
      <g pointerEvents="none">
        {plan.rooms.map((r) => <rect key={r.id} x={at(r.x, r.y).X} y={at(r.x, r.y).Y} width={CELL * r.w} height={CELL * r.h} fill="none" stroke={WALL} strokeWidth={5} />)}
        <rect width={CELL * plan.cols} height={CELL * plan.rows} fill="none" stroke={WALL} strokeWidth={8} />
        {plan.doors.map(door)}
        {plan.windows.map(win)}
        {plan.fixed.map((f) => <Piece key={f.id} f={f} />)}
      </g>
      {furn.map((f) => {
        const [w, h] = footprint(f);
        const sel = selPiece === f.id;
        const box = { x: at(f.x, f.y).X, y: at(f.x, f.y).Y, width: CELL * w, height: CELL * h };
        return onPiece ? (
          <g key={f.id} className="slot" aria-label={ITEM_LABEL[f.item]} aria-pressed={sel} {...press(() => onPiece(f.id))} {...grab?.(f.id)}>
            <rect {...box} fill="transparent" />
            <Piece f={f} />
            {sel && <rect {...box} rx={6} fill="none" stroke="#0b5cad" strokeWidth={5} />}
          </g>
        ) : <Piece key={f.id} f={f} />;
      })}
      {/* Where a dragged piece will land: dashed, so it reads as not yet placed. */}
      {preview && (
        <g opacity={0.7} pointerEvents="none">
          <rect x={CELL * preview.x} y={CELL * preview.y} width={CELL * footprint(preview)[0]} height={CELL * footprint(preview)[1]} rx={6} fill="#fff1b8" stroke="#0b5cad" strokeWidth={4} strokeDasharray="8 5" />
          <Piece f={preview} />
        </g>
      )}
      {!thumb && plan.rooms.filter((r) => fresh.ids.includes(r.id) && named[r.id]).map((r) => {
        const label = `✓ ${named[r.id]!.map((k, i) => (i ? ROOM_LABEL[k].toLowerCase() : ROOM_LABEL[k])).join(' ja ')}`;
        const w = label.length * 7.5 + 16;
        const cx = CELL * (r.x + r.w / 2);
        const cy = CELL * (r.y + r.h / 2);
        return (
          <g key={`${r.id}${fresh.n}`} className="roomtag" pointerEvents="none">
            <rect x={cx - w / 2} y={cy - 11} width={w} height={22} rx={11} fill="#fff" stroke="#3f7f4a" strokeWidth={2.5} />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill="#2b2118">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Runs 0 → 1 over `ms` once (1 at once when `still`). */
function useClock(still: boolean, ms: number) {
  const [t, setT] = useState(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    const start = performance.now();
    let id = requestAnimationFrame(function step(now) {
      const v = Math.min(1, (now - start) / ms);
      setT(v);
      if (v < 1) id = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return t;
}
const ease = (v: number) => { const c = Math.min(1, Math.max(0, v)); return c * c * (3 - 2 * c); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const pts = (ps: [number, number][]) => ps.map((p) => p.join(',')).join(' ');
/** Finish view of a furnished floor plan: the plan tilts into a 3D view as the camera pulls back, the outer walls rise
 * with the plan's doors and windows on them, and the roof comes down over 4 s (at once when `still`). */
export function Outside({ building, project, still }: { building: Building; project: Project; still: boolean }) {
  const plan = building.plan!;
  const t = useClock(still, 4000);
  // The walls stand on the outer edge of the plan's thick outer wall (4 units out), so its marks stay inside.
  const W = CELL * plan.cols + 4, D = CELL * plan.rows + 4, b0 = -4;
  // shortcut: the ridge runs along the long x side, which every plan has; a plan deeper than wide needs the roof turned.
  const H = 104, rise = D * 0.26, o = 14;
  const a = ease(t / 0.35), h = H * ease((t - 0.35) / 0.3), r = ease((t - 0.65) / 0.3);
  const c = 0.866, sn = 0.5;
  // Top view at a = 0, isometric at a = 1; z lifts straight up on screen.
  const P = (x: number, y: number, z = 0, lift = 0): [number, number] =>
    [lerp(x, (x - y) * c, a), lerp(y, (x + y) * sn, a) - z - lift];
  const drop = (1 - r) * 120;
  const iso = (x: number, y: number, z: number): [number, number] => [(x - y) * c, (x + y) * sn - z];
  const mid = (b0 + D) / 2;
  const end = [iso(b0 - o, b0 - o, H), iso(W + o, b0 - o, H), iso(b0 - o, D + o, 0), iso(W + o, D + o, 0), iso(b0, mid, H + rise)];
  const ex = end.map((p) => p[0]), ey = end.map((p) => p[1]);
  const m = 60;
  const box = [Math.min(...ex) - m, Math.min(...ey) - m, Math.max(...ex) - Math.min(...ex) + 2 * m, Math.max(...ey) - Math.min(...ey) + 2 * m];
  const z = ease(t / 0.65);
  const vb = [lerp(-8, box[0]!, z), lerp(-8, box[1]!, z), lerp(W + 12, box[2]!, z), lerp(D + 12, box[3]!, z)];
  const log = DEFAULT_COLOR.log;
  // A wall face from (x0,y0) to (x1,y1), with log seams every 13 units.
  const wall = (k: string, x0: number, y0: number, x1: number, y1: number, fill: string) => h > 0 && (
    <g key={k}>
      <polygon points={pts([P(x0, y0), P(x1, y1), P(x1, y1, h), P(x0, y0, h)])} fill={fill} {...ST} />
      {Array.from({ length: Math.floor(h / 13) }, (_, i) => <polyline key={i} points={pts([P(x0, y0, (i + 1) * 13), P(x1, y1, (i + 1) * 13)])} fill="none" stroke="#5a3a1c" strokeWidth={1.2} opacity={0.6} />)}
    </g>
  );
  // A door or window on a front wall: `u0..u1` along the wall, `z0..z1` up it, cut at the wall's current height.
  const hole = (k: string, front: 'south' | 'east', u0: number, u1: number, z0: number, z1: number, fill: string) => {
    const top = Math.min(z1, h);
    if (top <= z0) return null;
    const q = (u: number, zz: number) => (front === 'south' ? P(u, D, zz) : P(W, u, zz));
    return <polygon key={k} points={pts([q(u0, z0), q(u1, z0), q(u1, top), q(u0, top)])} fill={fill} stroke={fill === '#bfe3f5' ? '#fff' : '#3a2616'} strokeWidth={3} />;
  };
  const openings = [
    ...plan.doors.filter((d) => d.side === 'top' && d.y === plan.rows).map((d) => hole(`d${d.x}`, 'south', CELL * d.x + 6, CELL * d.x + 34, 0, 84, DEFAULT_COLOR.door)),
    ...plan.doors.filter((d) => d.side === 'left' && d.x === plan.cols).map((d) => hole(`e${d.y}`, 'east', CELL * d.y + 6, CELL * d.y + 34, 0, 84, DEFAULT_COLOR.door)),
    ...plan.windows.filter((d) => d.side === 'top' && d.y === plan.rows).map((d) => hole(`w${d.x}`, 'south', CELL * d.x + 6, CELL * d.x + 34, 40, 80, '#bfe3f5')),
    ...plan.windows.filter((d) => d.side === 'left' && d.x === plan.cols).map((d) => hole(`v${d.y}`, 'east', CELL * d.y + 6, CELL * d.y + 34, 40, 80, '#bfe3f5')),
  ];
  // The roof, dropped from above while it fades in; the eaves stick out by `o`, the gable ends are flush with the walls.
  const R = (x: number, y: number, zz: number) => P(x, y, zz, drop);
  const eave = H - o * (rise / (mid - b0));
  return (
    <svg viewBox={vb.join(' ')} role="img" aria-label={`${building.name} on valmis`}>
      {/* Far wider than the view, so the grass fills a box of any shape. */}
      <rect x={vb[0]! - 2000} y={vb[1]! - 2000} width={vb[2]! + 4000} height={vb[3]! + 4000} fill="#7fae7a" />
      <g transform={`matrix(${1 - a + a * c} ${a * sn} ${-a * c} ${1 - a + a * sn} 0 0)`}>
        <Scene building={building} project={project} thumb nest />
      </g>
      {/* Back walls first (seen from inside while they rise), then the front ones over the rooms. */}
      {wall('n', b0, b0, W, b0, '#e2bd8c')}
      {wall('w', b0, D, b0, b0, '#e2bd8c')}
      {wall('s', b0, D, W, D, log)}
      {wall('e', W, D, W, b0, '#a86f3a')}
      {openings}
      {r > 0 && (
        <g opacity={r}>
          <polygon points={pts([R(b0, mid, H + rise), R(W, mid, H + rise), R(W, b0 - o, eave), R(b0, b0 - o, eave)])} fill="#7a3826" {...ST} />
          <polygon points={pts([R(W, b0, H), R(W, D, H), R(W, mid, H + rise)])} fill="#a86f3a" {...ST} />
          <polygon points={pts([R(b0, mid, H + rise), R(W, mid, H + rise), R(W, D + o, eave), R(b0, D + o, eave)])} fill={DEFAULT_COLOR.roof} {...ST} />
        </g>
      )}
    </svg>
  );
}

/** Finish view of a Rakenna house, drawn from its gable end: the front stays as built and painted, and over 3.5 s the
 * logs, roof and chimney grow back into depth as the camera pulls out (at once when `still`). */
/** Convex hull of points (monotone chain), for a log swept back into depth. */
function hull(ps: [number, number][]) {
  const s = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const h: [number, number][] = [];
    for (const p of list) {
      while (h.length > 1 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  return [...half(s), ...half(s.reverse())];
}
/** The outline of a log as drawn in `Shape` (a bar with round ends), moved by `dx,dy`. */
const pill = (l: Target, dx: number, dy: number): [number, number][] => {
  const r = l.h / 2 - 1, cy = l.y + l.h / 2 + dy;
  return Array.from({ length: 13 }, (_, i) => (Math.PI / 12) * i - Math.PI / 2).flatMap((a): [number, number][] => [
    [l.x + r + dx - r * Math.cos(a), cy + r * Math.sin(a)], [l.x + l.w - r + dx + r * Math.cos(a), cy + r * Math.sin(a)],
  ]);
};

/** Finish view of a Rakenna house, drawn from its gable end: the front stays as built and painted, and over 3.5 s the
 * building grows back into depth as the camera pulls out (at once when `still`). A closed house's logs become long
 * round logs; a laavu stays open, with a second log end at the back under the roof. */
export function HouseOutside({ building, project, still }: { building: Building; project: Project; still: boolean }) {
  const t = useClock(still, 3500);
  const logs = building.targets.filter((x) => x.kind === 'log');
  const x0 = Math.min(...logs.map((l) => l.x)), x1 = Math.max(...logs.map((l) => l.x + l.w));
  const roof = building.targets.find((x) => x.kind === 'roof');
  const open = !!roof?.lean;
  // Depth runs up and to the right (oblique view), so the front keeps its shape and paint.
  const kx = 0.55, ky = -0.32;
  const full = (x1 - x0) * 0.9;
  const d = full * ease(t / 0.6);
  const dx = d * kx, dy = d * ky;
  const at = (x: number, y: number, dd: number) => `${x + dd * kx},${y + dd * ky}`;
  // A face from edge (ax,ay)-(bx,by) at depth `from` back to `from + dd`, shaded by `dark`.
  const face = (k: string, ax: number, ay: number, bx: number, by: number, fill: string, dark: number, from = 0, dd = d) => (
    <g key={k}>
      <polygon points={[at(ax, ay, from), at(bx, by, from), at(bx, by, from + dd), at(ax, ay, from + dd)].join(' ')} fill={fill} {...ST} />
      <polygon points={[at(ax, ay, from), at(bx, by, from), at(bx, by, from + dd), at(ax, ay, from + dd)].join(' ')} fill="#000" opacity={dark} />
    </g>
  );
  const color = (x: Target) => project.colors[x.id] ?? DEFAULT_COLOR[x.kind];
  // Round log ends leave small gaps where two logs meet; fill them (where both logs are) so nothing shows through.
  const gaps = (ox: number, oy: number) => logs.slice(1).map((l, i) => {
    const b = logs[i]!, gx0 = Math.max(l.x, b.x), gx1 = Math.min(l.x + l.w, b.x + b.w);
    return gx1 > gx0 && <rect key={l.id} x={gx0 + ox + 2} y={l.y + l.h - l.h / 2 + oy} width={gx1 - gx0 - 4} height={l.h} fill="#6b4a2b" />;
  });
  const chimney = building.targets.find((x) => x.kind === 'chimney');
  const xs = building.targets.flatMap((x) => [x.x, x.x + x.w + full * kx]);
  const ys = building.targets.flatMap((x) => [x.y + full * ky, x.y + x.h]);
  const m = 40;
  const box = [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) - Math.min(...xs) + 2 * m, 300 - Math.min(...ys) + m];
  const z = ease(t / 0.8);
  const vb = [lerp(0, box[0]!, z), lerp(0, box[1]!, z), lerp(400, box[2]!, z), lerp(300, box[3]!, z)];
  return (
    <svg viewBox={vb.join(' ')} role="img" aria-label={`${building.name} on valmis`}>
      <defs><filter id="shade"><feColorMatrix type="matrix" values="0.72 0 0 0 0 0 0.72 0 0 0 0 0 0.72 0 0 0 0 0 1 0" /></filter></defs>
      {/* Sky, and grass whose far edge moves back with the depth. */}
      <rect x={vb[0]! - 2000} y={vb[1]! - 2000} width={vb[2]! + 4000} height={vb[3]! + 4000} fill="#dcebf2" />
      <rect x={vb[0]! - 2000} y={270 + dy - 30 * z} width={vb[2]! + 4000} height={2000} fill="#7fae7a" />
      {/* Laavu: the back log end, the same logs as the front, in shade. */}
      {open && d > 0 && (
        <g transform={`translate(${dx} ${dy})`} filter="url(#shade)">
          {gaps(0, 0)}
          <Scene building={{ ...building, targets: logs }} project={project} thumb nest />
        </g>
      )}
      {/* A closed house: each log swept back as a round log, bottom first, so the one above lies on it. */}
      {!open && d > 0 && logs.map((l) => (
        <g key={l.id}>
          <polygon points={pts(hull([...pill(l, 0, 0), ...pill(l, dx, dy)]))} fill={color(l)} {...ST} />
          <polygon points={pts(hull([...pill(l, 0, 0), ...pill(l, dx, dy)]))} fill="#000" opacity={0.22} />
          <line x1={l.x + l.w / 2} y1={l.y + l.h * 0.25} x2={l.x + l.w / 2 + dx} y2={l.y + l.h * 0.25 + dy} stroke="#fff" strokeOpacity={0.25} strokeWidth={3} />
        </g>
      ))}
      {roof && (open ? <>
        {face('rt', roof.x, roof.y + roof.h - 20, roof.x + roof.w, roof.y, color(roof), 0)}
        {face('re', roof.x + roof.w, roof.y, roof.x + roof.w, roof.y + 20, color(roof), 0.25)}
      </> : <>
        {face('rl', roof.x, roof.y + roof.h, roof.x + roof.w / 2, roof.y, color(roof), 0.12)}
        {face('rr', roof.x + roof.w / 2, roof.y, roof.x + roof.w, roof.y + roof.h, color(roof), 0)}
      </>)}
      {/* The chimney stands halfway back on the roof, so the front gable is drawn over its foot. */}
      {chimney && d > 0 && (
        <g>
          {face('ct', chimney.x, chimney.y, chimney.x + chimney.w, chimney.y, color(chimney), 0, d / 2, chimney.w)}
          {face('cr', chimney.x + chimney.w, chimney.y, chimney.x + chimney.w, chimney.y + chimney.h, color(chimney), 0.22, d / 2, chimney.w)}
          <rect x={chimney.x + (d / 2) * kx} y={chimney.y + (d / 2) * ky} width={chimney.w} height={chimney.h} fill={color(chimney)} {...ST} />
        </g>
      )}
      {gaps(0, 0)}
      <Scene building={d > 0 ? { ...building, targets: building.targets.filter((x) => x.kind !== 'chimney') } : building} project={project} thumb nest />
    </svg>
  );
}

export function Scene(props: SceneProps) {
  return props.building.plan ? <PlanScene {...props} /> : <BuildScene {...props} />;
}

function BuildScene({ building, project, selKind = null, thumb = false, svgRef, onSlot, onPaint, onUse, lit = [], nest }: SceneProps) {
  // A shut-off is on until it is turned off, and again once its `on` target is placed.
  const shutOn = (k: PieceKind) => {
    const ts = building.targets.filter((t) => t.kind === k);
    return !ts.some((t) => !t.on && isPlaced(project, t.id)) || ts.some((t) => t.on && isPlaced(project, t.id));
  };
  const on = (t: Target) =>
    t.kind in SHUTOFF ? shutOn(t.kind) : (POWERED_BY[t.kind] ?? [t.kind]).some((k) => lit.includes(k));
  const open = thumb || project.phase !== 'build' ? [] : openTargets(building, project).map((t) => t.id);
  return (
    <svg ref={svgRef} viewBox={thumb && !nest ? '40 10 320 280' : '0 0 400 300'} role={thumb ? 'img' : 'group'} aria-label={building.name} aria-hidden={thumb || undefined}
      {...(nest && { x: 0, y: 0, width: 400, height: 300 })}>
      {/* A room: log wall seen from inside and a plank floor; outside: grass. */}
      {building.mode === 'sisa' && (
        <>
          <rect x={0} y={0} width={400} height={270} fill={building.tiles ? '#e4ecef' : '#ecd3a4'} />
          {[30, 60, 90, 120, 150, 180, 210, 240].map((y) => <line key={y} x1={0} x2={400} y1={y} y2={y} stroke={building.tiles ? '#b9c6cc' : '#c9a46a'} strokeWidth={2} />)}
          {building.tiles && Array.from({ length: 13 }, (_, i) => <line key={i} x1={30 * (i + 1)} x2={30 * (i + 1)} y1={0} y2={270} stroke="#b9c6cc" strokeWidth={2} />)}
        </>
      )}
      {!nest && <rect x={0} y={270} width={400} height={30} fill={building.mode === 'sisa' ? '#a0703f' : '#7fae7a'} />}
      {/* Kivijalka under the two kengityshirret, which frames list first; or a corner stone under each. */}
      {building.mode === 'runko' && building.stones && building.targets.slice(0, 2).map((t) => <rect key={t.id} x={t.x - 4} y={t.y + t.h} width={t.w + 8} height={270 - t.y - t.h} rx={4} fill="#9a9a92" {...ST} />)}
      {building.mode === 'runko' && !building.stones && <rect x={building.targets[0]!.x - 4} y={252} width={building.targets[1]!.x + building.targets[1]!.w - building.targets[0]!.x + 8} height={18} rx={3} fill="#9a9a92" {...ST} />}
      {/* Round ends and wall fittings are small: a wider invisible area keeps them easy to tap. Drawn under every
          slot so a margin never steals a tap from a neighbouring piece (Omakotitalon runko's roof pieces sit close together). */}
      {onSlot && building.targets.filter((t) => open.includes(t.id) && !isPlaced(project, t.id) && !(t.kind in SHUTOFF) && (ROUND.has(t.kind) || Math.min(t.w, t.h) < 44)).map((t) => (
        <rect key={t.id} className="slot" x={t.x - 12} y={t.y - 12} width={t.w + 24} height={t.h + 24} fill="transparent" aria-hidden="true" onClick={() => onSlot(t.id)} />
      ))}
      {building.targets.map((t) => {
        // A turn-on target shares its shut-off's place: the shut-off draws the fixture, this only adds its slot.
        if (t.on && (isPlaced(project, t.id) || !open.includes(t.id) || !onSlot)) return null;
        if (isPlaced(project, t.id)) {
          const fill = project.colors[t.id] ?? DEFAULT_COLOR[t.kind];
          const act = thumb || project.phase === 'build' ? null
            : onPaint ? { verb: 'Maalaa', fn: onPaint } : onUse && (USABLE.has(t.kind) || t.kind in SHUTOFF) ? { verb: 'Kokeile', fn: onUse } : null;
          return act ? (
            <g key={t.id} className="slot" aria-label={`${act.verb}: ${t.name}`} {...press(() => act.fn(t.id))}>
              {/* A tap or shower is a thin shape: its whole box takes the tap, not only the lines. */}
              {act.verb === 'Kokeile' && <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="transparent" />}
              <Shape t={t} fill={fill} on={on(t)} />
            </g>
          ) : (
            <g key={t.id}><Shape t={t} fill={fill} on={on(t)} /></g>
          );
        }
        const fixture = t.kind in SHUTOFF && !t.on && <Shape t={t} fill={DEFAULT_COLOR[t.kind]} on />;
        if (!open.includes(t.id) || !onSlot) return fixture ? <g key={t.id}>{fixture}</g> : null;
        return (
          <g key={t.id} className="slot" aria-label={`${(t.on ? ON_VERB : SHUT_VERB)[t.kind] ?? 'Paikka'}: ${t.name}`} {...press(() => onSlot(t.id))}>
            {fixture}
            <Slot t={t} hot={selKind === t.kind} />
          </g>
        );
      })}
    </svg>
  );
}

const ICON: Record<PieceKind, Box> = {
  log: { kind: 'log', x: 4, y: 15, w: 82, h: 26 },
  wall: { kind: 'wall', x: 4, y: 15, w: 82, h: 26 },
  roof: { kind: 'roof', x: 4, y: 4, w: 82, h: 48 },
  door: { kind: 'door', x: 30, y: 4, w: 30, h: 48 },
  window: { kind: 'window', x: 20, y: 8, w: 50, h: 40 },
  chimney: { kind: 'chimney', x: 35, y: 6, w: 20, h: 46 },
  fire: { kind: 'fire', x: 21, y: 4, w: 48, h: 48 },
  pier: { kind: 'pier', x: 30, y: 0, w: 56, h: 30 },
  porch: { kind: 'porch', x: 27, y: 2, w: 36, h: 52 },
  sill: { kind: 'sill', x: 23, y: 6, w: 44, h: 44 },
  joist: { kind: 'joist', x: 27, y: 10, w: 36, h: 36 },
  tie: { kind: 'tie', x: 2, y: 16, w: 86, h: 24 },
  gable: { kind: 'gable', x: 14, y: 16, w: 62, h: 24 },
  purlin: { kind: 'purlin', x: 29, y: 12, w: 32, h: 32 },
  ridge: { kind: 'ridge', x: 25, y: 8, w: 40, h: 40 },
  breaker: { kind: 'breaker', x: 27, y: 2, w: 36, h: 52 },
  valve: { kind: 'valve', x: 25, y: 4, w: 40, h: 48 },
  cable: { kind: 'cable', x: 4, y: 21, w: 82, h: 14 },
  pipe: { kind: 'pipe', x: 4, y: 21, w: 82, h: 14 },
  switch: { kind: 'switch', x: 27, y: 2, w: 36, h: 52 },
  socket: { kind: 'socket', x: 27, y: 2, w: 36, h: 52 },
  light: { kind: 'light', x: 20, y: 0, w: 50, h: 56 },
  alarm: { kind: 'alarm', x: 18, y: 15, w: 54, h: 26 },
  heater: { kind: 'heater', x: 30, y: 2, w: 30, h: 52 },
  sink: { kind: 'sink', x: 5, y: 4, w: 80, h: 50 },
  tap: { kind: 'tap', x: 25, y: 10, w: 40, h: 34 },
  wc: { kind: 'wc', x: 26, y: 1, w: 38, h: 54 },
  shower: { kind: 'shower', x: 30, y: 0, w: 30, h: 56 },
  basin: { kind: 'basin', x: 10, y: 10, w: 70, h: 36 },
  vent: { kind: 'vent', x: 18, y: 14, w: 54, h: 28 },
  control: { kind: 'control', x: 26, y: 2, w: 38, h: 52 },
  lamp: { kind: 'lamp', x: 12, y: 12, w: 66, h: 32 },
  kiuas: { kind: 'kiuas', x: 24, y: 0, w: 42, h: 56 },
  bench: { kind: 'bench', x: 2, y: 4, w: 86, h: 50 },
};

/** `lean` draws the laavu roof so the tray matches the slot. */
export function Icon({ kind, lean }: { kind: PieceKind; lean?: boolean }) {
  return (
    <svg viewBox="0 0 90 56" aria-hidden="true">
      <Shape t={{ ...ICON[kind], lean }} fill={DEFAULT_COLOR[kind]} />
    </svg>
  );
}

const WOOD = '#b07a42';
const STEEL = '#9aa3ab';
/** Hewing tools, each a clearly different outline: drawknife, broad axe, gouge, saw. */
const TOOL_SHAPE: Record<Tool, JSX.Element> = {
  // Kuorimarauta: a long blade with a handle at each end, pulled towards you.
  marauta: (
    <>
      <polygon points="10,21 80,21 76,33 14,33" fill={STEEL} {...ST} />
      <rect x={2} y={10} width={12} height={36} rx={6} fill={WOOD} {...ST} />
      <rect x={76} y={10} width={12} height={36} rx={6} fill={WOOD} {...ST} />
    </>
  ),
  // Piilukirves: the broad edge runs along the handle, so the blade points to the side.
  piilukirves: (
    <>
      <rect x={4} y={9} width={62} height={8} rx={4} fill={WOOD} {...ST} />
      <polygon points="56,4 76,4 76,20 86,52 44,52 56,20" fill={STEEL} {...ST} />
    </>
  ),
  kourutaltta: (
    <>
      <rect x={4} y={20} width={34} height={16} rx={6} fill={WOOD} {...ST} />
      <rect x={38} y={24} width={32} height={8} fill={STEEL} {...ST} />
      <path d="M70 18q16 10 0 20z" fill={STEEL} {...ST} />
    </>
  ),
  // Saha: teeth along the bottom edge, leaning towards the tip (away from the handle).
  saha: (
    <>
      <path d={`M6 22L69 14V36${'l-7 6v-6'.repeat(9)}Z`} fill={STEEL} {...ST} />
      <rect x={66} y={10} width={20} height={32} rx={8} fill={WOOD} {...ST} />
      <rect x={72} y={18} width={8} height={16} rx={4} fill="#fff" {...ST} />
    </>
  ),
};

export function ToolIcon({ tool }: { tool: Tool }) {
  return <svg viewBox="0 0 90 56" aria-hidden="true">{TOOL_SHAPE[tool]}</svg>;
}

const screw = (len: number) => (
  <>
    <rect x={8} y={18} width={8} height={20} rx={2} fill={STEEL} {...ST} />
    <polygon points={`16,22 ${16 + len},26 ${16 + len},30 16,34`} fill={STEEL} {...ST} />
    {Array.from({ length: Math.floor(len / 8) }, (_, i) => <line key={i} x1={20 + 8 * i} x2={24 + 8 * i} y1={22} y2={34} stroke="#5a3a1c" strokeWidth={1.5} />)}
  </>
);
const hex = (cx: number, cy: number, r: number) =>
  <polygon points={[0, 1, 2, 3, 4, 5].map((i) => `${cx + r * Math.cos((i * Math.PI) / 3)},${cy + r * Math.sin((i * Math.PI) / 3)}`).join(' ')} fill={STEEL} {...ST} />;
/** Sisätyöt materials and tools, each a clearly different outline. The saw is the hewing one. */
const PART_SHAPE: Record<Material | FixTool, JSX.Element> = {
  naula: (
    <>
      <rect x={10} y={16} width={6} height={24} rx={2} fill={STEEL} {...ST} />
      <polygon points="16,25 74,25 84,28 74,31 16,31" fill={STEEL} {...ST} />
    </>
  ),
  puuruuvi: screw(40),
  pitkaruuvi: screw(70),
  pultti: (
    <>
      {hex(14, 28, 11)}
      <rect x={24} y={23} width={58} height={10} fill={STEEL} {...ST} />
      {hex(62, 28, 13)}
    </>
  ),
  // Kaapelikiinnike: a U clip over a cable, with its nail.
  kiinnike: (
    <>
      <rect x={10} y={30} width={70} height={12} rx={6} fill={DEFAULT_COLOR.cable} {...ST} />
      <path d="M30 44V22h30v22" fill="none" stroke="#5a3a1c" strokeWidth={8} strokeLinejoin="round" />
      <path d="M30 44V22h30v22" fill="none" stroke="#f4f0e8" strokeWidth={3.5} strokeLinejoin="round" />
      <rect x={42} y={6} width={6} height={18} fill={STEEL} {...ST} />
    </>
  ),
  // Putkenkannake: a ring round the pipe and a foot with a screw hole.
  kannake: (
    <>
      <rect x={4} y={44} width={82} height={8} rx={2} fill={STEEL} {...ST} />
      <rect x={38} y={30} width={14} height={16} fill={STEEL} {...ST} />
      <circle cx={45} cy={20} r={15} fill="none" stroke="#5a3a1c" strokeWidth={9} />
      <circle cx={45} cy={20} r={15} fill="none" stroke={STEEL} strokeWidth={5} />
    </>
  ),
  liitin: (
    <>
      <rect x={4} y={22} width={82} height={12} fill={DEFAULT_COLOR.pipe} {...ST} />
      <rect x={30} y={16} width={30} height={24} rx={3} fill="#c9a227" {...ST} />
      {hex(24, 28, 12)}
      {hex(66, 28, 12)}
    </>
  ),
  teippi: (
    <>
      <circle cx={40} cy={28} r={22} fill="#7a7a72" {...ST} />
      <circle cx={40} cy={28} r={11} fill="#fff" {...ST} />
      <path d="M58 40l26 6v8l-30 -6z" fill="#7a7a72" {...ST} />
    </>
  ),
  liima: (
    <>
      <rect x={6} y={14} width={56} height={28} rx={6} fill="#f4f0e8" {...ST} />
      <polygon points="62,20 76,24 86,28 76,32 62,36" fill="#e6b422" {...ST} />
    </>
  ),
  vasara: (
    <>
      <rect x={6} y={24} width={62} height={10} rx={5} fill={WOOD} {...ST} />
      <rect x={64} y={6} width={18} height={44} rx={3} fill={STEEL} {...ST} />
    </>
  ),
  // Akkuruuvinväännin: a pistol drill with a battery under the grip.
  ruuvain: (
    <>
      <rect x={20} y={8} width={50} height={18} rx={6} fill="#3f7f4a" {...ST} />
      <rect x={30} y={24} width={14} height={20} fill="#3f7f4a" {...ST} />
      <rect x={22} y={42} width={30} height={10} rx={2} fill="#2b2118" {...ST} />
      <rect x={70} y={14} width={16} height={6} fill={STEEL} {...ST} />
    </>
  ),
  jakoavain: (
    <>
      <rect x={6} y={24} width={56} height={10} rx={5} fill={STEEL} {...ST} />
      <path d="M58 16h20l8 8h-14v10h14l-8 8h-20z" fill={STEEL} {...ST} />
    </>
  ),
  // Saumapistooli: a cartridge in a frame, with a trigger and a nozzle.
  pistooli: (
    <>
      <rect x={14} y={12} width={50} height={18} rx={4} fill="#f4f0e8" {...ST} />
      <polygon points="64,17 84,20 84,22 64,25" fill="#e6b422" {...ST} />
      <rect x={6} y={8} width={6} height={26} fill={STEEL} {...ST} />
      <path d="M20 30l-6 20h10l6-20z" fill="#c0392b" {...ST} />
    </>
  ),
  saha: TOOL_SHAPE.saha,
  leikkuri: (
    <>
      <path d="M4 20Q30 18 52 26M4 38Q30 40 52 30" fill="none" stroke="#c0392b" strokeWidth={9} strokeLinecap="round" />
      <path d="M50 22L84 26L50 34Z" fill={STEEL} {...ST} />
      <line x1={50} x2={84} y1={28} y2={28} stroke="#5a3a1c" strokeWidth={1.5} />
    </>
  ),
};

export function PartIcon({ id }: { id: Material | FixTool }) {
  return <svg viewBox="0 0 90 56" aria-hidden="true">{PART_SHAPE[id]}</svg>;
}

/** Sisätyöt fastening: the piece drawn large with `n` fastening spots. `active` once material and tool are right. */
export function FixPiece({ kind, done, active, label, onSpot }: {
  kind: PieceKind; done: number[]; active: boolean; label: string; onSpot: (i: number) => void;
}) {
  const f = FIX[kind];
  if (!f) return null;
  return (
    <svg viewBox="0 0 400 200" role="group" aria-label={label}>
      <rect x={0} y={0} width={400} height={200} fill="#ecd3a4" />
      <g transform="translate(65 16) scale(3)"><Shape t={ICON[kind]} fill={DEFAULT_COLOR[kind]} /></g>
      {f.spots.map(([fx, fy], i) => {
        const b = ICON[kind];
        const x = 65 + 3 * (b.x + b.w * fx);
        const y = 16 + 3 * (b.y + b.h * fy);
        if (done.includes(i))
          return f.material === 'liima' ? <ellipse key={i} cx={x} cy={y} rx={16} ry={7} fill="#f4f0e8" {...ST} /> : f.material === 'pultti' || f.material === 'liitin' ? <g key={i}>{hex(x, y, 11)}</g> : (
            <g key={i}>
              <circle cx={x} cy={y} r={10} fill={STEEL} {...ST} />
              {/* A nail (also the cable clip's) has a flat head; only screws get the cross. */}
              {f.material !== 'naula' && f.material !== 'kiinnike' &&
                <path d={`M${x - 6} ${y}h12M${x} ${y - 6}v12`} stroke="#5a3a1c" strokeWidth={2.5} />}
            </g>
          );
        if (!active) return null;
        return (
          <g key={i} className="slot" aria-label={`Kiinnityskohta ${i + 1}`} {...press(() => onSpot(i))}>
            <rect x={x - 30} y={y - 34} width={60} height={68} rx={12} fill="transparent" stroke="#0b5cad" strokeWidth={5} />
            <circle cx={x} cy={y} r={14} fill="#0b5cad" />
            <path d={`M${x - 7} ${y}h14M${x} ${y - 7}v14`} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}
