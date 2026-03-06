# Queens Puzzle Game

A web-based Queens puzzle game built with React + TypeScript + Vite, deployed as a static site on Cloudflare Pages.

## Game Rules

Place N queens on an NxN grid divided into N colored regions such that:
- Exactly one queen per row
- Exactly one queen per column
- Exactly one queen per region
- No two queens adjacent (including diagonally)

## Commands

- `npm run dev` — Start development server
- `npm run build` — Type-check and build for production
- `npm run preview` — Preview production build locally
- `npm test` — Run tests (vitest)
- `npm run test:watch` — Run tests in watch mode
- `npm run lint` — Run ESLint

## Architecture

```
src/
  lib/       — Pure game logic (zero React dependencies)
  hooks/     — React hooks bridging lib to UI
  components/ — React components (UI only)
```

**Dependency direction:** `components/ → hooks/ → lib/` — never the reverse. No React imports in `lib/`.

## Coding Guidelines

- **TypeScript strict mode** — no `any`, no type assertions unless absolutely necessary
- **Readonly types** — use `readonly` on all state interfaces to prevent accidental mutation
- **Discriminated unions** — use for actions (`GameAction`) and other sum types
- **Pure functions** in `lib/` — easily testable, no side effects
- **React.memo** on Cell component — board re-renders on every state change
- **Board-level event delegation** — pointer events on Board, not individual Cells
- **CSS custom properties** for theming — no CSS framework
- **No additional dependencies** without explicit approval

## Testing Guidelines

- **Prefer pure-function tests** — `lib/` functions are easily tested without any setup; reach for those first
- **Component tests via React Testing Library** — use for behaviour that only manifests at the React layer (effects, state interactions across hooks)
- **Avoid over-mocking** — only mock what genuinely cannot run in the test environment (e.g. `virtual:pwa-register/react` is a Vite virtual module that doesn't exist in Node). Do not mock real modules (`localStorage`, timers via `vi.useFakeTimers()` are fine; mocking hooks or lib functions is a smell that the logic should be pushed down into pure functions instead)
- **`vi.useFakeTimers()`** in component tests — always pair with `vi.useRealTimers()` in `afterEach`
