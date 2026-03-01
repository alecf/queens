# Queens Puzzle Game - Implementation Plan

**Date:** 2026-02-28
**Type:** New Feature (Greenfield)
**Stack:** React 19 + TypeScript + Vite 6 + Cloudflare Pages

---

## Enhancement Summary

**Deepened on:** 2026-02-28
**Sections enhanced:** 7 phases + types + edge cases
**Research agents used:** TypeScript reviewer, React composition, performance oracle, security sentinel, frontend race conditions, architecture strategist, code simplicity, pattern recognition, puzzle generation, color accessibility, touch gestures, web design guidelines, Vercel React best practices

### Key Improvements
1. **Stronger types** — `BoardSize` literal union, `Position` type, `readonly` modifiers, discriminated union `GameAction`
2. **Better puzzle generation** — Multi-source BFS for region growing, compactness scoring, MRV + forward checking in solver, 100ms time budget with fallback
3. **Colorblind-safe palette** — Full Okabe-Ito based 9-color palette with diagonal stripe overlay for conflicts
4. **Robust touch handling** — `pointerId` tracking, `pointercancel` handling, 8px drag threshold, ref-based drag accumulation
5. **Security hardening** — CSP headers, URL decoder input validation, iteration limits in solver/generator, localStorage try-catch
6. **Race condition mitigations** — Ref-based hint cooldown guard, immediate board lock on win, timeout cleanup on new game
7. **Encoding version prefix** — `v1` prefix in URL for forward-compatible encoding changes

### New Considerations Discovered
- Region compactness scoring to reject trivially-shaped regions (aspect ratio > 3:1)
- Board-level event delegation instead of per-cell pointer handlers
- `setInterval(1000)` for timer (not `requestAnimationFrame`) — 1s precision is plenty
- Error boundary around game area for graceful recovery
- `dvh` viewport units for mobile layout stability
- Explicit game phase modeling (`idle | playing | won`) instead of boolean flags

---

## Overview

Build a web-based version of the Queens puzzle game as a fully static site. Players place N queens on an NxN grid divided into N colored regions, satisfying constraints: one queen per row, column, and region, with no two queens adjacent (including diagonally). Boards are randomly generated with guaranteed unique solutions and encoded in the URL for sharing.

## Problem Statement

The user's favorite Queens puzzle site only generates one puzzle per day. This project provides unlimited randomly-generated puzzles with multiple board sizes (5-9), shareable URLs, hint support, and best-time tracking.

## User Preferences

- **Board sizes:** 5 through 9 (player chooses)
- **Visual style:** Playful/colorful with system light/dark theme support
- **Stats:** Timer + best times per board size (localStorage)
- **Hints:** Reveal one cell at a time, 5-second cooldown between hints
- **Deployment:** Static site on Cloudflare Pages

---

## Technical Approach

### Architecture

```
queens/
├── CLAUDE.md                    # Project guidelines for AI assistants
├── README.md                    # Project documentation
├── index.html                   # Vite entry point (project root)
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── public/
│   ├── _redirects               # Cloudflare SPA routing
│   └── _headers                 # Cache headers
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Router + theme provider
│   ├── App.css                  # Global styles + theme variables
│   ├── components/
│   │   ├── Board.tsx            # Grid container, pointer event handling
│   │   ├── Cell.tsx             # Individual cell (memo'd)
│   │   ├── Controls.tsx         # New game, size selector, hint, share, undo
│   │   ├── Timer.tsx            # Elapsed time display
│   │   ├── WinOverlay.tsx       # Victory celebration
│   │   └── Header.tsx           # Title, dark mode toggle (optional)
│   ├── hooks/
│   │   ├── useGameState.ts      # Core game reducer (cell states, validation, undo)
│   │   ├── usePointerGesture.ts # Tap-cycle + drag-to-paint
│   │   ├── useTimer.ts          # Timer with pause/resume
│   │   └── useBestTimes.ts      # localStorage best times
│   ├── lib/
│   │   ├── types.ts             # Shared types (CellState, Region, Board, etc.)
│   │   ├── generator.ts         # Puzzle generation (solution-first + region carving)
│   │   ├── solver.ts            # Backtracking solver for validation
│   │   ├── validator.ts         # Check constraints (row/col/region/adjacency)
│   │   ├── encoder.ts           # Board ↔ URL encoding (base64url)
│   │   └── regionColors.ts      # Color palettes for regions (light + dark)
│   └── vite-env.d.ts
└── tests/
    ├── generator.test.ts
    ├── solver.test.ts
    ├── validator.test.ts
    └── encoder.test.ts
```

