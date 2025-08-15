#!/bin/bash

# Destiny 项目 Docker 镜像构建和推送脚本
# 使用说明：./build-and-push.sh [版本号] [命名空间]
# 例如：./build-and-push.sh v1.0.0 my-namespace

set -e

VERSION="v1.0.0"
NAMESPACE="destiny-prod"
REGISTRY="crpi-jmbn324i86bliktg.cn-beijing.personal.cr.aliyuncs.com"

echo "🚀 开始构建 Destiny 项目镜像..."
echo "版本: $VERSION"
echo "命名空间: $NAMESPACE"
echo "镜像仓库: $REGISTRY"

# 检查是否已登录到镜像仓库
echo "📋 检查 Docker 登录状态..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未启动，请先启动 Docker"
    exit 1
fi

# 构建根目录
cd "$(dirname "$0")/.."

echo "📦 构建 API 镜像..."
docker build -f apps/api/Dockerfile -t $REGISTRY/$NAMESPACE/destiny-api:$VERSION .
docker build -f apps/api/Dockerfile -t $REGISTRY/$NAMESPACE/destiny-api:latest .

echo "🌐 构建 Web 镜像..."
docker build -f apps/web/Dockerfile -t $REGISTRY/$NAMESPACE/destiny-web:$VERSION .
docker build -f apps/web/Dockerfile -t $REGISTRY/$NAMESPACE/destiny-web:latest .

echo "📤 推送镜像到仓库..."
docker push $REGISTRY/$NAMESPACE/destiny-api:$VERSION
docker push $REGISTRY/$NAMESPACE/destiny-api:latest
docker push $REGISTRY/$NAMESPACE/destiny-web:$VERSION
docker push $REGISTRY/$NAMESPACE/destiny-web:latest

echo "✅ 镜像构建和推送完成！"
echo ""
echo "📋 构建的镜像："
echo "  - $REGISTRY/$NAMESPACE/destiny-api:$VERSION"
echo "  - $REGISTRY/$NAMESPACE/destiny-web:$VERSION"
echo ""
echo "🔄 接下来的部署步骤："
echo "1. 更新 deploy/sealos/ 目录下的 YAML 文件中的镜像地址"
echo "2. 将 'your-namespace' 替换为实际的命名空间: $NAMESPACE"
echo "3. 执行部署命令"
echo ""
echo "💡 快速替换命令："
echo "sed -i 's/your-namespace/$NAMESPACE/g' deploy/sealos/*.yaml"
