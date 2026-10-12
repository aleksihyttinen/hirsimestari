import { useRef, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import { DEFAULT_COLOR, type Tool } from './game/buildings';
import { isDrag } from './game/gesture';
import { available, isPlaced } from './game/rules';
import type { Building, PieceKind, Project, Target } from './game/types';

const ST = { stroke: '#5a3a1c', strokeWidth: 2.5, strokeLinejoin: 'round' as const };
type Box = Pick<Target, 'kind' | 'x' | 'y' | 'w' | 'h' | 'lean'>;
/** Logs seen from the side (long bars) and end-on (round, frame pieces running lengthwise). */
const BAR = new Set<PieceKind>(['log', 'wall', 'tie', 'gable']);
const ROUND = new Set<PieceKind>(['sill', 'joist', 'purlin', 'ridge']);

// A lean roof is a 20-unit thick slab rising from bottom-left to top-right.
const roofPoints = ({ x, y, w, h, lean }: Box) =>
  lean ? `${x},${y + h - 20} ${x + w},${y} ${x + w},${y + 20} ${x},${y + h}` : `${x},${y + h} ${x + w},${y + h} ${x + w / 2},${y}`;

/** A placed piece. */
function Shape({ t, fill }: { t: Box; fill: string }) {
  const { x, y, w, h } = t;
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
      {/* Round ends are small: a wider invisible area keeps them easy to tap. */}
      {ROUND.has(t.kind) && <rect x={t.x - 12} y={t.y - 12} width={t.w + 24} height={t.h + 24} fill="transparent" />}
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

export function Scene({ building, project, selKind = null, thumb = false, svgRef, onSlot, onPaint }: SceneProps) {
  // Hirsityöt shows every empty slot: finding the right order is the player's challenge.
  const open = thumb || project.phase !== 'build' ? [] : (building.mode === 'runko' ? building.targets : available(building, project)).map((t) => t.id);
  return (
    <svg ref={svgRef} viewBox={thumb ? '40 10 320 280' : '0 0 400 300'} role={thumb ? 'img' : 'group'} aria-label={building.name} aria-hidden={thumb || undefined}>
      <rect x={0} y={270} width={400} height={30} fill="#7fae7a" />
      {/* Kivijalka under the two kengityshirret, which frames list first; or a corner stone under each. */}
      {building.mode === 'runko' && building.stones && building.targets.slice(0, 2).map((t) => <rect key={t.id} x={t.x - 4} y={t.y + t.h} width={t.w + 8} height={270 - t.y - t.h} rx={4} fill="#9a9a92" {...ST} />)}
      {building.mode === 'runko' && !building.stones && <rect x={building.targets[0]!.x - 4} y={252} width={building.targets[1]!.x + building.targets[1]!.w - building.targets[0]!.x + 8} height={18} rx={3} fill="#9a9a92" {...ST} />}
      {building.targets.map((t) => {
        if (isPlaced(project, t.id)) {
          const fill = project.colors[t.id] ?? DEFAULT_COLOR[t.kind];
          return onPaint && !thumb && project.phase !== 'build' ? (
            <g key={t.id} className="slot" aria-label={`Maalaa: ${t.name}`} {...press(() => onPaint(t.id))}>
              <Shape t={t} fill={fill} />
            </g>
          ) : (
            <g key={t.id}><Shape t={t} fill={fill} /></g>
          );
        }
        if (!open.includes(t.id) || !onSlot) return null;
        return (
          <g key={t.id} className="slot" aria-label={`Paikka: ${t.name}`} {...press(() => onSlot(t.id))}>
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
