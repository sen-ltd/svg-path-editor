# svg-path-editor

Visual editor for the SVG `d` attribute. Drag the anchors, pull the control handles, watch the path string update live. Click-copy the result. For when you remember "it's Bezier something" but not the exact curve you wanted.

[Live demo](https://sen.ltd/portfolio/svg-path-editor/)

## What it does

- Parses any `d` attribute using the standard SVG path grammar.
- Normalizes `H`/`V`/`S`/`T` and relative commands into canonical absolute `M`/`L`/`C`/`Q`/`Z`. Round-trips are stable.
- Renders the path on a grid, overlays anchor points (green) and bezier control handles (orange), and makes them draggable.
- Emits a clean, rounded `d` string (no 17-digit floats) with a one-click copy.
- Ships five presets (heart, star, arrow, wave, cloud) to start from.

Arcs (`A`) are deliberately not supported — they don't fit the four-handle editor model. If you need arcs, convert them to cubics first (e.g. with `svgo`).

## Stack

- Svelte 5 + Vite + TypeScript
- Zero runtime dependencies beyond Svelte itself.
- Vitest for parser round-trip tests.

## Getting started

```sh
npm install
npm run dev          # localhost:5173
npm run build        # → dist/
npm test             # 18 tests covering parse + serialize
```

## Project layout

```
src/
  App.svelte     — UI: canvas, draggable nodes, textarea, preset buttons
  parse.ts       — d → Path AST (absolute, canonical)
  serialize.ts   — Path AST → d string (trimmed, rounded)
  presets.ts     — starter paths
  types.ts       — Path / Node types (discriminated union by kind)
  style.css      — dark-theme CSS, grid background, node colors
tests/
  parse.test.ts  — parser behavior + round-trip stability
```

## License

MIT. See `LICENSE`.

<!-- sen-publish:links -->
## Links

- 🌐 Demo: https://sen.ltd/portfolio/svg-path-editor/
- 📝 dev.to: https://dev.to/sendotltd/i-finally-understand-the-svg-d-attribute-because-i-built-an-editor-for-it-5b74
<!-- /sen-publish:links -->
