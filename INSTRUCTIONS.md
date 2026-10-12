# Project: Hirsimestari

You are the senior frontend developer responsible for building a small, accessible, browser-based building puzzle game that can be installed as a Progressive Web App (PWA).

## 1. Project description

The application is a single-player building game in which players construct different buildings and structures from individual pieces, primarily round logs (pyöröhirret).

Possible building projects include:
- Houses
- Saunas
- Lean-to shelters (laavut)
- Small cabins and other simple wooden structures

The player constructs buildings by placing logs and other building components in the correct positions. Once a building is complete, the player can optionally paint its components in colours of their choice.

The intended audience is people with intellectual disabilities. The game must be easy to understand, calm, forgiving, and usable without requiring reading skills or precise motor control. Main goal is the feeling of "victory" by completing something instead of learning.

The primary interface language is Finnish.

Accessibility and ease of use are more important than visual complexity or advanced game mechanics.

Do not make the game level based, instead the user chooses a structure they want to build and save the state of the structure (every piece of progress gets saved, and the completed building is saved so you can edit or view it later)

## 2. Technology stack

Use the following stack:

- **React** for the user interface.
- **TypeScript** with strict type checking.
- **Vite** for development and production builds.
- **SVG** for the building canvas, logs, building components, outlines, and interactive objects.
- **CSS** for layout, styling, animations, and responsive behaviour.
- **vite-plugin-pwa** for PWA configuration, installation, and offline support.
- **localStorage** for saving local game progress and preferences.

Keep dependencies to a minimum. Do not introduce a backend, database, account system, or external service unless a future requirement makes one necessary.

Do not introduce a game engine, physics engine, Redux, or other large libraries without a clear technical reason.

The application must work on mobile phones, tablets, and desktop browsers, with tablet sized touchscreens as the primary interaction target.

## 3. Accessibility principles

Use Papunet as an important reference for accessible communication and cognitive accessibility:

https://papunet.net/

Review relevant Papunet guidance before implementing the interface. Do not assume that simply using large buttons makes an application accessible.

Follow these principles:

### Simple language
- Use clear, familiar Finnish.
- Keep instructions short and concrete.
- Give one instruction at a time.
- Prefer verbs such as "Valitse", "Siirrä", "Rakenna" and "Maalaa".
- Avoid technical language, abstract instructions, unnecessary text, and complicated menus.
- Pair short text with clear visual examples wherever useful.

### Simple interaction
- Make buttons and interactive objects large and easy to select.
- Provide generous spacing between interactive elements.
- Avoid requiring precise dragging.
- Support tapping a piece and then tapping its destination as an alternative to dragging.
- Make it easy to undo an action or return to a safe previous state.
- Avoid time limits, penalties, failure screens, and unnecessary pressure.
- Do not require fast reactions or memorisation of complicated instructions.

### Predictable interface
- Keep the main controls in consistent locations.
- Use a small number of visible choices at any one time.
- Clearly distinguish available pieces, placed pieces, and completed components.
- Give immediate and understandable feedback after each action.
- Avoid unnecessary animation, flashing, sudden movement, and distracting effects.
- Respect reduced-motion preferences.

### Visual accessibility
- Use strong contrast and clear shapes.
- Do not communicate important information through colour alone.
- Use easily distinguishable icons with text labels when appropriate.
- Make the game usable on different screen sizes and orientations.
- Ensure text remains readable when enlarged.
- Provide accessible focus states and appropriate keyboard support.

### Inclusive feedback
- Use positive, neutral feedback.
- Celebrate progress without implying that mistakes are failures.
- Allow players to experiment and change their decisions.
- Provide optional sound effects, with sound disabled by default unless there is a strong reason otherwise.

## 4. Core game concept

The game should be based on simple, structured building puzzles.

A typical level works as follows:

1. The player chooses a building, such as a sauna or a small cabin.
2. The game shows a clear outline of the intended structure.
3. The player chooses a log or other building component.
4. The player places it in the correct position.
5. The game gives immediate visual feedback and snaps the piece into place.
6. The player repeats the process until the building is complete.
7. The game offers an optional painting phase.
8. The player can choose colours and paint individual building components.
9. The player can finish the building and return to the building selection screen.

Keep the initial implementation small. Start with one simple building and a limited number of pieces.

### Placement interaction

The game must support two placement methods:

- Tap a piece, then tap its destination.
- Drag a piece to its destination.

The tap-to-place method is essential because dragging can be difficult for some users.

Use forgiving placement rules. If a piece is placed near its correct destination, it should snap into place.

Provide clear visual indications of where a piece belongs. Do not rely on the player having to guess an invisible target.

Allow pieces to be returned or repositioned where appropriate.

Avoid realistic construction physics. This is a structured puzzle game, not a simulation.

### Painting

After construction, allow the player to select a building component and choose a paint colour.