### Key Design Decisions

1. **No router needed** - Single-page app with board encoded in URL path (`/game/v17aQ...`). Cloudflare `_redirects` rewrites all `/game/*` to `index.html`. App reads `window.location.pathname` on load.
2. **useReducer for game state** - Complex state with undo history, validation, and multiple interacting fields.
3. **Pointer Events API** - Unified mouse/touch handling. No separate touch event handlers.
4. **Solution-first generation** - Generate a valid queen placement, then carve regions around it, guaranteeing solvability.
5. **Pure game logic in `lib/`** - Zero React dependencies in generator/solver/validator/encoder. Easily testable with Vitest.
6. **CSS Grid for board layout** - Dynamic NxN grid with `grid-template-columns: repeat(N, 1fr)`.
7. **CSS custom properties for theming** - Light/dark themes via `prefers-color-scheme` media query + CSS variables.

---

## Implementation Phases

### Phase 1: Project Scaffolding & Core Types

**Goal:** Vite + React + TypeScript project with CLAUDE.md, README, and type definitions.

**Tasks:**
- [ ] Scaffold Vite project with `react-ts` template
- [ ] Create `CLAUDE.md` with project explanation and coding guidelines
- [ ] Create `README.md` with game description, setup instructions, and architecture overview
- [ ] Define core types in `src/lib/types.ts`:

```typescript
// src/lib/types.ts
export type BoardSize = 5 | 6 | 7 | 8 | 9;
export type CellMark = 'empty' | 'x' | 'queen';

export interface Position {
  readonly row: number;
  readonly col: number;
}

export interface Board {
  readonly size: BoardSize;
  readonly regions: readonly (readonly number[])[]; // NxN grid of region IDs (0 to N-1)
}

export type GamePhase = 'idle' | 'playing' | 'won';

export interface GameState {
  readonly board: Board;
  readonly marks: readonly (readonly CellMark[])[]; // NxN grid of player marks
  readonly solution: readonly Position[];            // queen positions for hint system
  readonly conflicts: ConflictSet;
  readonly phase: GamePhase;                         // explicit phase instead of boolean
  readonly history: readonly (readonly (readonly CellMark[])[])[]; // undo stack
  readonly hintsUsed: number;
  readonly lastHintTime: number;                     // for 5s cooldown
}

export interface ConflictSet {
  readonly rows: ReadonlySet<number>;
  readonly cols: ReadonlySet<number>;
  readonly regions: ReadonlySet<number>;
  readonly adjacentPairs: readonly [Position, Position][]; // pairs of adjacent queens
}

// Discriminated union for all game actions
export type GameAction =
  | { readonly type: 'SET_MARK'; readonly pos: Position; readonly mark: CellMark }
  | { readonly type: 'SET_MARKS'; readonly changes: readonly { pos: Position; mark: CellMark }[] } // batch for drag
  | { readonly type: 'UNDO' }
  | { readonly type: 'NEW_GAME'; readonly size: BoardSize }
  | { readonly type: 'HINT' }
  | { readonly type: 'RESET' };
```

#### Research Insights — Types

**Best Practices Applied:**
- `readonly` modifiers throughout prevent accidental mutation in reducer (TypeScript reviewer)
- `BoardSize` literal union (`5 | 6 | 7 | 8 | 9`) prevents invalid sizes at type level
- `Position` type replaces `[number, number]` tuples for clarity and named access
- Discriminated union `GameAction` enables exhaustive switch checking in reducer
- `SET_MARKS` batch action for drag operations (single undo entry)

