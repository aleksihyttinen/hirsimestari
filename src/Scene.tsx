import { useRef, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import { DEFAULT_COLOR, FIX, SHUTOFF, type FixTool, type Material, type Tool } from './game/buildings';
import { isDrag } from './game/gesture';
import { isPlaced, openTargets } from './game/rules';
import type { Building, PieceKind, Project, Target } from './game/types';

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

export function Scene({ building, project, selKind = null, thumb = false, svgRef, onSlot, onPaint, onUse, lit = [] }: SceneProps) {
  // A shut-off is on until it is turned off, and again once its `on` target is placed.
  const shutOn = (k: PieceKind) => {
    const ts = building.targets.filter((t) => t.kind === k);
    return !ts.some((t) => !t.on && isPlaced(project, t.id)) || ts.some((t) => t.on && isPlaced(project, t.id));
  };
  const on = (t: Target) =>
    t.kind in SHUTOFF ? shutOn(t.kind) : (POWERED_BY[t.kind] ?? [t.kind]).some((k) => lit.includes(k));
  const open = thumb || project.phase !== 'build' ? [] : openTargets(building, project).map((t) => t.id);
  return (
    <svg ref={svgRef} viewBox={thumb ? '40 10 320 280' : '0 0 400 300'} role={thumb ? 'img' : 'group'} aria-label={building.name} aria-hidden={thumb || undefined}>
      {/* A room: log wall seen from inside and a plank floor; outside: grass. */}
      {building.mode === 'sisa' && (
        <>
          <rect x={0} y={0} width={400} height={270} fill={building.tiles ? '#e4ecef' : '#ecd3a4'} />
          {[30, 60, 90, 120, 150, 180, 210, 240].map((y) => <line key={y} x1={0} x2={400} y1={y} y2={y} stroke={building.tiles ? '#b9c6cc' : '#c9a46a'} strokeWidth={2} />)}
          {building.tiles && Array.from({ length: 13 }, (_, i) => <line key={i} x1={30 * (i + 1)} x2={30 * (i + 1)} y1={0} y2={270} stroke="#b9c6cc" strokeWidth={2} />)}
        </>
      )}
      <rect x={0} y={270} width={400} height={30} fill={building.mode === 'sisa' ? '#a0703f' : '#7fae7a'} />
      {/* Kivijalka under the two kengityshirret, which frames list first; or a corner stone under each. */}
      {building.mode === 'runko' && building.stones && building.targets.slice(0, 2).map((t) => <rect key={t.id} x={t.x - 4} y={t.y + t.h} width={t.w + 8} height={270 - t.y - t.h} rx={4} fill="#9a9a92" {...ST} />)}
      {building.mode === 'runko' && !building.stones && <rect x={building.targets[0]!.x - 4} y={252} width={building.targets[1]!.x + building.targets[1]!.w - building.targets[0]!.x + 8} height={18} rx={3} fill="#9a9a92" {...ST} />}
      {/* Round ends and wall fittings are small: a wider invisible area keeps them easy to tap. Drawn under every
          slot so a margin never steals a tap from a neighbouring piece (Pirtti's roof pieces sit close together). */}
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
