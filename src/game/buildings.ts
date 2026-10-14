import type { Building, PieceKind, Target } from './types';

export const KIND_LABEL: Record<PieceKind, string> = {
  log: 'Hirsi', door: 'Ovi', window: 'Ikkuna', roof: 'Katto', chimney: 'Savupiippu', fire: 'Nuotio', pier: 'Laituri', porch: 'Kuisti',
  sill: 'Kengityshirsi', joist: 'Niskahirsi', wall: 'Seinähirsi', tie: 'Sidehirsi', gable: 'Päätyhirsi', purlin: 'Vuoliainen', ridge: 'Kurkihirsi',
  breaker: 'Sähkökeskus', valve: 'Pääventtiili', cable: 'Kaapeli', pipe: 'Vesiputki', switch: 'Valokatkaisija', light: 'Kattovalo',
  alarm: 'Palovaroitin', socket: 'Pistorasia', heater: 'Lämminvesivaraaja', sink: 'Tiskiallas', tap: 'Hana',
  wc: 'WC-istuin', shower: 'Suihku', basin: 'Pesuallas', vent: 'Poistoventtiili', control: 'Ohjauskeskus', lamp: 'Saunavalaisin',
  kiuas: 'Sähkökiuas', bench: 'Lauteet',
};
export const DEFAULT_COLOR: Record<PieceKind, string> = {
  log: '#c98a4b', door: '#8a5a2b', window: '#bfe3f5', roof: '#9a4a32', chimney: '#7a7a72', fire: '#f08a24', pier: '#d9a86a', porch: '#efe6d4',
  sill: '#8f5e30', joist: '#b07a42', wall: '#c98a4b', tie: '#a8692f', gable: '#d49a5a', purlin: '#c07f45', ridge: '#7d4f24',
  breaker: '#d8d8d0', valve: '#c0392b', cable: '#f4f0e8', pipe: '#b87333', switch: '#f4f0e8', light: '#3f7f4a',
  alarm: '#f4f0e8', socket: '#f4f0e8', heater: '#e8e8e2', sink: '#e6d3b0', tap: '#9aa3ab',
  wc: '#f4f0e8', shower: '#9aa3ab', basin: '#f4f0e8', vent: '#f4f0e8', control: '#3a3a38', lamp: '#d9a86a',
  kiuas: '#4a4a48', bench: '#e2c08a',
};
/** Hewing tools, shown below the log not in step order. A step's `wrong` completes "<tool> ei sovi …". */
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

/** Sisätyöt fastening. Each step offers the right item and one or two others (`choices` in rules.ts). */
export type Material = 'naula' | 'puuruuvi' | 'pitkaruuvi' | 'pultti' | 'kiinnike' | 'kannake' | 'liitin' | 'teippi' | 'liima';
/** `to` is the name in allative: completes "Valitse sopiva työkalu …". `why` follows a wrong pick when this is the right one. */
export const MATERIALS: { id: Material; name: string; to: string; why?: string }[] = [
  { id: 'teippi', name: 'Teippi', to: 'teipille' },
  { id: 'puuruuvi', name: 'Ruuvi', to: 'ruuville', why: 'Pieni ja kevyt osa kiinnitetään ruuvilla.' },
  { id: 'kannake', name: 'Putkenkannake', to: 'putkenkannakkeelle', why: 'Putki pysyy seinässä putkenkannakkeella.' },
  { id: 'naula', name: 'Naula', to: 'naulalle', why: 'Puu kiinnitetään puuhun naulalla.' },
  { id: 'pultti', name: 'Pultti ja mutteri', to: 'pultille ja mutterille', why: 'Painava osa seinällä tarvitsee pultin.' },
  { id: 'kiinnike', name: 'Kaapelikiinnike', to: 'kaapelikiinnikkeelle', why: 'Kaapeli pysyy seinässä kaapelikiinnikkeellä.' },
  { id: 'liima', name: 'Liima', to: 'liimalle', why: 'WC-istuin liimataan, ettei lattiaan tule reikiä.' },
  { id: 'pitkaruuvi', name: 'Pitkä ruuvi', to: 'pitkälle ruuville', why: 'Iso osa lattialla tarvitsee pitkän ruuvin.' },
  { id: 'liitin', name: 'Puristusliitin', to: 'puristusliittimelle', why: 'Putkeen liitetään puristusliittimellä.' },
];
export type FixTool = 'vasara' | 'ruuvain' | 'jakoavain' | 'saha' | 'leikkuri' | 'pistooli';
export const FIX_TOOLS: { id: FixTool; name: string }[] = [
  { id: 'jakoavain', name: 'Jakoavain' },
  { id: 'saha', name: 'Saha' },
  { id: 'ruuvain', name: 'Akkuruuvinväännin' },
  { id: 'leikkuri', name: 'Sivuleikkurit' },
  { id: 'vasara', name: 'Vasara' },
  { id: 'pistooli', name: 'Saumapistooli' },
];
/**
 * A fastened piece needs this material, then this tool, then a tap on each spot. Spots are fractions (0-1) of the
 * piece's box, where the fastener really goes (the ceiling light by its cup, a WC by its foot). `wrong` completes
 * "<item> ei sovi …". Pieces not listed (the shut-offs) are not fastened.
 */
