import type { Building, PieceKind, Target } from './types';

export const KIND_LABEL: Record<PieceKind, string> = {
  log: 'Hirsi', door: 'Ovi', window: 'Ikkuna', roof: 'Katto', chimney: 'Savupiippu', fire: 'Nuotio', pier: 'Laituri', porch: 'Kuisti',
  sill: 'Kengityshirsi', joist: 'Niskahirsi', wall: 'Seinähirsi', tie: 'Sidehirsi', gable: 'Päätyhirsi', purlin: 'Vuoliainen', ridge: 'Kurkihirsi',
};
export const DEFAULT_COLOR: Record<PieceKind, string> = {
  log: '#c98a4b', door: '#8a5a2b', window: '#bfe3f5', roof: '#9a4a32', chimney: '#7a7a72', fire: '#f08a24', pier: '#d9a86a', porch: '#efe6d4',
  sill: '#8f5e30', joist: '#b07a42', wall: '#c98a4b', tie: '#a8692f', gable: '#d49a5a', purlin: '#c07f45', ridge: '#7d4f24',
};
/** Hewing tools, shown above the log not in step order. A step's `wrong` completes "<tool> ei sovi …". */
export type Tool = 'marauta' | 'piilukirves' | 'kourutaltta' | 'saha';
export const TOOLS: { id: Tool; name: string }[] = [
  { id: 'piilukirves', name: 'Piilukirves' },
  { id: 'saha', name: 'Saha' },
  { id: 'marauta', name: 'Kuorimarauta' },
  { id: 'kourutaltta', name: 'Kourutaltta' },
];
/** Hirren veisto: each step needs its tool and is tapped part by part on the log (segments 0-4). Hints do not name the tool. */
export const CARVE_STEPS: { name: string; tool: Tool; hint: string; wrong: string; parts: number[] }[] = [
  { name: 'Kuorinta', tool: 'marauta', hint: 'Kuori hirsi. Vedä sormella kuoren yli tai napauta.', wrong: 'kuorintaan', parts: [0, 1, 2, 3, 4] },
  { name: 'Veisto', tool: 'piilukirves', hint: 'Veistä hirren sivut. Vedä sormella hirren yli tai napauta.', wrong: 'sivujen veistoon', parts: [0, 1, 2, 3, 4] },
  { name: 'Vara', tool: 'kourutaltta', hint: 'Veistä vara hirren alapintaan. Vedä sormella hirren yli tai napauta.', wrong: 'varan veistoon', parts: [0, 1, 2, 3, 4] },
  { name: 'Salvos', tool: 'saha', hint: 'Tee salvokset hirren päihin. Napauta päitä.', wrong: 'salvoksiin', parts: [0, 4] },
];

/** What a frame piece does; said in Hirsityöt after placing it or when it is tried in the wrong place. */
export const KIND_INFO: Partial<Record<PieceKind, string>> = {
  sill: 'Kengityshirsi on alin hirsi. Se kantaa koko seinän.',
  joist: 'Niskahirsi kantaa lattian.',
  wall: 'Seinä rakennetaan alhaalta ylös.',
  tie: 'Sidehirsi sitoo seinät yhteen.',
  gable: 'Päätyhirret tekevät kolmion katon alle.',
  purlin: 'Vuoliainen tukee kattoa sivulta.',
  ridge: 'Kurkihirsi on katon ylin hirsi.',
};
export const PALETTE: { name: string; value: string | null }[] = [
  { name: 'Alkuperäinen', value: null },
  { name: 'Punainen', value: '#a63a2a' },
  { name: 'Keltainen', value: '#e6b422' },
  { name: 'Sininen', value: '#2f6db5' },
  { name: 'Vihreä', value: '#3f7f4a' },
  { name: 'Valkoinen', value: '#f4f0e8' },
];

/** `n` logs stacked bottom-up from the ground (y 270), each one after the one below. */
const logs = (n: number, x: number, w: number, h = 30): Target[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `l${i}`, kind: 'log', name: `Hirsi ${i + 1}`, x, y: 270 - h * (i + 1), w, h,
    after: i ? [`l${i - 1}`] : [],
  }));

// Laavu (side view): a log wall under a single sloping roof, open to the right, fire in front.
export const laavu: Building = {
  id: 'laavu',
  name: 'Laavu',
  targets: [
    // Wall steps up under the slope; the roof reaches past the wall over the open front.
    ...logs(4, 0, 0, 26).map((t, i) => ({ ...t, x: 74 + 54 * i, w: 211 - 54 * i })),
    { id: 'roof', kind: 'roof', name: 'Katto', x: 40, y: 100, w: 290, h: 160, after: ['l3'], lean: true },
    { id: 'fire', kind: 'fire', name: 'Nuotio', x: 320, y: 228, w: 40, h: 42, after: ['roof'] },
  ],
};

