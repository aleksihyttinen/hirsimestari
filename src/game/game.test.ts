import { describe, expect, it } from 'vitest';
import { BUILDINGS, laavu, mokki, sauna } from './buildings';
import { isDrag } from './gesture';
import { available, availableKinds, canPlace, nearestTarget, paint, place, undo } from './rules';
import { loadData, newProject, saveData, type Store } from './storage';
import type { Project } from './types';

const fresh = () => newProject('sauna', 'p1');
const build = (p: Project, n: number) => {
  for (let i = 0; i < n; i++) {
    const t = available(sauna, p)[0];
    if (t) p = place(sauna, p, t.id);
  }
  return p;
};
const fakeStore = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('placement', () => {
  it('accepts the first log and rejects pieces that are not available yet', () => {
    const p = fresh();
    expect(canPlace(sauna, p, 'l0', 'log')).toBe(true);
    expect(canPlace(sauna, p, 'l1', 'log')).toBe(false); // needs l0 first
    expect(canPlace(sauna, p, 'roof', 'roof')).toBe(false);
    expect(canPlace(sauna, p, 'l0', 'door')).toBe(false); // wrong kind
  });
  it('ignores repeated or invalid placements', () => {
    const p = place(sauna, fresh(), 'l0');
    expect(place(sauna, p, 'l0')).toBe(p);
    expect(place(sauna, p, 'roof')).toBe(p);
  });
  it('follows logs -> door and window -> pier -> roof -> chimney', () => {
    expect(availableKinds(sauna, build(fresh(), 5))).toEqual(['door', 'window']);
    expect(availableKinds(sauna, build(fresh(), 6))).toEqual(['window', 'pier']);
    expect(availableKinds(sauna, build(fresh(), 8))).toEqual(['roof']);
    expect(availableKinds(sauna, build(fresh(), 9))).toEqual(['chimney']);
  });
});

describe('other buildings', () => {
  it('every building fits the picture and can be finished', () => {
    for (const b of BUILDINGS) {
      for (const t of b.targets) {
        expect(t.x >= 40 && t.x + t.w <= 360 && t.y >= 10 && t.y + t.h <= 270, `${b.id}/${t.id}`).toBe(true);
        for (const a of t.after) expect(b.targets.some((x) => x.id === a)).toBe(true);
      }
      let p = newProject(b.id, 'p');
      for (const _ of b.targets) p = place(b, p, available(b, p)[0]!.id);
      expect(p.phase).toBe('paint');
    }
  });
  it('laavu: logs, roof, fire; mökki: logs, then door and two windows, then porch and roof', () => {
    let p = newProject('laavu', 'p');
    for (let i = 0; i < 4; i++) p = place(laavu, p, `l${i}`);
    expect(availableKinds(laavu, p)).toEqual(['roof']);
    expect(availableKinds(laavu, place(laavu, p, 'roof'))).toEqual(['fire']);
    p = newProject('mokki', 'p');
    for (let i = 0; i < 6; i++) p = place(mokki, p, `l${i}`);
    expect(available(mokki, p).map((t) => t.id)).toEqual(['door', 'w1', 'w2']);
    p = place(mokki, place(mokki, p, 'door'), 'w1');
    expect(availableKinds(mokki, p)).toEqual(['window', 'porch']);
  });
});

describe('snapping', () => {
  it('snaps to the nearest available target of the same kind', () => {
    expect(nearestTarget(sauna, fresh(), 'log', 200, 250)?.id).toBe('l0');
  });
  it('returns null when too far or when the kind has no available target', () => {
    expect(nearestTarget(sauna, fresh(), 'log', 10, 10)).toBeNull();
    expect(nearestTarget(sauna, fresh(), 'roof', 200, 60)).toBeNull();
  });
});