export const FIX: Partial<Record<PieceKind, { material: Material; tool: FixTool; spots: [number, number][]; wrong: string }>> = {
  cable: { material: 'kiinnike', tool: 'vasara', spots: [[0.2, 0.5], [0.5, 0.5], [0.8, 0.5]], wrong: 'kaapelin kiinnitykseen' },
  pipe: { material: 'kannake', tool: 'ruuvain', spots: [[0.25, 0.5], [0.75, 0.5]], wrong: 'putken kiinnitykseen' },
  switch: { material: 'puuruuvi', tool: 'ruuvain', spots: [[0.5, 0.4], [0.5, 0.92]], wrong: 'katkaisijan kiinnitykseen' },
  socket: { material: 'puuruuvi', tool: 'ruuvain', spots: [[0.5, 0.4], [0.5, 0.92]], wrong: 'pistorasian kiinnitykseen' },
  light: { material: 'puuruuvi', tool: 'ruuvain', spots: [[0.5, 0.06]], wrong: 'valaisimen kiinnitykseen' },
  alarm: { material: 'puuruuvi', tool: 'ruuvain', spots: [[0.22, 0.5], [0.78, 0.5]], wrong: 'palovaroittimen kiinnitykseen' },
  heater: { material: 'pultti', tool: 'jakoavain', spots: [[0.5, 0.1], [0.5, 0.9]], wrong: 'varaajan kiinnitykseen' },
  sink: { material: 'pitkaruuvi', tool: 'ruuvain', spots: [[0.15, 0.45], [0.85, 0.45]], wrong: 'kaapin kiinnitykseen' },
  tap: { material: 'liitin', tool: 'jakoavain', spots: [[0.75, 0.92]], wrong: 'hanan liitokseen' },
  wc: { material: 'liima', tool: 'pistooli', spots: [[0.15, 0.9], [0.85, 0.9]], wrong: 'WC-istuimen kiinnitykseen' },
  shower: { material: 'liitin', tool: 'jakoavain', spots: [[0.5, 0.82]], wrong: 'suihkun liitokseen' },
  basin: { material: 'pultti', tool: 'jakoavain', spots: [[0.1, 0.2], [0.9, 0.2]], wrong: 'pesualtaan kiinnitykseen' },
  vent: { material: 'puuruuvi', tool: 'ruuvain', spots: [[0.15, 0.5], [0.85, 0.5]], wrong: 'venttiilin kiinnitykseen' },
  control: { material: 'puuruuvi', tool: 'ruuvain', spots: [[0.5, 0.4], [0.5, 0.92]], wrong: 'ohjauskeskuksen kiinnitykseen' },
  lamp: { material: 'puuruuvi', tool: 'ruuvain', spots: [[0.12, 0.5], [0.88, 0.5]], wrong: 'valaisimen kiinnitykseen' },
  kiuas: { material: 'pitkaruuvi', tool: 'ruuvain', spots: [[0.2, 0.45], [0.8, 0.45]], wrong: 'kiukaan kiinnitykseen' },
  bench: { material: 'naula', tool: 'vasara', spots: [[0.15, 0.1], [0.5, 0.1], [0.85, 0.1]], wrong: 'lauteiden kiinnitykseen' },
};
/** Sisätyöt shut-offs: already on the wall, tapped (not placed from the tray) before any work. The hint says what to do. */
export const SHUTOFF: Partial<Record<PieceKind, string>> = {
  breaker: 'Katkaise ensin virta. Napauta sähkökeskusta.',
  valve: 'Sulje vesi. Napauta pääventtiiliä.',
};
/** Hints for the last steps, turning them back on. */
export const SHUTON: Partial<Record<PieceKind, string>> = {
  breaker: 'Kytke virta takaisin. Napauta sähkökeskusta.',
  valve: 'Avaa vesi. Napauta pääventtiiliä.',
};

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

