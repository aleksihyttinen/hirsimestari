export type PieceKind =
  | 'log' | 'door' | 'window' | 'roof' | 'chimney' | 'fire' | 'pier' | 'porch'
  // Hirsityöt (frame) pieces.
  | 'sill' | 'joist' | 'wall' | 'tie' | 'gable' | 'purlin' | 'ridge'
  // Sisätyöt (room) pieces.
  | 'breaker' | 'valve' | 'cable' | 'pipe' | 'switch' | 'light' | 'alarm' | 'socket' | 'heater' | 'sink' | 'tap'
  | 'wc' | 'shower' | 'basin' | 'vent' | 'control' | 'lamp' | 'kiuas' | 'bench';
export type Phase = 'build' | 'paint' | 'done';

/** A place in a building where one piece belongs. Coordinates are SVG units (viewBox 0 0 400 300). */
export interface Target {
  id: string;
  kind: PieceKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Target ids that must be placed first. */
  after: string[];
  /** Roof only: a single slope rising to the right (laavu) instead of a gable. */
  lean?: boolean;
  /** Hirsityöt: with hewing on, this log is hewn (veistetään) before it is placed. */
  carve?: boolean;
  /** Sisätyöt: turns its shut-off back on (same place as the one turned off). */
  on?: boolean;
}

export interface Building {
  id: string;
  name: string;
  targets: Target[];
  /** 'runko' = Hirsityöt mode: all slots shown, the player works out the order. 'sisa' = Sisätyöt: a room, pieces are fastened. */
  mode?: 'runko' | 'sisa';
  /** Frame stands on corner stones (nurkkakivet) instead of a continuous kivijalka. */
  stones?: boolean;
  /** Sisätyöt: a tiled wall instead of logs (wet rooms). */
  tiles?: boolean;
}

export interface Project {
  id: string;
  buildingId: string;
  placed: string[];
  /** Target id -> colour. A missing key means the piece's original colour. */
  colors: Record<string, string>;
  phase: Phase;
  /** Hirsityöt: the player chose to hew the special logs themselves. */
  carve?: boolean;
  /** Target ids already hewn, so undo and re-place does not ask again. */
  carved?: string[];
}

export interface Settings {
  sound: boolean;
  big: boolean;
  /** Read instructions aloud (Papunet-style äänituki). */
  speech: boolean;
}

export interface SaveData {
  projects: Project[];
  settings: Settings;
  /** Saved buildings this version cannot read (e.g. from a newer version); written back untouched. */
  keep: unknown[];
}
