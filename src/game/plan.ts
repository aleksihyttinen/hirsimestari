import { ITEM_SIZE } from './buildings';
import type { Edge, Furniture, Item, Plan, Recipe, Room, RoomKind } from './types';

// Sisusta rules: where furniture fits on the plan grid and which rooms it makes.

/** Size in cells after turning. */
export const footprint = (f: Pick<Furniture, 'item' | 'turn'>): [number, number] => {
  const [w, h] = ITEM_SIZE[f.item];
  return f.turn % 2 ? [h, w] : [w, h];
};
const cellsOf = (f: Furniture): [number, number][] => {
  const [w, h] = footprint(f);
  return Array.from({ length: w * h }, (_, i) => [f.x + (i % w), f.y + Math.floor(i / w)]);
};
export const roomAt = (plan: Plan, x: number, y: number): Room | undefined =>
  plan.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
/** The cells on both sides of a door stay free so it can open and people can pass. */
const doorCells = (d: Edge): [number, number][] => [[d.x, d.y], d.side === 'top' ? [d.x, d.y - 1] : [d.x - 1, d.y]];

/** Why a piece cannot stand here, or null when it can. `all` may contain the piece itself (when moving or turning). */
export function whyNotFit(plan: Plan, all: Furniture[], f: Furniture): 'wall' | 'door' | 'taken' | null {
  const cells = cellsOf(f);
  const room = roomAt(plan, f.x, f.y);
  if (!room || cells.some(([x, y]) => roomAt(plan, x, y) !== room)) return 'wall';
  const key = ([x, y]: [number, number]) => `${x},${y}`;
  const mine = new Set(cells.map(key));
  if (plan.doors.some((d) => doorCells(d).some((c) => mine.has(key(c))))) return 'door';
  if ([...plan.fixed, ...all].some((o) => o.id !== f.id && cellsOf(o).some((c) => mine.has(key(c))))) return 'taken';
  return null;
}

/** The piece placed so that it covers cell `cx,cy`: top-left there if it fits, else the first position around it that does. */
export function fitNear(plan: Plan, all: Furniture[], f: Furniture, cx: number, cy: number): Furniture | null {
  const [w, h] = footprint(f);
  const tries = [{ ...f, x: cx, y: cy }];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (dx || dy) tries.push({ ...f, x: cx - dx, y: cy - dy });
  return tries.find((t) => !whyNotFit(plan, all, t)) ?? null;
}

/** A quarter turn, or a half turn when a quarter cannot fit (a sofa against a wall), kept over its own cells. */
export function turnNear(plan: Plan, all: Furniture[], f: Furniture): Furniture | null {
  for (const d of [1, 2])
    for (const [x, y] of cellsOf(f)) {
      const t = fitNear(plan, all, { ...f, turn: (f.turn + d) % 4 }, x, y);
      if (t) return t;
    }
  return null;
}

/** Cells nothing more can go in: doors, fixtures and furniture. */
export function usedCells(plan: Plan, all: Furniture[]): Set<string> {
  return new Set([...plan.doors.flatMap(doorCells), ...[...plan.fixed, ...all].flatMap(cellsOf)].map(([x, y]) => `${x},${y}`));
}

export const left = (plan: Plan, all: Furniture[], item: Item) => (plan.pieces[item] ?? 0) - all.filter((f) => f.item === item).length;

/** Share an edge (not just a corner). */
function touches(a: Furniture, b: Furniture) {
  const [aw, ah] = footprint(a);
  const [bw, bh] = footprint(b);
  const overX = a.x < b.x + bw && b.x < a.x + aw;
  const overY = a.y < b.y + bh && b.y < a.y + ah;
  return (overY && (a.x + aw === b.x || b.x + bw === a.x)) || (overX && (a.y + ah === b.y || b.y + bh === a.y));
}

/** Extra furniture never spoils a room. */
function meets(r: Recipe, fs: Furniture[], room: Room) {
  const has = (i: Item) => fs.some((f) => f.item === i);
  const [main, by, n] = r.beside ?? [];
  return (!r.entry || !!room.entry) && (r.items ?? []).every(has)
    && (!main || fs.some((a) => a.item === main && fs.filter((b) => b.item === by && touches(a, b)).length >= n!));
}
/** Room id -> what it has become: the first recipe it meets, or every one in an open-plan room. The piece amounts keep
 * each kind to what the plan needs. */
export function recognized(plan: Plan, all: Furniture[]): Record<string, RoomKind[]> {
  const out: Record<string, RoomKind[]> = {};
  for (const r of plan.rooms) {
    const fs = [...plan.fixed, ...all].filter((f) => roomAt(plan, f.x, f.y) === r);
    const ks = plan.recipes.filter((k) => meets(k, fs, r)).map((k) => k.room);
    if (ks.length) out[r.id] = r.open ? ks : ks.slice(0, 1);
  }
  return out;
}

/** The goal rooms not furnished yet, in goal order (a second bedroom is missing until two rooms are bedrooms). */
export function missing(plan: Plan, all: Furniture[]): RoomKind[] {
  const have = Object.values(recognized(plan, all)).flat();
  return plan.goal.filter((k) => { const i = have.indexOf(k); if (i < 0) return true; have.splice(i, 1); return false; });
}

/** Saved furniture from storage: drops anything malformed, unknown, extra, overlapping or not fitting. */
export function cleanFurniture(plan: Plan, raw: unknown[]): Furniture[] {
  const out: Furniture[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const { id, item, x, y, turn } = v as Record<string, unknown>;
    if (typeof id !== 'string' || typeof item !== 'string' || !(item in plan.pieces) || out.some((o) => o.id === id)) continue;
    if (!Number.isInteger(x) || !Number.isInteger(y) || ![0, 1, 2, 3].includes(turn as number)) continue;
    const f: Furniture = { id, item: item as Item, x: x as number, y: y as number, turn: turn as number };
    if (left(plan, out, f.item) > 0 && !whyNotFit(plan, out, f)) out.push(f);
  }
  return out;
}
