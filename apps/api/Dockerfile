FROM node:20-alpine as build
WORKDIR /app
COPY ../../package.json ../../package-lock.json* ./
RUN npm i --omit=dev --ignore-scripts=false || true

FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm i && npm run build
EXPOSE 3001
CMD ["node","dist/index.js"]

