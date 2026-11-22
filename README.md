# Rybki

A cozy fishing game. See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

```sh
npm install
npm run dev        # opens on localhost and your LAN IP — open the LAN URL on your phone
npm test           # core logic tests
npm run build      # typecheck + production build into dist/
```

Code layout:

- `src/core/` — pure game rules (no Phaser), unit-tested. Tunable data lives in `src/core/data/`.
- `src/scenes/` — Phaser rendering and input only.
