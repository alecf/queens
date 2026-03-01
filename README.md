# Queens Puzzle

A web-based version of the Queens puzzle game. Place N queens on an NxN grid divided into N colored regions, satisfying row, column, region, and adjacency constraints.

## Features

- **Multiple board sizes** (5×5 through 9×9)
- **Tap to cycle** cell states: empty → X → queen → empty
- **Drag to paint** multiple cells at once
- **Real-time validation** — invalid moves highlighted in red
- **Shareable URLs** — board layout encoded in the URL path
- **Hints** with 5-second cooldown
- **Timer** with best times per board size
- **Light/dark theme** following system preference
- **Colorblind-safe** region palette with thick region borders

## Getting Started

```bash
npm install
npm run dev
```

## Development

```bash
npm test          # Run tests
npm run build     # Production build
npm run preview   # Preview build locally
```

## Deployment

Build output goes to `dist/`. Deploy to Cloudflare Pages or any static hosting.

```bash
npm run build
```

## Tech Stack

- React 19
- TypeScript (strict)
- Vite
- Vitest (testing)
- CSS custom properties (theming)

## License

MIT
