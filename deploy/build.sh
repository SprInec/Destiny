#!/bin/bash

# Destiny 项目 Docker 镜像构建脚本
# 用于构建并推送到 Sealos Registry

set -e

# 配置变量 - 请根据您的镜像仓库信息修改
# 推荐使用公共仓库，如 Docker Hub 或 GitHub Container Registry
REGISTRY="docker.io"        # 或 "ghcr.io" 用于 GitHub Container Registry
NAMESPACE="your-username"   # 替换为您的 Docker Hub 用户名或 GitHub 用户名
PROJECT_NAME="destiny"

# 镜像标签
API_IMAGE="${REGISTRY}/${NAMESPACE}/${PROJECT_NAME}-api:latest"
WEB_IMAGE="${REGISTRY}/${NAMESPACE}/${PROJECT_NAME}-web:latest"

echo "开始构建 Destiny 项目镜像..."

# 返回项目根目录
cd "$(dirname "$0")/.."

echo "1. 构建 API 镜像..."
docker build -f apps/api/Dockerfile -t "${API_IMAGE}" .
echo "API 镜像构建完成: ${API_IMAGE}"

echo "2. 构建 Web 镜像..."
docker build -f apps/web/Dockerfile -t "${WEB_IMAGE}" .
echo "Web 镜像构建完成: ${WEB_IMAGE}"

echo "3. 推送镜像到 Sealos Registry..."
docker push "${API_IMAGE}"
docker push "${WEB_IMAGE}"

echo "✅ 所有镜像构建并推送完成！"
echo ""
echo "镜像信息："
echo "- API: ${API_IMAGE}"
echo "- Web: ${WEB_IMAGE}"
echo ""
echo "下一步："
echo "1. 更新 deploy/sealos/ 目录下的 YAML 文件中的镜像地址"
echo "2. 在 Sealos 控制台部署应用"
