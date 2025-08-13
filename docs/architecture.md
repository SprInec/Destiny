System Architecture

Mermaid

graph TD
    Browser[Web UI (React + Vite)] -->|HTTPS| API[Express API]
    API --> Core[@destiny/core BaZi Engine]
    Browser --> Charts[ECharts / D3]
    API --> Time[Timezone, Calendars]
    Core --> Almanac[Lunar-JS: Solar/Lunar/JieQi]

Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind + ECharts
- Backend: Node.js + Express + TypeScript + Zod
- Core: TypeScript + lunar-javascript + moment-timezone + dayjs
- Quality: ESLint, Vitest
- Deploy: Docker


