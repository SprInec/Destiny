Destiny Monorepo

Modern Bazi (八字) computation and visualization platform.

Develop

- Install: `npm i`
- Start core + api + web: `npm run dev`

Packages

- `packages/core`: BaZi calculation utilities
- `apps/api`: REST API (Express)
- `apps/web`: Web UI (React + Vite + Tailwind + ECharts)

Env

- Web reads API from `VITE_API_URL` (defaults to `http://localhost:3001`)

Docker

- API: build in `apps/api`