// Sauna: small log room, small window, a pier to the lake, chimney for the kiuas.
// Chimney comes before the roof in the list so the roof is drawn over its base.
export const sauna: Building = {
  id: 'sauna',
  name: 'Sauna',
  targets: [
    ...logs(5, 120, 200),
    { id: 'door', kind: 'door', name: 'Ovi', x: 250, y: 180, w: 34, h: 90, after: ['l4'] },
    { id: 'window', kind: 'window', name: 'Ikkuna', x: 140, y: 160, w: 40, h: 28, after: ['l4'] },
    { id: 'pier', kind: 'pier', name: 'Laituri', x: 40, y: 240, w: 80, h: 30, after: ['door'] },
    { id: 'chimney', kind: 'chimney', name: 'Savupiippu', x: 270, y: 45, w: 18, h: 50, after: ['roof'] },
    { id: 'roof', kind: 'roof', name: 'Katto', x: 100, y: 60, w: 240, h: 60, after: ['door', 'window'] },
  ],
};

// Mökki: the biggest build, two large windows, an entrance porch (kuisti) and a chimney.
export const mokki: Building = {
  id: 'mokki',
  name: 'Mökki',
  targets: [
    ...logs(6, 55, 230, 28),
    { id: 'door', kind: 'door', name: 'Ovi', x: 150, y: 180, w: 40, h: 90, after: ['l5'] },
    { id: 'w1', kind: 'window', name: 'Ikkuna 1', x: 72, y: 140, w: 56, h: 46, after: ['l5'] },
    { id: 'w2', kind: 'window', name: 'Ikkuna 2', x: 210, y: 140, w: 56, h: 46, after: ['l5'] },
    { id: 'porch', kind: 'porch', name: 'Kuisti', x: 135, y: 148, w: 70, h: 122, after: ['door'] },
    { id: 'chimney', kind: 'chimney', name: 'Savupiippu', x: 80, y: 25, w: 20, h: 60, after: ['roof'] },
    { id: 'roof', kind: 'roof', name: 'Katto', x: 40, y: 30, w: 260, h: 72, after: ['door', 'w1', 'w2'] },
  ],
};

// Hirsityöt frames, seen from the gable end: lengthwise logs show as round ends. Small, medium, large.
// Aitan runko: narrow and tall with a steep gable, raised on corner stones (nurkkakivet).
export const aitta: Building = {
  id: 'aitta',
  name: 'Aitan runko',
  mode: 'runko',
  stones: true,
  targets: [
    { id: 'k1', kind: 'sill', name: 'Kengityshirsi 1', x: 104, y: 204, w: 32, h: 32, after: [], carve: true },
    { id: 'k2', kind: 'sill', name: 'Kengityshirsi 2', x: 264, y: 204, w: 32, h: 32, after: [], carve: true },
    { id: 'n1', kind: 'joist', name: 'Niskahirsi', x: 186, y: 206, w: 28, h: 28, after: ['k1', 'k2'] },
    ...logs(4, 100, 200, 24).map((t, i) => ({ ...t, kind: 'wall' as const, name: `Seinähirsi ${i + 1}`, y: 180 - 24 * i, after: i ? t.after : ['n1'] })),
    { id: 'tie', kind: 'tie', name: 'Sidehirsi', x: 84, y: 84, w: 232, h: 24, after: ['l3'], carve: true },
    { id: 'g0', kind: 'gable', name: 'Päätyhirsi 1', x: 128, y: 62, w: 144, h: 22, after: ['tie'] },
    { id: 'g1', kind: 'gable', name: 'Päätyhirsi 2', x: 162, y: 40, w: 76, h: 22, after: ['g0'] },
    { id: 'v1', kind: 'purlin', name: 'Vuoliainen 1', x: 138, y: 40, w: 22, h: 22, after: ['g0'] },
    { id: 'v2', kind: 'purlin', name: 'Vuoliainen 2', x: 240, y: 40, w: 22, h: 22, after: ['g0'] },
    { id: 'ridge', kind: 'ridge', name: 'Kurkihirsi', x: 186, y: 12, w: 28, h: 28, after: ['g1'], carve: true },
  ],
};

