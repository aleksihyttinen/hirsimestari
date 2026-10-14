export type PieceKind =
  | 'log' | 'door' | 'window' | 'roof' | 'chimney' | 'fire' | 'pier' | 'porch'
  // Hirsityöt (frame) pieces.
  | 'sill' | 'joist' | 'wall' | 'tie' | 'gable' | 'purlin' | 'ridge'
  // Sisätyöt (room) pieces.
  | 'breaker' | 'valve' | 'cable' | 'pipe' | 'switch' | 'light' | 'alarm' | 'socket' | 'heater' | 'sink' | 'tap'
  | 'wc' | 'shower' | 'basin' | 'vent' | 'control' | 'lamp' | 'kiuas' | 'bench';
export type Phase = 'build' | 'paint' | 'done';

/** Sisusta: furniture the player places, and the fixtures already in the house. */
export type Item = 'bed' | 'nightstand' | 'sofa' | 'tv' | 'table' | 'chair' | 'coats' | 'shoes' | 'coffee' | 'armchair' | 'wardrobe' | 'dresser' | 'plant' | 'bench' | 'longtable' | 'platform' | 'bucket' | 'stove' | 'sink' | 'shower' | 'toilet' | 'basin' | 'heater' | 'kettle';
export type RoomKind = 'bedroom' | 'kitchen' | 'living' | 'hall' | 'dressing' | 'sauna';
/** A piece on the plan grid: `x,y` is its top-left cell, `turn` quarter turns clockwise (0-3). */
export interface Furniture {
  id: string;
  item: Item;
  x: number;
  y: number;
  turn: number;
}
/** A room in grid cells. `name` is what a screen reader hears; it never names the room's use. */
export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Has the outside door. */
  entry?: boolean;
  /** Open plan: it can become several rooms at once (a kitchen and a living room). Otherwise only the first recipe it meets. */
  open?: boolean;
}
/** A one-cell wall segment on the top or left edge of cell `x,y`. */
export interface Edge {
  x: number;
  y: number;
  side: 'top' | 'left';
}
/** What makes a room: every piece in `items` is in it, `beside` = [a piece, what must touch it, how many], and `entry` =
 * only the room with the outside door. `text` is its line in the Ohje and its tip. */
export interface Recipe {
  room: RoomKind;
  items?: Item[];
  beside?: [Item, Item, number];
  entry?: boolean;
  text: string;
}
export interface Plan {
  cols: number;
  rows: number;
  rooms: Room[];
  doors: Edge[];
  windows: Edge[];
  /** Fixtures already in the house (stove, sink, toilet…): never moved. */
  fixed: Furniture[];
  /** How many of each piece the tray offers: the amounts a well-furnished house needs. */
  pieces: Partial<Record<Item, number>>;
  /** The rooms a furnished house has; the bathroom is ready from the start and is not listed. */
  goal: RoomKind[];
  /** This building's rooms, checked in this order. */
  recipes: Recipe[];
}

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
  /** 'runko' = Hirsityöt mode: all slots shown, the player works out the order. 'sisa' = Sisätyöt: a room, pieces are fastened.
   * 'pohja' = Sisusta: a floor plan furnished freely on a grid (`plan`; `targets` is empty). */
  mode?: 'runko' | 'sisa' | 'pohja';
  plan?: Plan;
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
  /** Sisusta: the placed furniture. */
  furniture?: Furniture[];
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