**Architecture Notes:**
- `GamePhase` enum replaces `isComplete: boolean` — models idle/playing/won explicitly, preventing impossible states
- `readonly` arrays use `readonly (readonly T[])[]` for deep immutability signals
- `ConflictSet.adjacentPairs` uses `[Position, Position]` for readability over `[n,n,n,n]` tuple

- [ ] Configure `tsconfig.json` with strict mode, `moduleResolution: "bundler"`, `jsx: "react-jsx"`
- [ ] Add `public/_redirects` for Cloudflare SPA routing (`/game/*  /index.html  200` and `/*  /index.html  200`)
- [ ] Add `public/_headers` for asset caching

**Files:** `CLAUDE.md`, `README.md`, `src/lib/types.ts`, `tsconfig.json`, `vite.config.ts`, `public/_redirects`, `public/_headers`

#### Research Insights — Scaffolding

**CLAUDE.md should include:**
- Project overview and game rules
- `npm run dev` / `npm run build` / `npm test` commands
- Architecture: `lib/` is pure logic (no React), `hooks/` bridges to React, `components/` is UI
- Dependency direction: `components → hooks → lib`, never reverse
- Style: strict TypeScript, `readonly` on state types, discriminated unions for actions
- No CSS framework — use CSS custom properties + Grid
- No additional dependencies without explicit approval

---

### Phase 2: Puzzle Generation & Solver

**Goal:** Generate solvable Queens puzzles with unique solutions.

**Algorithm - Region Generation:**
1. Place N queens on the board satisfying row/column/adjacency constraints (standard N-queens with adjacency).
2. Assign each queen a unique region ID (0 to N-1).
3. Grow regions outward from queen positions using randomized flood fill until all cells are assigned.
4. Validate the puzzle has a unique solution via backtracking solver.
5. If not unique, regenerate.

**Tasks:**
- [ ] Implement `src/lib/solver.ts` - Backtracking solver that finds all solutions (or confirms uniqueness by finding exactly 1)
  - `solve(board: Board): [number, number][][] ` - returns all solutions (capped at 2 for early exit)
  - Uses constraint propagation: track available positions per row/col/region
- [ ] Implement `src/lib/generator.ts` - Puzzle generation
  - `generateBoard(size: number): { board: Board; solution: [number, number][] }`
  - Step 1: Place queens using backtracking with adjacency constraint
  - Step 2: Assign regions via randomized BFS from queen positions
  - Step 3: Verify unique solution; retry if not
- [ ] Implement `src/lib/validator.ts` - Real-time constraint checking
  - `validateMarks(board: Board, marks: CellMark[][]): ConflictSet`
  - Check: row conflicts, column conflicts, region conflicts, adjacency conflicts
  - Returns which rows/cols/regions/pairs are in conflict (for red highlighting)
  - `isComplete(board: Board, marks: CellMark[][]): boolean` - all queens placed, no conflicts
- [ ] Write tests for all three modules

**Files:** `src/lib/generator.ts`, `src/lib/solver.ts`, `src/lib/validator.ts`, `tests/generator.test.ts`, `tests/solver.test.ts`, `tests/validator.test.ts`

#### Research Insights — Puzzle Generation & Solver

**Algorithm Improvements:**
- **Multi-source BFS for region growing:** Instead of growing regions one-at-a-time, use a single multi-source BFS from all queen positions simultaneously. Each BFS step expands one random frontier cell for a random queen. Produces more organic, balanced regions.
- **Region compactness scoring:** After growing regions, compute bounding-box aspect ratio for each region. Reject boards where any region has aspect ratio > 3:1 (long, snaking regions make puzzles trivially easy or visually ugly).
- **MRV (Minimum Remaining Values) ordering in solver:** When choosing which row to assign next, pick the row with fewest valid column placements. Dramatically prunes the search tree for sizes 7-9.
- **Forward checking:** After placing a queen, immediately eliminate conflicted positions in remaining rows. If any row becomes empty, backtrack early without further exploration.

