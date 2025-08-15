# 构建阶段
FROM node:20-alpine as builder
WORKDIR /app

# 安装构建工具
RUN apk add --no-cache python3 make g++

# 复制根目录的包管理文件
COPY package*.json ./
COPY tsconfig.base.json ./

# 复制核心包
COPY packages/core/ ./packages/core/

# 复制 API 应用
COPY apps/api/ ./apps/api/

# 安装依赖并构建
RUN npm ci --workspace=packages/core --workspace=apps/api --only=production
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/api

# 生产阶段
FROM node:20-alpine
WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S destiny -u 1001

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 复制构建结果和必要文件
COPY --from=builder --chown=destiny:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=destiny:nodejs /app/apps/api/package*.json ./
COPY --from=builder --chown=destiny:nodejs /app/packages/core/dist ./node_modules/@destiny/core/dist
COPY --from=builder --chown=destiny:nodejs /app/packages/core/package.json ./node_modules/@destiny/core/
COPY --from=builder --chown=destiny:nodejs /app/node_modules ./node_modules

# 切换到非 root 用户
USER destiny

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]

