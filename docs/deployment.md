Deployment

Local Dev

- npm i
- npm run dev (run all workspaces)

API Docker

- cd apps/api
- docker build -t destiny-api .
- docker run -p 3001:3001 destiny-api

Web

- cd apps/web
- npm run build
- npm run preview

Env

- VITE_API_URL=http://localhost:3001


