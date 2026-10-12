import type { Building, PieceKind, Target } from './types';

export const KIND_LABEL: Record<PieceKind, string> = {
  log: 'Hirsi', door: 'Ovi', window: 'Ikkuna', roof: 'Katto', chimney: 'Savupiippu', fire: 'Nuotio', pier: 'Laituri', porch: 'Kuisti',
};
export const DEFAULT_COLOR: Record<PieceKind, string> = {
  log: '#c98a4b', door: '#8a5a2b', window: '#bfe3f5', roof: '#9a4a32', chimney: '#7a7a72', fire: '#f08a24', pier: '#d9a86a', porch: '#efe6d4',
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

export const BUILDINGS: Building[] = [laavu, sauna, mokki];
export const getBuilding = (id: string): Building | undefined => BUILDINGS.find((b) => b.id === id);
