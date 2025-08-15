# Destiny 项目 Sealos 部署指南

本指南将帮助您将 Destiny 项目部署到 Sealos 云平台。

## 📋 前置要求

1. **Sealos 账户**：确保您已经注册了 Sealos 账户
2. **Docker 环境**：本地需要安装 Docker 用于构建镜像
3. **kubectl 工具**：用于管理 Kubernetes 资源（可选）
4. **镜像仓库**：阿里云容器镜像服务或其他镜像仓库

## 🚀 快速部署

### 步骤 1：准备镜像仓库

1. 登录阿里云容器镜像服务
2. 创建命名空间（例如：`destiny-prod`）
3. 获取登录凭证并登录 Docker

```bash
# 登录阿里云镜像仓库
docker login registry.cn-hangzhou.aliyuncs.com
```

### 步骤 2：构建和推送镜像

```bash
# 进入项目根目录
cd /path/to/destiny

# 给构建脚本添加执行权限
chmod +x deploy/build-and-push.sh

# 构建并推送镜像（替换 your-namespace 为您的实际命名空间）
./deploy/build-and-push.sh v1.0.0 your-namespace
```

### 步骤 3：更新部署配置

更新部署文件中的命名空间：

```bash
# 批量替换命名空间
sed -i 's/your-namespace/your-actual-namespace/g' deploy/sealos/*.yaml
```

或手动编辑以下文件：
- `deploy/sealos/api-deployment.yaml`
- `deploy/sealos/api-ingress.yaml`
- `deploy/sealos/web-deployment.yaml`

### 步骤 4：在 Sealos 控制台部署

#### 方法一：使用 Sealos 应用管理界面

1. 登录 [Sealos 控制台](https://cloud.sealos.io)
2. 进入 "应用管理" 或 "App Launchpad"
3. 点击 "创建新应用"
4. 选择 "YAML 部署"
5. 依次复制并应用以下文件内容：
   - `deploy/sealos/api-deployment.yaml`
   - `deploy/sealos/api-ingress.yaml`  
   - `deploy/sealos/web-deployment.yaml`

#### 方法二：使用 kubectl 命令行

如果您配置了 kubectl 连接到 Sealos 集群：

```bash
# 创建命名空间
kubectl create namespace destiny

# 应用所有部署文件
kubectl apply -f deploy/sealos/ -n destiny

# 或使用 kustomize
kubectl apply -k deploy/sealos/
```

## 🔧 配置说明

### 环境变量配置

#### API 服务环境变量：
- `NODE_ENV`: 运行环境（production）
- `PORT`: 服务端口（3001）
- `TZ`: 时区设置（Asia/Shanghai）

#### Web 服务环境变量：
- `VITE_API_URL`: API 服务地址
- `TZ`: 时区设置（Asia/Shanghai）

### 资源配置

#### API 服务资源：
- **CPU 请求**: 250m
- **CPU 限制**: 1000m  
- **内存请求**: 256Mi
- **内存限制**: 1Gi
- **副本数**: 2

#### Web 服务资源：
- **CPU 请求**: 100m
- **CPU 限制**: 500m
- **内存请求**: 128Mi
- **内存限制**: 512Mi
- **副本数**: 2

## 🌐 访问应用

部署完成后，您可以通过以下地址访问应用：

- **Web 应用**: `https://destiny-web.your-namespace.sealos.run`
- **API 服务**: `https://destiny-api.your-namespace.sealos.run`

请将 `your-namespace` 替换为您的实际命名空间。

## 📊 监控和日志

### 查看应用状态

在 Sealos 控制台中：
1. 进入 "应用管理"
2. 找到 destiny-api 和 destiny-web 应用
3. 查看运行状态、资源使用情况

### 查看日志

```bash
# 查看 API 服务日志
kubectl logs -f deployment/destiny-api -n destiny

# 查看 Web 服务日志  
kubectl logs -f deployment/destiny-web -n destiny
```

## 🔄 更新部署

### 更新镜像版本

1. 构建新版本镜像：
```bash
./deploy/build-and-push.sh v1.1.0 your-namespace
```

2. 更新部署：
```bash
# 更新 API 镜像
kubectl set image deployment/destiny-api destiny-api=registry.cn-hangzhou.aliyuncs.com/your-namespace/destiny-api:v1.1.0 -n destiny

# 更新 Web 镜像
kubectl set image deployment/destiny-web destiny-web=registry.cn-hangzhou.aliyuncs.com/your-namespace/destiny-web:v1.1.0 -n destiny
```

### 扩容/缩容

```bash
# 扩容 API 服务到 3 个副本
kubectl scale deployment destiny-api --replicas=3 -n destiny

# 扩容 Web 服务到 3 个副本
kubectl scale deployment destiny-web --replicas=3 -n destiny
```

## 🛠️ 故障排查

### 常见问题

#### 1. 镜像拉取失败
- 检查镜像地址是否正确
- 确认镜像仓库权限设置
- 验证 Sealos 是否有访问镜像仓库的权限

#### 2. 服务无法访问
- 检查 Ingress 配置
- 确认域名解析
- 查看服务和端点状态

#### 3. 应用启动失败
- 查看 Pod 日志
- 检查资源配置
- 验证环境变量设置

### 诊断命令

```bash
# 查看 Pod 状态
kubectl get pods -n destiny

# 查看服务状态
kubectl get svc -n destiny

# 查看 Ingress 状态
kubectl get ingress -n destiny

# 描述 Pod 详细信息
kubectl describe pod <pod-name> -n destiny

# 查看事件
kubectl get events -n destiny --sort-by='.lastTimestamp'
```

## 🔒 安全配置

### 网络安全
- 应用已配置 HTTPS（通过 Let's Encrypt）
- 启用了 CORS 配置
- 设置了适当的安全头部

### 容器安全
- 使用非 root 用户运行
- 启用了安全上下文
- 禁用了特权升级

### 资源限制
- 设置了 CPU 和内存限制
- 配置了健康检查
- 启用了就绪性探针

## 📈 性能优化

### 缓存策略
- 静态资源设置了长期缓存
- API 响应可根据需要添加缓存

### 负载均衡
- 支持多副本部署
- 自动负载均衡

### 监控建议
- 建议配置 Prometheus 监控
- 设置告警规则
- 定期查看资源使用情况

## 🆘 支持

如果在部署过程中遇到问题，可以：

1. 查看 Sealos 官方文档
2. 检查项目 GitHub Issues
3. 联系技术支持

---

**注意**: 请确保在生产环境中使用前充分测试所有配置。
