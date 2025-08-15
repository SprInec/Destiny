# 构建阶段
FROM node:20-alpine as builder
WORKDIR /app

# 复制根目录的包管理文件
COPY package*.json ./
COPY tsconfig.base.json ./

# 复制核心包
COPY packages/core/ ./packages/core/

# 复制 API 应用
COPY apps/api/ ./apps/api/

# 安装依赖并构建
RUN npm ci --workspace=packages/core --workspace=apps/api
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/api

# 生产阶段
FROM node:20-alpine
WORKDIR /app

# 复制构建结果和必要文件
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/packages/core/dist ./node_modules/@destiny/core/dist
COPY --from=builder /app/packages/core/package.json ./node_modules/@destiny/core/

# 仅安装生产依赖
RUN npm ci --omit=dev

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]

