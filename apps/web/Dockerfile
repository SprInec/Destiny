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

# 复制 Web 应用
COPY apps/web/ ./apps/web/

# 安装依赖并构建
RUN npm ci --workspace=packages/core --workspace=apps/web --only=production
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/web

# 生产阶段 - 使用 nginx 服务静态文件
FROM nginx:alpine

# 创建非 root 用户并设置权限
RUN addgroup -g 1001 -S nginx-group && \
    adduser -S nginx-user -u 1001 -G nginx-group

# 复制构建后的静态文件
COPY --from=builder --chown=nginx-user:nginx-group /app/apps/web/dist /usr/share/nginx/html

# 复制 nginx 配置文件
COPY --chown=nginx-user:nginx-group apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 设置正确的权限
RUN chown -R nginx-user:nginx-group /var/cache/nginx && \
    chown -R nginx-user:nginx-group /var/log/nginx && \
    chown -R nginx-user:nginx-group /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-group /var/run/nginx.pid

# 切换到非 root 用户
USER nginx-user

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]