- Use large, clearly distinguishable colour choices.
- Include a simple visual indication of the selected colour.
- Allow the player to repaint a component.
- Do not require accurate drawing or fine motor movements.
- Keep the painting interaction simple and predictable.

## 5. Architecture and code quality

Keep the application modular and maintainable.

Separate game rules from rendering and interface components.

Use TypeScript types for buildings, pieces, placement targets, colours, and game state.

Represent building levels as data rather than hardcoding each building into the interface. This should make it straightforward to add new buildings later.

Use SVG coordinates and a responsive `viewBox` for the building area so the game scales well across devices.

Keep SVG rendering independent of game rules. Placement validation and game state should be implemented in separate, testable functions.

Avoid unnecessary state management libraries. React state and a small custom hook should be sufficient for the initial version.

## 6. PWA and offline support

Configure the application as an installable PWA.

Requirements:
- A valid web app manifest.
- Application name: Hirsimestari.
- A short Finnish application description.
- Appropriate application icons.
- A service worker that caches the application shell and required local assets.
- Offline operation after the application has been loaded and cached.
- A sensible installation experience on supported devices.
- No mandatory login or network connection.
- No external runtime dependency for essential game assets.

Use `vite-plugin-pwa` and verify the production build rather than assuming the PWA works because the plugin is installed.

Do not cache arbitrary external resources unnecessarily.

## 7. Saving progress

Use localStorage for simple persistence.

Initially, save:
- Completed levels.
- The player's current level where appropriate.
- Relevant preferences, such as sound settings.
- Other small gameplay preferences if needed.

Handle missing, malformed, or outdated stored data gracefully.

The game must remain playable if localStorage is unavailable or cleared.

Do not collect personal information or introduce analytics, tracking, advertising, or accounts.

## 8. Testing and validation

Add appropriate tests for the core game logic.

At a minimum, test:
- Valid and invalid piece placements.
- Snapping a piece into position.
- Completing a building.
- Painting and repainting components.
- Saving and restoring progress.
- Switching between tap-to-place and drag-to-place interactions.

Verify that:
- The production build succeeds.
- TypeScript strict checks pass.
- The game works with touch input.
- The game remains usable with a keyboard.
- The layout works on narrow mobile screens and larger tablets.
- Core gameplay works offline after initial caching.
- Interactive controls have appropriate accessible names and focus behaviour.

Use the actual available project tooling and run the checks before declaring the implementation complete.

## 9. Visual direction

Aim for a calm, friendly, Scandinavian-inspired visual style.

Use:
- Warm natural wood colours.
- Simple, recognisable illustrations.
- Clean backgrounds.
- Clear visual hierarchy.
- Large controls and generous spacing.
- Friendly but restrained animations.
- A consistent visual style across buildings and pieces.

The game should feel suitable for both children and adults with intellectual disabilities. Avoid overly childish visual treatment.

Prioritise clarity over decoration.

Initially, create the building pieces from SVG shapes and simple gradients if necessary. Keep the artwork easy to replace with custom illustrations later.

Do not spend time building a complex design system before the first level works.

## 10. Development workflow

Work incrementally.

First:

1. Inspect the repository and identify the existing setup.
2. If the repository is empty, initialise the project using the specified stack.
3. Review relevant Papunet accessibility guidance.
4. Establish the application structure and PWA configuration.
5. Build one complete, playable prototype level.

The initial prototype should contain:
- A simple Finnish-language start screen.
- One building selection.
- A building outline or reference image.
- A small set of log pieces.
- Tap-to-place interaction.
- Drag-to-place interaction.
- Placement snapping and visual feedback.
- A completion state.
- A simple painting phase.
- Local progress persistence.
- Responsive layout and basic offline support.

Use a simple cabin or sauna as the first building. Do not implement a large collection of levels yet.

After the prototype works, run the available checks, fix errors, and document how to run and build the application.

## 11. Working rules

- Start by inspecting the repository. Do not overwrite existing work without understanding it.
- Explain important architectural decisions briefly.
- Prefer simple, readable solutions over clever abstractions.
- Do not add dependencies without a clear reason.
- Do not introduce features that are not needed for the first playable version.
- Do not use placeholder controls that appear functional but do nothing.
- Do not claim that tests or builds pass unless you have actually run them.
- If a requirement is ambiguous, choose the simplest reasonable implementation and document the decision.
- If an accessibility trade-off arises, prioritise the option that makes the game easier to understand and operate.

## 12. Definition of done

The initial milestone is complete when a player can open the application, choose a simple building, construct it piece by piece using either tapping or dragging, paint its components, complete the level, and retain their progress after reopening the application.

The game should be easy to understand without extensive written instructions.

**Begin by inspecting the repository and outlining a short implementation plan. Then implement the first playable milestone rather than producing only a plan or a static mockup.**
