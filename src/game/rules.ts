import { KIND_LABEL, SHUTOFF, SHUTON } from './buildings';
import type { Building, Phase, PieceKind, Project, Target } from './types';

/** Phase after the last piece: houses go on to painting, frames and rooms are done. */
export const finished = (b: Building): Phase => (b.mode ? 'done' : 'paint');

export const isPlaced = (p: Project, id: string) => p.placed.includes(id);

/** Targets that can take a piece now: not filled and all prerequisites placed. */
export const available = (b: Building, p: Project): Target[] =>
  b.targets.filter((t) => !isPlaced(p, t.id) && t.after.every((a) => isPlaced(p, a)));

/** Slots that take a piece now. Hirsityöt opens every empty slot: finding the order is the player's challenge. */
export const openTargets = (b: Building, p: Project): Target[] =>
  b.mode === 'runko' ? b.targets.filter((t) => !isPlaced(p, t.id)) : available(b, p);

export const availableKinds = (b: Building, p: Project): PieceKind[] => [...new Set(available(b, p).map((t) => t.kind))];

/** Kinds of the unplaced pieces, sorted by label so the tray does not give the build order away. */
export const remainingKinds = (b: Building, p: Project): PieceKind[] =>
  [...new Set(b.targets.filter((t) => !isPlaced(p, t.id)).map((t) => t.kind))].sort((a, c) => KIND_LABEL[a].localeCompare(KIND_LABEL[c], 'fi'));

/** Names of the pieces that must be placed before this target. */
export const whyNot = (b: Building, p: Project, targetId: string): string[] => {
  const t = b.targets.find((x) => x.id === targetId);
  return t ? b.targets.filter((x) => t.after.includes(x.id) && !isPlaced(p, x.id)).map((x) => x.name) : [];
};

/** Hewing is on and this log has not been hewn yet. */
export const needsCarve = (b: Building, p: Project, targetId: string) =>
  !!p.carve && !!b.targets.find((t) => t.id === targetId)?.carve && !p.carved?.includes(targetId);

export const canPlace = (b: Building, p: Project, targetId: string, kind: PieceKind) =>
  available(b, p).some((t) => t.id === targetId && t.kind === kind);

/** Snapping: the closest available target of this kind within `max` SVG units, else null. */
export function nearestTarget(b: Building, p: Project, kind: PieceKind, x: number, y: number, max = 80, pool = available(b, p)): Target | null {
  let best: Target | null = null;
  let bd = max;
  for (const t of pool) {
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
  return { ...p, placed, phase: placed.length === b.targets.length ? finished(b) : 'build' };
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

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(xs: T[], rand = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Sisätyöt choices: the right item and two others, in random order, so a guess is never a coin flip. */
export const choices = <T>(right: T, all: T[], rand = Math.random): T[] =>
  shuffle([right, ...shuffle(all.filter((x) => x !== right), rand).slice(0, 2)], rand);

// "Aseta" fits both tapping and dragging; naming the piece and the ＋ keeps it concrete.
export const placeHint = (k: PieceKind) => `Aseta ${KIND_LABEL[k].toLowerCase()} kohtaan, jossa on ＋.`;
/** The piece in use: the only open kind, else the player's choice if it is still open. */
export const pickKind = (kinds: PieceKind[], selKind: PieceKind | null) =>
  kinds.length === 1 ? kinds[0]! : selKind && kinds.includes(selKind) ? selKind : null;
/** Tray kinds: Hirsityöt offers every remaining piece, the others only what fits now. Shut-offs are tapped on the wall, not in the tray. */
export const trayKinds = (b: Building, p: Project) => (b.mode === 'runko' ? remainingKinds(b, p) : availableKinds(b, p)).filter((k) => !SHUTOFF[k]);
export const hintFor = (b: Building, p: Project, selKind: PieceKind | null) => {
  const off = available(b, p).find((t) => SHUTOFF[t.kind]);
  if (off) return (off.on ? SHUTON : SHUTOFF)[off.kind]!;
  const k = pickKind(trayKinds(b, p), selKind);
  return k ? placeHint(k) : 'Valitse pala alta.';
};
