import { getBuilding } from './buildings';
import { cleanFurniture } from './plan';
import { finished } from './rules';
import type { Project, SaveData } from './types';

export type Store = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'hirsimestari-v1';

const blank = (): SaveData => ({ projects: [], keep: [], settings: { sound: false, big: false, speech: false, still: false } });

export const newProject = (buildingId: string, id = `p${Date.now()}`): Project =>
  ({ id, buildingId, placed: [], colors: {}, phase: 'build' });

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function cleanProject(v: unknown): Project | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.buildingId !== 'string') return null;
  const b = getBuilding(v.buildingId);
  if (!b || !Array.isArray(v.placed) || !isRecord(v.colors)) return null;
  if (v.phase !== 'build' && v.phase !== 'paint' && v.phase !== 'done') return null;
  const ids = new Set(b.targets.map((t) => t.id));
  const placed = [...new Set(v.placed.filter((x): x is string => typeof x === 'string' && ids.has(x)))];
  const colors: Record<string, string> = {};
  for (const [k, c] of Object.entries(v.colors)) if (ids.has(k) && typeof c === 'string') colors[k] = c;
  const carved = Array.isArray(v.carved) ? v.carved.filter((x): x is string => typeof x === 'string' && ids.has(x)) : [];
  const furniture = b.plan && Array.isArray(v.furniture) ? cleanFurniture(b.plan, v.furniture) : [];
  return {
    id: v.id, buildingId: v.buildingId, placed, colors,
    // A building that gained pieces goes back to building; one that lost them is not left with an empty tray.
    // A floor plan has no pieces to count: it is done only when the player said so.
    phase: b.plan ? v.phase : placed.length < b.targets.length ? 'build' : v.phase === 'build' ? finished(b) : v.phase,
    ...(v.carve === true && { carve: true }), ...(carved.length && { carved }), ...(furniture.length && { furniture }),
  };
}

/** Never throws: missing, malformed or unavailable storage gives an empty save. */
export function loadData(store: Store | null): SaveData {
  const d = blank();
  try {
    const raw: unknown = JSON.parse(store?.getItem(KEY) ?? 'null');
    if (!isRecord(raw)) return d;
    if (Array.isArray(raw.projects))
      for (const v of raw.projects) {
        const p = cleanProject(v);
        if (p) d.projects.push(p);
        // Unknown building or a field this version cannot read (e.g. after a rollback): keep it, never erase it.
        else if (isRecord(v)) d.keep.push(v);
      }
    if (isRecord(raw.settings)) for (const k of ['sound', 'big', 'speech', 'still'] as const) d.settings[k] = raw.settings[k] === true;
  } catch { /* corrupt or blocked storage: start fresh */ }
  return d;
}

export function saveData(store: Store | null, data: SaveData): void {
  const { projects, keep, settings } = data;
  try { store?.setItem(KEY, JSON.stringify({ projects: [...projects, ...keep], settings })); } catch { /* storage full or blocked: the game still works */ }
}
