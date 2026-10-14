import { describe, expect, it } from 'vitest';
import { BUILDINGS, CARVE_STEPS, FIX, FIX_TOOLS, KIND_LABEL, MATERIALS, SHUTOFF, SHUTON, TOOLS, aitta, keittio, kylpyhuone, laavu, loylyhuone, mokki, pirtti, sauna, talorunko } from './buildings';
import { isDrag } from './gesture';
import { available, availableKinds, canPlace, choices, hintFor, nearestTarget, needsCarve, paint, place, remainingKinds, undo, whyNot } from './rules';
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
      expect(p.phase).toBe(b.mode ? 'done' : 'paint');
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
  it('keeps a known building it cannot read instead of erasing it', () => {
    const store = fakeStore();
    const odd = { id: 'o', buildingId: 'sauna', placed: [], colors: {}, phase: 'x' };
    store.setItem('hirsimestari-v1', JSON.stringify({ projects: [odd] }));
    const d = loadData(store);
    expect(d.projects).toEqual([]);
    expect(d.keep).toEqual([odd]);
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
  it('goes on to painting when every piece is placed but the save says build', () => {
    const store = fakeStore();
    store.setItem('hirsimestari-v1', JSON.stringify({ projects: [{ ...build(fresh(), 10), phase: 'build' }] }));
    expect(loadData(store).projects[0]?.phase).toBe('paint');
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

describe('hirsityöt: aitan runko', () => {
  it('builds bottom-up: sills, joists, walls, tie, gable, then purlins and ridge', () => {
    let p = newProject('aitta', 'a1');
    expect(availableKinds(aitta, p)).toEqual(['sill']);
    for (const id of ['k1', 'k2']) p = place(aitta, p, id);
    expect(availableKinds(aitta, p)).toEqual(['joist']);
    for (const id of ['n1', 'l0', 'l1', 'l2', 'l3', 'tie', 'g0']) p = place(aitta, p, id);
    expect(availableKinds(aitta, p)).toEqual(['gable', 'purlin']);
    expect(canPlace(aitta, p, 'ridge', 'ridge')).toBe(false);
    for (const id of ['g1', 'v1', 'v2', 'ridge']) p = place(aitta, p, id);
    expect(p.phase).toBe('done'); // woodwork only, no painting
  });
  it('names what is missing and offers every remaining kind alphabetically', () => {
    const p = place(aitta, newProject('aitta', 'a1'), 'k1');
    expect(whyNot(aitta, p, 'n1')).toEqual(['Kengityshirsi 2']);
    expect(whyNot(aitta, p, 'k2')).toEqual([]);
    const kinds = remainingKinds(aitta, p);
    expect(kinds).toHaveLength(7);
    expect(kinds.map((k) => KIND_LABEL[k])).toEqual(['Kengityshirsi', 'Kurkihirsi', 'Niskahirsi', 'Päätyhirsi', 'Seinähirsi', 'Sidehirsi', 'Vuoliainen']);
  });
});

describe('hirsityöt: pirtti and hewing', () => {
  it('frames are small, medium and large and can each be finished without painting', () => {
    const frames = [aitta, talorunko, pirtti];
    expect(frames.map((b) => b.targets.length)).toEqual([13, 16, 22]);
    for (const b of frames) {
      // Scene draws the kivijalka under the first two targets.
      expect(b.targets.slice(0, 2).map((t) => t.kind), b.id).toEqual(['sill', 'sill']);
      // The tray names every frame piece; wall logs must not hide behind the house label "Hirsi".
      expect(remainingKinds(b, newProject(b.id)).map((k) => KIND_LABEL[k]), b.id).toContain('Seinähirsi');
      let p = newProject(b.id, 'r1');
      for (let i = 0; i < b.targets.length; i++) p = place(b, p, available(b, p)[0]!.id);
      expect(p.phase).toBe('done');
    }
  });
  it('asks for hewing only when chosen, only for special logs, and only once', () => {
    const p = newProject('aitta', 'a1');
    expect(needsCarve(aitta, p, 'k1')).toBe(false);
    const c = { ...p, carve: true };
    expect(needsCarve(aitta, c, 'k1')).toBe(true);
    expect(needsCarve(aitta, c, 'n1')).toBe(false);
    expect(needsCarve(aitta, { ...c, carved: ['k1'] }, 'k1')).toBe(false);
  });
  it('every hewing step needs its own tool, and every tool is offered', () => {
    expect(new Set(CARVE_STEPS.map((s) => s.tool)).size).toBe(CARVE_STEPS.length);
    expect(TOOLS.map((t) => t.id).sort()).toEqual(CARVE_STEPS.map((s) => s.tool).sort());
  });
  it('saves the hewing choice and drops unknown hewn ids', () => {
    const store = fakeStore();
    const p = { ...newProject('aitta', 'a1'), carve: true, carved: ['k1', 'zz', 5] } as unknown as Project;
    saveData(store, { projects: [p], keep: [], settings: { sound: false, big: false, speech: false } });
    const q = loadData(store).projects[0]!;
    expect(q.carve).toBe(true);
    expect(q.carved).toEqual(['k1']);
  });
});

describe('Sisätyöt', () => {
  it('keittiö: power off, then water off, then electrics and plumbing; tap last', () => {
    let p = newProject('keittio', 'k');
    expect(availableKinds(keittio, p)).toEqual(['breaker']);
    p = place(keittio, p, 'breaker');
    expect(availableKinds(keittio, p)).toEqual(['valve']);
    p = place(keittio, p, 'valve');
    expect(availableKinds(keittio, p)).toEqual(['cable', 'pipe']);
    expect(whyNot(keittio, p, 'tap')).toEqual(['Tiskiallas']);
    expect(whyNot(keittio, p, 'light')).toEqual(['Valokatkaisija']);
  });
  it('wet rooms close the water after the power; the löylyhuone has no water work', () => {
    let p = place(kylpyhuone, newProject('kylpyhuone', 'k'), 'breaker');
    expect(availableKinds(kylpyhuone, p)).toEqual(['valve']);
    p = place(kylpyhuone, p, 'valve');
    expect(availableKinds(kylpyhuone, p)).toEqual(['cable', 'pipe']);
    expect(whyNot(kylpyhuone, p, 'tap')).toEqual(['Pesuallas']);
    expect(loylyhuone.targets.some((t) => t.kind === 'valve' || t.kind === 'pipe')).toBe(false);
    expect(availableKinds(loylyhuone, newProject('loylyhuone', 'l'))).toEqual(['breaker']);
    expect(whyNot(loylyhuone, place(loylyhuone, newProject('loylyhuone', 'l'), 'breaker'), 'kiuas')).toEqual(['Ohjauskeskus']);
  });
  it('the last steps open the water, then turn the power back on', () => {
    for (const b of [keittio, kylpyhuone, loylyhuone]) {
      const water = b.targets.some((t) => t.id === 'valve');
      let p = newProject(b.id, 'x');
      for (const t of b.targets.filter((x) => !x.on)) p = place(b, p, t.id);
      expect(p.phase, b.id).toBe('build');
      expect(available(b, p).map((t) => t.id)).toEqual([water ? 'valve-on' : 'breaker-on']);
      expect(hintFor(b, p, null), b.id).toBe(water ? SHUTON.valve : SHUTON.breaker);
      if (water) p = place(b, p, 'valve-on');
      expect(available(b, p).map((t) => t.id)).toEqual(['breaker-on']);
      p = place(b, p, 'breaker-on');
      expect(p.phase).toBe('done');
    }
  });
  it('every room piece but the shut-offs is fastened, at one to three spots on the piece', () => {
    for (const b of BUILDINGS.filter((x) => x.mode === 'sisa'))
      for (const t of b.targets) {
        const f = FIX[t.kind];
        expect(!!f, `${b.id}/${t.id}`).toBe(!SHUTOFF[t.kind]);
        if (!f) continue;
        expect(MATERIALS.find((m) => m.id === f.material)?.why && FIX_TOOLS.some((x) => x.id === f.tool)).toBeTruthy();
        expect(f.spots.length >= 1 && f.spots.length <= 3).toBe(true);
        for (const [x, y] of f.spots) expect(x >= 0 && x <= 1 && y >= 0 && y <= 1).toBe(true);
      }
    expect(FIX.light!.spots.length).toBe(1);
  });
  it('offers the right item and two others, each once', () => {
    const all = MATERIALS.map((m) => m.id);
    for (let i = 0; i < 50; i++) {
      const c = choices('pultti', all);
      expect(c).toContain('pultti');
      expect(c.length).toBe(3);
      expect(new Set(c).size).toBe(c.length);
    }
  });
});