describe('completing', () => {
  it('moves to the paint phase when the last piece is placed', () => {
    expect(build(fresh(), 9).phase).toBe('build');
    const done = build(fresh(), 10);
    expect(done.placed).toHaveLength(sauna.targets.length);
    expect(done.phase).toBe('paint');
  });
  it('undo removes the last piece only while building', () => {
    expect(undo(build(fresh(), 3)).placed).toHaveLength(2);
    const done = build(fresh(), 10);
    expect(undo(done)).toBe(done);
  });
});

describe('painting', () => {
  it('paints, repaints and restores natural colour', () => {
    let p = build(fresh(), 10);
    p = paint(p, 'roof', '#a63a2a');
    expect(p.colors.roof).toBe('#a63a2a');
    p = paint(p, 'roof', '#2f6db5');
    expect(p.colors.roof).toBe('#2f6db5');
    p = paint(p, 'roof', null);
    expect(p.colors.roof).toBeUndefined();
  });
  it('cannot paint a piece that is not placed', () => {
    const p = fresh();
    expect(paint(p, 'roof', '#a63a2a')).toBe(p);
  });
});

describe('saving', () => {
  it('restores what was saved', () => {
    const store = fakeStore();
    const data = { projects: [paint(build(fresh(), 10), 'door', '#2f6db5')], settings: { sound: true, big: false, speech: true }, keep: [] };
    saveData(store, data);
    expect(loadData(store)).toEqual(data);
  });
  it('keeps buildings from a newer version and writes them back', () => {
    const store = fakeStore();
    const future = { id: 'f', buildingId: 'linna', placed: ['x'], colors: {}, phase: 'done' };
    store.setItem('hirsimestari-v1', JSON.stringify({ projects: [future, { id: 's', buildingId: 'sauna', placed: [], colors: {}, phase: 'build' }] }));
    const d = loadData(store);
    expect(d.projects.map((p) => p.id)).toEqual(['s']);
    saveData(store, { ...d, projects: [] });
    expect(loadData(store).keep).toEqual([future]);
  });
  it('falls back to an empty save for missing, malformed or outdated data', () => {
    const store = fakeStore();
    expect(loadData(store).projects).toEqual([]);
    store.setItem('hirsimestari-v1', '{not json');
    expect(loadData(store).projects).toEqual([]);
    store.setItem('hirsimestari-v1', JSON.stringify({ projects: [{ id: 'x', buildingId: 'gone', placed: [], colors: {}, phase: 'build' }, 42] }));
    expect(loadData(store).projects).toEqual([]);
  });
  it('drops unknown pieces from a saved project', () => {
    const store = fakeStore();
    store.setItem('hirsimestari-v1', JSON.stringify({ projects: [{ id: 'x', buildingId: 'sauna', placed: ['l0', 'zzz'], colors: { zzz: '#fff' }, phase: 'build' }] }));
    const p = loadData(store).projects[0];
    expect(p?.placed).toEqual(['l0']);
    expect(p?.colors).toEqual({});
  });
  it('reopens a finished building for building when it has gained new pieces', () => {
    const store = fakeStore();
    store.setItem('hirsimestari-v1', JSON.stringify({ projects: [{ id: 'x', buildingId: 'sauna', placed: ['l0', 'l1', 'l2', 'l3', 'l4', 'door', 'window', 'roof'], colors: {}, phase: 'done' }] }));
    const p = loadData(store).projects[0]!;
    expect(p.phase).toBe('build');
    expect(availableKinds(sauna, p)).toEqual(['pier', 'chimney']);
  });
  it('does not throw without storage or when writing fails', () => {
    expect(loadData(null).projects).toEqual([]);
    const broken: Store = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(loadData(broken).projects).toEqual([]);
    expect(() => saveData(broken, loadData(null))).not.toThrow();
  });
});

describe('tap vs drag', () => {
  it('treats small movement as a tap and larger movement as a drag', () => {
    expect(isDrag(2, 3)).toBe(false);
    expect(isDrag(30, 0)).toBe(true);
  });
});