**Performance Considerations:**
- Generation for size 9 could take 50-500ms without optimization. Add a **100ms time budget** — if generation exceeds it, restart with a new random seed rather than continuing a bad path.
- **Cap retries at 50** per generation attempt. If 50 attempts fail to produce a unique-solution board, fall back to a known-good board for that size.
- Solver's uniqueness check only needs to find 2 solutions (early exit). Don't enumerate all solutions.
- Add **iteration limits** to solver loops (e.g., 100,000 nodes) as a safety net against infinite loops on malformed input.

**Testing Notes:**
- Test that generated boards for each size 5-9 have exactly 1 solution (run 20+ generations per size)
- Test that solver correctly identifies boards with 0, 1, and 2+ solutions
- Test region compactness: no region should wrap around another or have extreme aspect ratios
- Fuzz test: generate 100 boards per size, verify all are valid

---

### Phase 3: URL Encoding

**Goal:** Compact, shareable URL encoding of board layout.

**Encoding scheme:**
- First character: board size as single digit ('5' through '9')
- Remaining: region IDs packed into base64url
- For size N, each cell's region ID is 0 to N-1, requiring `ceil(log2(N))` bits per cell
  - Size 5-8: 3 bits per cell
  - Size 9: 4 bits per cell
- Pack bits into bytes, then base64url encode

**Example URL:** `https://queens.example.com/game/v17AqM2x...` (version 1, board size 7, encoded regions)

**Tasks:**
- [ ] Implement `src/lib/encoder.ts`:
  - `encodeBoard(board: Board): string` - board → compact string
  - `decodeBoard(encoded: string): Board` - compact string → board
  - Use base64url (URL-safe, no padding)
- [ ] Write round-trip tests for all board sizes
- [ ] URL integration: read board from path `/game/<encoded>` on load, update URL on new game with `history.replaceState('/game/<encoded>')`
- [ ] Add `public/_redirects` rule: `/game/*  /index.html  200` for Cloudflare SPA routing

**Files:** `src/lib/encoder.ts`, `tests/encoder.test.ts`

**URL budget:**
| Size | Cells | Bits/cell | Total bits | Bytes | Base64url chars | URL length |
|------|-------|-----------|------------|-------|-----------------|------------|
| 5    | 25    | 3         | 75         | 10    | ~14             | ~20        |
| 7    | 49    | 3         | 147        | 19    | ~26             | ~32        |
| 9    | 81    | 4         | 324        | 41    | ~55             | ~61        |

#### Research Insights — URL Encoding

**Forward Compatibility:**
- Prefix encoded string with version byte (e.g., `v1`). This allows changing the encoding scheme later without breaking shared URLs. Decoders check the version prefix and dispatch to the appropriate decoder.
- Example URL: `/game/v17AqM2x...` (version 1, size 7, encoded regions)

