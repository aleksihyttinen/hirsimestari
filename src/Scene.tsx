import type { KeyboardEvent, Ref } from 'react';
import { DEFAULT_COLOR } from './game/buildings';
import { available, isPlaced } from './game/rules';
import type { Building, PieceKind, Project, Target } from './game/types';

const ST = { stroke: '#5a3a1c', strokeWidth: 2.5, strokeLinejoin: 'round' as const };
type Box = Pick<Target, 'kind' | 'x' | 'y' | 'w' | 'h' | 'lean'>;

// A lean roof is a 20-unit thick slab rising from bottom-left to top-right.
const roofPoints = ({ x, y, w, h, lean }: Box) =>
  lean ? `${x},${y + h - 20} ${x + w},${y} ${x + w},${y + 20} ${x},${y + h}` : `${x},${y + h} ${x + w},${y + h} ${x + w / 2},${y}`;

/** A placed piece. */
function Shape({ t, fill }: { t: Box; fill: string }) {
  const { x, y, w, h } = t;
  if (t.kind === 'log')
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
        <rect x={t.x} y={t.y + 1} width={t.w} height={t.h - 2} rx={t.kind === 'log' ? t.h / 2 - 1 : 4} {...common} />
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
}

export function Scene({ building, project, selKind = null, thumb = false, svgRef, onSlot, onPaint }: SceneProps) {
  const open = thumb || project.phase !== 'build' ? [] : available(building, project).map((t) => t.id);
  return (
    <svg ref={svgRef} viewBox={thumb ? '40 10 320 280' : '0 0 400 300'} role={thumb ? 'img' : 'group'} aria-label={building.name} aria-hidden={thumb || undefined}>
      <rect x={0} y={270} width={400} height={30} fill="#7fae7a" />
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
  roof: { kind: 'roof', x: 4, y: 4, w: 82, h: 48 },
  door: { kind: 'door', x: 30, y: 4, w: 30, h: 48 },
  window: { kind: 'window', x: 20, y: 8, w: 50, h: 40 },
  chimney: { kind: 'chimney', x: 35, y: 6, w: 20, h: 46 },
  fire: { kind: 'fire', x: 21, y: 4, w: 48, h: 48 },
  pier: { kind: 'pier', x: 30, y: 0, w: 56, h: 30 },
  porch: { kind: 'porch', x: 27, y: 2, w: 36, h: 52 },
};

/** `lean` draws the laavu roof so the tray matches the slot. */
export function Icon({ kind, lean }: { kind: PieceKind; lean?: boolean }) {
  return (
    <svg viewBox="0 0 90 56" aria-hidden="true">
      <Shape t={{ ...ICON[kind], lean }} fill={DEFAULT_COLOR[kind]} />
    </svg>
  );
}
