# 构建阶段
FROM node:20-alpine as builder
WORKDIR /app

# 复制根目录的包管理文件
COPY package*.json ./
COPY tsconfig.base.json ./

# 复制核心包
COPY packages/core/ ./packages/core/

# 复制 Web 应用
COPY apps/web/ ./apps/web/

# 安装依赖并构建
RUN npm ci --workspace=packages/core --workspace=apps/web
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/web

# 生产阶段 - 使用 nginx 服务静态文件
FROM nginx:alpine

# 复制构建后的静态文件
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# 复制 nginx 配置文件
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]