// Talon runko: low and wide, three wall logs, a gentle gable and vuoliaiset out at the eaves.
export const talorunko: Building = {
  id: 'talorunko',
  name: 'Talon runko',
  mode: 'runko',
  targets: [
    { id: 'k1', kind: 'sill', name: 'Kengityshirsi 1', x: 64, y: 216, w: 36, h: 36, after: [], carve: true },
    { id: 'k2', kind: 'sill', name: 'Kengityshirsi 2', x: 300, y: 216, w: 36, h: 36, after: [], carve: true },
    ...[130, 185, 240].map((x, i) => ({ id: `n${i}`, kind: 'joist' as const, name: `Niskahirsi ${i + 1}`, x, y: 222, w: 30, h: 30, after: ['k1', 'k2'] })),
    ...logs(3, 60, 280, 28).map((t, i) => ({ ...t, kind: 'wall' as const, name: `Seinähirsi ${i + 1}`, y: 188 - 28 * i, after: i ? t.after : ['n0', 'n1', 'n2'] })),
    { id: 'tie', kind: 'tie', name: 'Sidehirsi', x: 40, y: 106, w: 320, h: 26, after: ['l2'], carve: true },
    { id: 'g0', kind: 'gable', name: 'Päätyhirsi 1', x: 90, y: 86, w: 220, h: 20, after: ['tie'] },
    { id: 'g1', kind: 'gable', name: 'Päätyhirsi 2', x: 150, y: 66, w: 100, h: 20, after: ['g0'] },
    { id: 'v1', kind: 'purlin', name: 'Vuoliainen 1', x: 64, y: 84, w: 22, h: 22, after: ['tie'] },
    { id: 'v2', kind: 'purlin', name: 'Vuoliainen 2', x: 314, y: 84, w: 22, h: 22, after: ['tie'] },
    { id: 'v3', kind: 'purlin', name: 'Vuoliainen 3', x: 116, y: 64, w: 22, h: 22, after: ['g0'] },
    { id: 'v4', kind: 'purlin', name: 'Vuoliainen 4', x: 262, y: 64, w: 22, h: 22, after: ['g0'] },
    { id: 'ridge', kind: 'ridge', name: 'Kurkihirsi', x: 186, y: 38, w: 28, h: 28, after: ['g1'], carve: true },
  ],
};

// Pirtin runko: the big one, wide and tall with a three-log gable and three pairs of vuoliaiset.
export const pirtti: Building = {
  id: 'pirtti',
  name: 'Pirtin runko',
  mode: 'runko',
  targets: [
    { id: 'k1', kind: 'sill', name: 'Kengityshirsi 1', x: 52, y: 216, w: 36, h: 36, after: [], carve: true },
    { id: 'k2', kind: 'sill', name: 'Kengityshirsi 2', x: 312, y: 216, w: 36, h: 36, after: [], carve: true },
    ...[104, 158, 214, 268].map((x, i) => ({ id: `n${i}`, kind: 'joist' as const, name: `Niskahirsi ${i + 1}`, x, y: 226, w: 26, h: 26, after: ['k1', 'k2'] })),
    ...logs(5, 48, 304, 20).map((t, i) => ({ ...t, kind: 'wall' as const, name: `Seinähirsi ${i + 1}`, y: 196 - 20 * i, after: i ? t.after : ['n0', 'n1', 'n2', 'n3'] })),
    { id: 'tie', kind: 'tie', name: 'Sidehirsi', x: 40, y: 94, w: 320, h: 22, after: ['l4'], carve: true },
    { id: 'g0', kind: 'gable', name: 'Päätyhirsi 1', x: 80, y: 74, w: 240, h: 20, after: ['tie'] },
    { id: 'g1', kind: 'gable', name: 'Päätyhirsi 2', x: 120, y: 54, w: 160, h: 20, after: ['g0'] },
    { id: 'g2', kind: 'gable', name: 'Päätyhirsi 3', x: 160, y: 36, w: 80, h: 18, after: ['g1'] },
    { id: 'v1', kind: 'purlin', name: 'Vuoliainen 1', x: 94, y: 52, w: 22, h: 22, after: ['g0'] },
    { id: 'v2', kind: 'purlin', name: 'Vuoliainen 2', x: 284, y: 52, w: 22, h: 22, after: ['g0'] },
    { id: 'v3', kind: 'purlin', name: 'Vuoliainen 3', x: 134, y: 32, w: 22, h: 22, after: ['g1'] },
    { id: 'v4', kind: 'purlin', name: 'Vuoliainen 4', x: 244, y: 32, w: 22, h: 22, after: ['g1'] },
    { id: 'v5', kind: 'purlin', name: 'Vuoliainen 5', x: 54, y: 72, w: 22, h: 22, after: ['tie'] },
    { id: 'v6', kind: 'purlin', name: 'Vuoliainen 6', x: 324, y: 72, w: 22, h: 22, after: ['tie'] },
    { id: 'ridge', kind: 'ridge', name: 'Kurkihirsi', x: 186, y: 10, w: 26, h: 26, after: ['g2'], carve: true },
  ],
};

export const BUILDINGS: Building[] = [laavu, sauna, mokki, aitta, talorunko, pirtti];
export const getBuilding = (id: string): Building | undefined => BUILDINGS.find((b) => b.id === id);
