# Hirsimestari – notes for Claude Code

Single-player, Finnish-language log-building game (PWA) for people with intellectual disabilities. The player picks a building, places pieces (tap-then-tap or drag), optionally paints it, and everything is saved. No levels, timers, penalties or failure screens. Goal: the feeling of finishing something, not learning.

## Commands
- `npm run dev` – dev server (no service worker here)
- `npm test` – vitest, pure game logic only (`src/game/game.test.ts`)
- `npm run typecheck` – `tsc --noEmit`, strict
- `npm run build` then `npm run preview` – the only way to check PWA/offline behaviour

Run `typecheck`, `test` and `build` before calling any change done.

## Stack (do not add to it without a clear reason)
React 18, strict TypeScript, Vite, SVG, plain CSS, `vite-plugin-pwa`, localStorage. No backend, accounts, analytics, state library, game engine or UI kit.

## Layout
- `src/game/` – rules and data, no React, no DOM. Keep it that way so it stays testable.
  - `types.ts` – `Building`, `Target`, `Project`, `SaveData`
  - `buildings.ts` – buildings as data (`BUILDINGS`), palette, labels
  - `rules.ts` – `available`, `canPlace`, `nearestTarget` (snapping), `place`, `undo`, `paint`
  - `storage.ts` – load/save; never throws, drops unknown or malformed data
  - `gesture.ts` – tap vs drag threshold
- `src/Scene.tsx` – SVG drawing only (viewBox `0 0 400 300`). No game rules here.
- `src/App.tsx` – all screens (home, pick, new, settings, bye, game) and interaction.

## How the game works
- A `Target` is a slot (`x,y,w,h` in SVG units) with `after: string[]` prerequisites. Only targets whose prerequisites are placed are available, so the build order is data: logs bottom-up, then door and windows, then pier or porch and roof, then chimney or fire.
- Only available slots are drawn. The active one is yellow with a ＋ mark. With a single available piece kind it is auto-selected.
- Placing the last piece switches `phase` to `'paint'`. "Valmis" sets `'done'`. A done project reopens in paint mode (derived in `App`, not saved).
- A `Project` is one saved building: `{id, buildingId, placed[], colors{}, phase}`. Several per building are allowed.
- Drag: pointer events on the tray buttons; a drop snaps to the nearest available slot of the same kind within 80 SVG units. Tap: select a piece, tap the slot. A click right after a drag is ignored (`wasDrag`).

## Add a building
1. Add a `Building` in `src/game/buildings.ts` (reuse the kinds `log | door | window | roof | chimney | fire | pier | porch`; `lean: true` makes a single-slope roof) and put it in `BUILDINGS`.
2. A new piece kind needs: `PieceKind` in `types.ts`, a label and default colour in `buildings.ts`, and drawing in `Scene.tsx` (`Shape`, `Slot`, `ICON`).
3. Add a test for the new build order. Saves of a changed building reopen in build mode (unknown pieces dropped, other pieces kept), and buildings unknown to this version are kept untouched. Only change `KEY` in `storage.ts` if the save format itself changes, since that hides every existing save.

## Rules that must not regress
- All UI text is Finnish, short, one instruction at a time, verbs like "Valitse", "Napauta", "Maalaa". Never rely on colour alone (use labels, ＋ marks, ✓).
- Large targets (min 64 px), generous spacing, no precise dragging required. Tap-to-place must always work.
- Mistakes are never failures: wrong drops give a neutral hint, and "Peru" is always available while building.
- Everything focusable has an accessible name; keep keyboard support (Enter/Space on slots and buttons).
- Respect `prefers-reduced-motion` (there are no animations yet; add a setting only together with real motion). Sound and speech ("Puhe", reads the hint aloud with `speechSynthesis`) are off by default.
- Destructive actions (delete) need a second confirming tap.
- Playable offline and without localStorage. Do not cache external resources.

## Known gaps
- Three buildings: Laavu (side view, lean roof, fire), Sauna (pier to a lake, chimney), Mökki (two windows, entrance porch, chimney). Older saves of a building that gained pieces reopen in build mode. Offline/PWA install has not been verified in a real browser yet.
- The "Poistu" button cannot reliably close a browser tab; it shows a goodbye screen.
- Reviewed against Papunet's kognitiivinen saavutettavuus guide and switch-control notes; not yet tested with real users or switch hardware.
- Not tested on real touch devices or screen readers.
