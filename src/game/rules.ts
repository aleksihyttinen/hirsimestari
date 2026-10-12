import type { Building, PieceKind, Project, Target } from './types';

export const isPlaced = (p: Project, id: string) => p.placed.includes(id);

/** Targets that can take a piece now: not filled and all prerequisites placed. */
export const available = (b: Building, p: Project): Target[] =>
  b.targets.filter((t) => !isPlaced(p, t.id) && t.after.every((a) => isPlaced(p, a)));

export const availableKinds = (b: Building, p: Project): PieceKind[] => [...new Set(available(b, p).map((t) => t.kind))];

export const canPlace = (b: Building, p: Project, targetId: string, kind: PieceKind) =>
  available(b, p).some((t) => t.id === targetId && t.kind === kind);

/** Snapping: the closest available target of this kind within `max` SVG units, else null. */
export function nearestTarget(b: Building, p: Project, kind: PieceKind, x: number, y: number, max = 80): Target | null {
  let best: Target | null = null;
  let bd = max;
  for (const t of available(b, p)) {
    if (t.kind !== kind) continue;
    const d = Math.hypot(t.x + t.w / 2 - x, t.y + t.h / 2 - y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Places a piece. Invalid or repeated placements return the project unchanged. */
export function place(b: Building, p: Project, targetId: string): Project {
  const t = available(b, p).find((a) => a.id === targetId);
  if (!t) return p;
  const placed = [...p.placed, t.id];
  return { ...p, placed, phase: placed.length === b.targets.length ? 'paint' : 'build' };
}

export const undo = (p: Project): Project =>
  p.phase === 'build' && p.placed.length ? { ...p, placed: p.placed.slice(0, -1) } : p;

/** Paints (or repaints) a placed piece. `null` restores the natural colour. */
export function paint(p: Project, targetId: string, color: string | null): Project {
  if (!isPlaced(p, targetId)) return p;
  const colors = { ...p.colors };
  if (color) colors[targetId] = color; else delete colors[targetId];
  return { ...p, colors };
}

export const unplaced = (b: Building, p: Project, kind: PieceKind) =>
  b.targets.filter((t) => t.kind === kind && !isPlaced(p, t.id)).length;
