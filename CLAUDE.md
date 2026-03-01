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