// Sisätyöt rooms, seen from inside. Power off (and water closed) first, then the electrics and the plumbing.
const shutoffs = (water: boolean): Target[] => [
  { id: 'breaker', kind: 'breaker', name: 'Sähkökeskus', x: 44, y: 40, w: 46, h: 64, after: [] },
  ...(water ? [{ id: 'valve', kind: 'valve' as const, name: 'Pääventtiili', x: 48, y: 222, w: 40, h: 38, after: ['breaker'] }] : []),
  { id: 'cable', kind: 'cable', name: 'Kaapeli', x: 90, y: 58, w: 266, h: 14, after: [water ? 'valve' : 'breaker'] },
  ...(water ? [{ id: 'pipe', kind: 'pipe' as const, name: 'Vesiputki', x: 88, y: 246, w: 226, h: 14, after: ['valve'] }] : []),
];
// A room's targets: shut-offs, its own pieces, and last water back on, then power back on.
const room = (water: boolean, pieces: Target[]): Target[] => {
  const base = [...shutoffs(water), ...pieces];
  const all = base.filter((t) => !SHUTOFF[t.kind]).map((t) => t.id);
  const [breaker, valve] = base;
  return [
    ...base,
    ...(water ? [{ ...valve!, id: 'valve-on', after: all, on: true }] : []),
    { ...breaker!, id: 'breaker-on', after: water ? ['valve-on'] : all, on: true },
  ];
};
// Keittiö: the sähkökeskus and pääventtiili are on the wall already.
// Pipe is listed before the sink so the cabinet is drawn over it.
export const keittio: Building = {
  id: 'keittio',
  name: 'Keittiö',
  mode: 'sisa',
  targets: room(true, [
    { id: 'switch', kind: 'switch', name: 'Valokatkaisija', x: 102, y: 72, w: 40, h: 88, after: ['cable'] },
    { id: 'light', kind: 'light', name: 'Kattovalo', x: 175, y: 72, w: 50, h: 56, after: ['switch'] },
    { id: 'alarm', kind: 'alarm', name: 'Palovaroitin', x: 240, y: 20, w: 48, h: 26, after: ['cable'] },
    { id: 'socket', kind: 'socket', name: 'Pistorasia', x: 262, y: 72, w: 40, h: 108, after: ['cable'] },
    { id: 'heater', kind: 'heater', name: 'Lämminvesivaraaja', x: 308, y: 118, w: 48, h: 130, after: ['pipe'] },
    { id: 'sink', kind: 'sink', name: 'Tiskiallas', x: 126, y: 190, w: 124, h: 80, after: ['heater'] },
    { id: 'tap', kind: 'tap', name: 'Hana', x: 168, y: 160, w: 40, h: 30, after: ['sink'] },
  ]),
};

// Kylpyhuone: tiled, no socket. The washbasin hangs on bolts; the tap goes on it.
export const kylpyhuone: Building = {
  id: 'kylpyhuone',
  name: 'Kylpyhuone',
  mode: 'sisa',
  tiles: true,
  targets: room(true, [
    { id: 'switch', kind: 'switch', name: 'Valokatkaisija', x: 102, y: 72, w: 40, h: 88, after: ['cable'] },
    { id: 'light', kind: 'light', name: 'Kattovalo', x: 165, y: 72, w: 50, h: 56, after: ['switch'] },
    { id: 'vent', kind: 'vent', name: 'Poistoventtiili', x: 250, y: 18, w: 52, h: 28, after: ['cable'] },
    { id: 'basin', kind: 'basin', name: 'Pesuallas', x: 150, y: 150, w: 80, h: 40, after: ['pipe'] },
    { id: 'tap', kind: 'tap', name: 'Hana', x: 172, y: 122, w: 40, h: 30, after: ['basin'] },
    { id: 'wc', kind: 'wc', name: 'WC-istuin', x: 244, y: 186, w: 60, h: 84, after: ['pipe'] },
    { id: 'shower', kind: 'shower', name: 'Suihku', x: 316, y: 80, w: 40, h: 166, after: ['pipe'] },
  ]),
};

// Löylyhuone: a sähkökiuas, so no water work. The ohjauskeskus turns on both the kiuas and the light.
export const loylyhuone: Building = {
  id: 'loylyhuone',
  name: 'Löylyhuone',
  mode: 'sisa',
  targets: room(false, [
    { id: 'bench', kind: 'bench', name: 'Lauteet', x: 56, y: 164, w: 196, h: 106, after: ['breaker'] },
    { id: 'lamp', kind: 'lamp', name: 'Saunavalaisin', x: 100, y: 96, w: 56, h: 32, after: ['cable'] },
    { id: 'control', kind: 'control', name: 'Ohjauskeskus', x: 196, y: 72, w: 44, h: 80, after: ['cable'] },
    { id: 'kiuas', kind: 'kiuas', name: 'Sähkökiuas', x: 272, y: 130, w: 72, h: 140, after: ['control'] },
  ]),
};

export const BUILDINGS: Building[] = [laavu, sauna, mokki, aitta, talorunko, pirtti, keittio, kylpyhuone, loylyhuone];
export const getBuilding = (id: string): Building | undefined => BUILDINGS.find((b) => b.id === id);