**Input Validation (Security):**
- Decoder must validate thoroughly: check version prefix, verify size byte is 5-9, verify decoded region IDs are all in range `[0, N-1]`, verify each region has at least 1 cell, verify total cell count equals N×N.
- On any validation failure, silently generate a new random board (don't show error).
- Limit input string length (reject anything over 200 chars to prevent DoS via huge strings).

**Alternative Encoding (Considered, Deferred):**
- Simpler digit-char encoding: each cell is one digit `0-8`, yielding 81 chars for 9×9. Longer URLs but trivially debuggable. Could offer as a `v2` encoding if bit-packing proves hard to debug.

---

### Phase 4: Game State Management

**Goal:** React state management with undo, validation, and hint support.

**Tasks:**
- [ ] Implement `src/hooks/useGameState.ts` as a `useReducer`:
  - Actions: `SET_MARK`, `UNDO`, `NEW_GAME`, `HINT`, `RESET`
  - `SET_MARK(row, col, mark)` - set a cell, push to history, revalidate
  - `UNDO` - pop history stack
  - `NEW_GAME(size)` - generate new board, reset state
  - `HINT` - reveal one cell from solution (pick an unrevealed cell, set its correct mark)
  - `RESET` - clear all marks, keep same board
  - After each action, run `validateMarks` and check `isComplete`
- [ ] Implement `src/hooks/useTimer.ts`:
  - Starts on first cell interaction
  - Pauses on win
  - Resets on new game
  - Returns `{ elapsed: number, isRunning: boolean }`
- [ ] Implement `src/hooks/useBestTimes.ts`:
  - Read/write from localStorage keyed by board size
  - `{ bestTime: number | null, saveBestTime: (time: number) => void }`
- [ ] Hint cooldown: track `lastHintTime` in state, disable hint button for 5 seconds after use

**Files:** `src/hooks/useGameState.ts`, `src/hooks/useTimer.ts`, `src/hooks/useBestTimes.ts`

#### Research Insights — Game State

**Race Condition Mitigations:**
- **Hint cooldown guard:** Use a `useRef` alongside state for `lastHintTime`. The ref provides synchronous access to prevent double-hints when React batches state updates. Check the ref before dispatching `HINT`.
- **Win overlay timeout cleanup:** The 300ms delay before showing win overlay uses `setTimeout`. Store the timeout ID in a ref and clear it on `NEW_GAME` or `RESET` to prevent stale overlays appearing after starting a new game.
- **Board lock on win:** Set `phase: 'won'` synchronously in the reducer (not after the 300ms delay). The overlay delay is purely visual — the board should ignore interactions immediately on win.

**Timer Implementation:**
- Use `setInterval(1000)` for the display tick — 1-second precision is sufficient and uses far less CPU than RAF.
- **Pause when not visible:** Listen for `visibilitychange` event. When `document.hidden` becomes true, record the timestamp and clear the interval. When it becomes false again, restart the interval. This handles tab switching, screen off, and app switching on mobile.
- Store `startedAt` timestamp + accumulated `elapsed` rather than incrementing a counter (avoids drift from setInterval inaccuracy).
- The timer should **only count time when the user can see the board** — visibility-based pausing handles all cases (tab switch, screen lock, app switch).

**localStorage Safety:**
- Wrap all `localStorage` reads/writes in try-catch. Safari in private mode throws on `setItem`, and storage can be full.
- If localStorage is unavailable, game works normally — just no persistence. No error shown to user.

---

### Phase 5: Board UI & Touch Interaction

**Goal:** Responsive board with tap-cycle and drag-to-paint.

**Tap behavior:** empty → X → queen → empty (3-state cycle)

**Drag behavior:**
- Start drag on empty cell → all dragged cells become X
- Start drag on X cell → all dragged cells become empty
- Start drag on queen cell → treat as tap (no drag painting for queens)

**Tasks:**
- [ ] Implement `src/hooks/usePointerGesture.ts`:
  - Use Pointer Events API with `setPointerCapture` for reliable drag
  - Distinguish tap vs drag: if pointer moves to a different cell, it's a drag
  - On drag, use `document.elementFromPoint(e.clientX, e.clientY)` to find cell under pointer (more reliable than `pointerenter` with capture)
  - Track drag paint mode (set X or clear) based on starting cell state
- [ ] Implement `src/components/Cell.tsx` (React.memo):
  - Display: empty (blank), X (letter or icon), queen (crown emoji or SVG)
  - Region coloring via CSS custom property `--region-color`
  - Conflict highlighting: red border/background when cell's row/col/region/adjacency is in conflict
  - Transition animations for state changes
- [ ] Implement `src/components/Board.tsx`:
  - CSS Grid layout: `grid-template-columns: repeat(N, 1fr)`
  - Responsive sizing: `clamp(36px, calc(90vmin / N), 80px)` per cell
  - `touch-action: none` and `user-select: none` on container
  - Region border rendering: thicker borders between cells of different regions
  - Attach pointer event handlers at board level (event delegation)

**CSS considerations:**
- Cells need minimum 44px tap targets (WCAG 2.5.5)
- Region colors should have sufficient contrast in both light and dark themes
- Conflict cells get a red overlay/border that's visually distinct from region colors

**Files:** `src/hooks/usePointerGesture.ts`, `src/components/Board.tsx`, `src/components/Cell.tsx`

#### Research Insights — Touch & UI

**Pointer Gesture Implementation (from race conditions & touch research):**
- **8px Euclidean threshold** for tap vs drag. Track `startX/Y` on `pointerdown`, compute distance on each `pointermove`. Only enter drag mode when distance exceeds 8px.
- **`setPointerCapture` on the board element** (not `e.target`/cell). This ensures all pointer events route to the board even when dragging outside it.
- **`elementFromPoint(e.clientX, e.clientY)`** for cell detection during drag — `pointerenter` events are suppressed when capture is active, so you must query the DOM directly.
- **Track `activePointerId`** in a ref. Reject all pointer events from other IDs (prevents multi-touch chaos).
- **Handle `pointercancel`** — treat it as `pointerup` (commit any accumulated drag changes).
- **Accumulate drag marks in a ref**, dispatch a single `SET_MARKS` batch action on `pointerup`. This gives one undo entry for the whole drag and avoids re-renders during drag.
- **`touch-action: none`** only on the board container (not `document.body`). This preserves page scrolling outside the board on mobile.

**Cell Rendering:**
- Use `React.memo` on Cell with shallow comparison. Board re-renders on every state change, but cells only re-render when their mark, conflict status, or region changes.
- Board-level event delegation: attach `onPointerDown/Move/Up/Cancel` on `<Board>`, not on each `<Cell>`. Identify the cell from `data-row`/`data-col` attributes or from `elementFromPoint`.

**Accessibility (WCAG):**
- Minimum **44px** tap targets (WCAG 2.5.5), enforced via `clamp(44px, calc(90vmin / N), 80px)`
- Use `dvh` units instead of `vh` for mobile viewport height (avoids iOS address bar issues)
- `aspect-ratio: 1` on cells for perfect squares
- ARIA: `role="grid"` on board, `role="gridcell"` on cells, `aria-label` describing cell state and region

---

### Phase 6: Controls & Chrome

**Goal:** Game controls, timer, win overlay, theme support.

**Tasks:**
- [ ] Implement `src/components/Controls.tsx`:
  - **New Game** button with size selector (dropdown or segmented control, sizes 5-9)
  - **Undo** button (disabled when history empty)
  - **Hint** button with 5-second cooldown indicator (grayed out + countdown)
  - **Share** button - copies current URL to clipboard with toast confirmation
  - **Reset** button - clears marks, keeps same board
- [ ] Implement `src/components/Timer.tsx`:
  - Displays `MM:SS` format
  - Shows best time for current board size below the timer
- [ ] Implement `src/components/WinOverlay.tsx`:
  - Triggered when `isComplete` becomes true
  - Shows completion time, whether it's a new best
  - "New Game" and "Share" actions
  - Celebratory animation (confetti or similar, keep lightweight)
- [ ] Implement theme system in `src/App.css`:
  - CSS custom properties for all colors
  - `@media (prefers-color-scheme: dark)` for automatic switching
  - Region color palettes: bright distinct colors for light mode, muted jewel tones for dark mode
- [ ] Implement `src/lib/regionColors.ts`:
  - 9 distinct colors per theme (enough for max board size)
  - Colors must be distinguishable for colorblind users (avoid red/green pairs)
  - Each color needs: fill (40% opacity), border (80% opacity), conflict variant

**Files:** `src/components/Controls.tsx`, `src/components/Timer.tsx`, `src/components/WinOverlay.tsx`, `src/App.css`, `src/lib/regionColors.ts`

#### Research Insights — Visual Design & Colors

**Colorblind-Safe Region Palette (Okabe-Ito based):**

Light theme (9 colors):
```
Region 0: #E69F00  (orange)
Region 1: #56B4E9  (sky blue)
Region 2: #009E73  (bluish green)
Region 3: #F0E442  (yellow)
Region 4: #0072B2  (blue)
Region 5: #D55E00  (vermillion)
Region 6: #CC79A7  (reddish purple)
Region 7: #999999  (gray)
Region 8: #E8D5B7  (warm beige)
```

Dark theme (same hues, adjusted for dark backgrounds):
```
Region 0: #C88600  (dark orange)
Region 1: #3A8BBF  (muted sky)
Region 2: #007A5A  (deep teal)
Region 3: #BFB530  (olive yellow)
Region 4: #005A8C  (deep blue)
Region 5: #A84800  (dark vermillion)
Region 6: #A35D87  (muted purple)
Region 7: #6B6B6B  (dark gray)
Region 8: #8B7355  (dark beige)
```

**Conflict Visualization:**
- **Diagonal stripe overlay** pattern for conflict cells (not just color change). This ensures conflicts are visible to colorblind users.
- CSS: `background-image: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(220,38,38,0.3) 3px, rgba(220,38,38,0.3) 6px)` layered over region color.
- **Thick borders** (3-4px) between different regions as primary non-color region indicator.

**Win Overlay:**
- `role="dialog"` and `aria-modal="true"` for screen readers
- Trap focus inside overlay (or use `<dialog>` element with `showModal()`)
- Respect `prefers-reduced-motion`: disable confetti animation, use simple fade-in

---

### Phase 7: App Assembly & Polish

**Goal:** Wire everything together, final polish, deploy readiness.

**Tasks:**
- [ ] Implement `src/App.tsx`:
  - Read board from URL path (`/game/<encoded>`) on mount → decode board or generate new
  - Compose: Header, Board, Controls, Timer, WinOverlay
  - Pass state and dispatch down as props (no Context needed for this depth)
- [ ] Implement `src/main.tsx`: render App
- [ ] Responsive layout:
  - Mobile: board fills width, controls below
  - Desktop: board centered with controls alongside or below
  - Breakpoint: ~640px
- [ ] Keyboard accessibility:
  - Arrow keys to navigate cells
  - Space/Enter to cycle cell state
  - 'U' for undo, 'H' for hint
- [ ] Final testing:
  - Manual test all board sizes (5-9)
  - Test tap cycle on mobile (or mobile emulator)
  - Test drag-to-paint
  - Test URL sharing (copy URL, open in new tab → same board)
  - Test hint system + cooldown
  - Test timer + best times persistence
  - Test light/dark theme
  - Test win condition + overlay
  - Test conflict highlighting for each constraint type
- [ ] Build and verify: `npm run build` produces clean `dist/`

**Files:** `src/App.tsx`, `src/main.tsx`

#### Research Insights — Assembly & Architecture

**Error Boundary:**
- Wrap the game area in a React error boundary. If the generator or renderer throws, show a "Something went wrong — New Game" fallback instead of a blank screen.

**Security Headers (`public/_headers`):**
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Architecture Enforcement:**
- Dependency direction: `lib/` → nothing (pure), `hooks/` → `lib/`, `components/` → `hooks/` + `lib/`
- No React imports in `lib/` files. This makes game logic independently testable.
- Consider an ESLint `no-restricted-imports` rule to enforce this boundary.

**Layout:**
- Use `dvh` units for main container height on mobile (avoids iOS Safari address bar jumping)
- CSS Grid for overall layout: `grid-template-rows: auto 1fr auto` (header, board, controls)

---

## Edge Cases & UX Details

### Invalid URL
- If URL path is malformed, missing, or just `/`, generate a random board (default size from localStorage, or 7)
- Don't show error to user - silently generate a new board
- Remember last-used board size in localStorage

### Hint System
- Hints reveal cells from the solution: pick a random cell that is not yet correctly marked
- If cell should be a queen, set it to queen. If cell should be empty (not a queen), set it to X
- Hint-revealed cells are **mutable** - player can tap/drag to change them (hints are informational, not locks)
- Hint button shows countdown during cooldown (e.g., "Hint (3s)")
- Hints are **unlimited** (only gated by 5-second cooldown). Display "Hints: N" counter
- If puzzle is already complete, hint button is hidden
- Hint cooldown resets on page refresh
- Using hints does NOT affect best time eligibility (keep simple for v1)

### Timer Behavior
- Timer starts on **first cell interaction** (tap or drag), not on page load
- Timer displays as `M:SS` format (shows large minutes if needed, no hours)
- Timer **pauses when tab is hidden** (Page Visibility API)
- Timer pauses on win
- Timer does NOT pause during hint cooldown
- Timer resets on new game or reset
- Timer does not run before first interaction (shows `0:00`)
- Best times stored **per board size** (not per layout) in localStorage
- If localStorage unavailable, game works but times aren't persisted - no error shown

### Win Condition & Celebration
- Game is won when exactly N queens are placed AND no conflicts exist
- Win is checked after every mark change (including undo and hint)
- Win overlay appears with brief delay (~300ms) for dramatic effect
- **Win overlay shows:** completion time, new best indicator, "New Puzzle" button, "Share" button
- Lightweight CSS confetti animation (respect `prefers-reduced-motion`)
- After win, board cells are **locked** (no further interaction)

### Drag Behavior (Complete)
- Drag from **empty** cell → dragged cells become X (skip queens - they're preserved)
- Drag from **X** cell → dragged cells become empty (skip queens - they're preserved)
- Drag from **queen** cell → treat as tap only (queen → empty), no drag painting
- Queens are **always preserved** during drag operations
- Drag batches all changes into a **single undo entry**
- Drag off board edge: painting pauses, resumes if pointer re-enters (use `elementFromPoint`)
- Multi-touch: only primary pointer tracked, additional touches ignored

### Conflict Display
- Multiple queens in same row: highlight entire row with red tint
- Multiple queens in same column: highlight entire column with red tint
- Multiple queens in same region: highlight entire region with red tint
- Two queens adjacent: highlight both queen cells with red border
- Multiple conflicts can overlap (cell can be in conflicting row AND region)
- Conflicts update and clear immediately on every mark change

### New Game / Reset / Size Change
- **New Game** button: generates new board of current size, updates URL, resets timer
- **Reset** button: clears all marks, keeps same board, resets timer
- **Size change**: immediately generates new board, no confirmation dialog
- Last-used size saved in localStorage

### Share Flow
- "Share" copies current URL to clipboard
- Mobile: use `navigator.share()` if available, fall back to clipboard
- Desktop: `navigator.clipboard.writeText()`
- Show brief toast "Link copied!" for ~2 seconds
- Shared URL contains **board layout only** - recipient starts fresh

### Accessibility
- **Keyboard:** Arrow keys navigate cells, Space/Enter cycles cell state, Tab to controls
- **Color:** Regions distinguished by color AND thick borders between different regions
- **Motion:** Respect `prefers-reduced-motion` for win celebration
- **Touch targets:** Minimum 36px cell size via `clamp()` sizing

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

Intentionally minimal: no router, no state library, no CSS framework. The game is simple enough that `useReducer` + CSS custom properties cover all needs.

---

## Testing Strategy

- **Unit tests (Vitest):** `generator.ts`, `solver.ts`, `validator.ts`, `encoder.ts` - all pure functions, easy to test
- **Key test cases:**
  - Generator produces boards where solver finds exactly 1 solution
  - Encoder round-trips all board sizes correctly
  - Validator detects all 4 conflict types correctly
  - Validator returns no conflicts for valid complete solution
- **Manual testing:** Touch interactions, drag painting, responsiveness, theme switching

---

## References

- Pointer Events API: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- CSS Grid: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout
- Vite docs: https://vitejs.dev/guide/
- Cloudflare Pages: https://developers.cloudflare.com/pages/framework-guides/
- React 19: https://react.dev/blog/2024/12/05/react-19
- Base64url encoding: https://datatracker.ietf.org/doc/html/rfc4648#section-5
