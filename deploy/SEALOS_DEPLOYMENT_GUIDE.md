# Destiny 项目 Sealos Cloud 部署指南

本指南将帮助您将 Destiny 八字计算平台部署到 Sealos Cloud 上，让其他人可以通过互联网访问。

## 前置条件

1. **Sealos Cloud 账户**：注册 [Sealos Cloud](https://cloud.sealos.io/) 账户
2. **Docker 环境**：本地安装 Docker Desktop 或 Docker Engine
3. **项目代码**：确保您有完整的 Destiny 项目代码

## 部署步骤

### 第一步：准备 Sealos 环境

1. **登录 Sealos Cloud**
   - 访问 https://cloud.sealos.io/
   - 使用您的账户登录

2. **创建应用**
   - 在 Sealos 控制台点击「应用管理」
   - 点击「创建新应用」

### 第二步：构建和推送 Docker 镜像

由于您使用的是 Windows 系统，请按照以下步骤：

1. **打开 PowerShell 或命令提示符**，导航到项目根目录：
   ```powershell
   cd E:\Project\Destiny
   ```

2. **登录 Sealos Registry**（如果使用 Sealos 内置仓库）：
   ```powershell
   docker login sealos.hub:5000
   ```

3. **构建 API 镜像**：
   ```powershell
   docker build -f apps/api/Dockerfile -t your-registry/destiny-api:latest .
   ```

4. **构建 Web 镜像**：
   ```powershell
   docker build -f apps/web/Dockerfile -t your-registry/destiny-web:latest .
   ```

5. **推送镜像**：
   ```powershell
   docker push your-registry/destiny-api:latest
   docker push your-registry/destiny-web:latest
   ```

   > **注意**：将 `your-registry` 替换为您的实际镜像仓库地址

### 第三步：配置部署文件

1. **更新镜像地址**
   编辑以下文件，将镜像地址替换为您推送的实际地址：
   - `deploy/sealos/api-deployment.yaml`
   - `deploy/sealos/web-deployment.yaml`

2. **配置域名**
   在以下文件中设置您的域名：
   - `deploy/sealos/api-ingress.yaml` - 替换 `your-api-domain.sealos.run`
   - `deploy/sealos/web-deployment.yaml` - 替换 `your-web-domain.sealos.run`

### 第四步：在 Sealos 控制台部署

#### 方法一：使用 Sealos 应用模板（推荐）

1. **部署 API 服务**：
   - 在 Sealos 控制台选择「应用管理」→「创建应用」
   - 选择「自定义镜像」
   - 配置如下：
     - 应用名称：`destiny-api`
     - 镜像地址：`your-registry/destiny-api:latest`
     - 端口：`3001`
     - CPU：`0.25 核`
     - 内存：`512Mi`
     - 副本数：`1`

2. **配置 API 域名**：
   - 在应用详情页面，点击「网络配置」
   - 添加自定义域名或使用 Sealos 提供的域名
   - 记录 API 服务的访问地址

3. **部署 Web 服务**：
   - 创建新应用：`destiny-web`
   - 镜像地址：`your-registry/destiny-web:latest`
   - 端口：`80`
   - CPU：`0.1 核`
   - 内存：`256Mi`
   - 环境变量：
     - `VITE_API_URL`: 设置为 API 服务的访问地址

4. **配置 Web 域名**：
   - 为 Web 应用配置域名
   - 启用 HTTPS（Sealos 自动配置 SSL 证书）

#### 方法二：使用 YAML 文件部署

1. **上传配置文件**：
   在 Sealos 控制台选择「YAML 部署」，依次应用：
   ```bash
   # 1. 部署 API 服务
   kubectl apply -f deploy/sealos/api-deployment.yaml
   
   # 2. 部署 API Ingress
   kubectl apply -f deploy/sealos/api-ingress.yaml
   
   # 3. 部署 Web 服务
   kubectl apply -f deploy/sealos/web-deployment.yaml
   ```

### 第五步：验证部署

1. **检查服务状态**：
   - 在 Sealos 控制台查看应用状态
   - 确保所有 Pod 都处于 Running 状态

2. **测试 API 服务**：
   ```bash
   curl https://your-api-domain.sealos.run/health
   ```

3. **访问 Web 应用**：
   在浏览器中访问您的 Web 域名，验证应用是否正常工作

## 常见问题

### Q1: 镜像构建失败
- **解决方案**：检查 Docker 是否正常运行，确保有足够的磁盘空间
- 清理 Docker 缓存：`docker system prune -a`

### Q2: 应用无法访问
- **检查网络配置**：确保端口映射正确
- **查看日志**：在 Sealos 控制台查看应用日志
- **检查健康检查**：确保健康检查端点返回正常

### Q3: API 跨域问题
- **解决方案**：已在 nginx 配置和 Ingress 中配置了 CORS
- 如果仍有问题，检查 API 服务的 CORS 配置

### Q4: 环境变量配置
- **API_URL 配置**：确保 Web 应用中的 `VITE_API_URL` 指向正确的 API 地址
- **生产环境变量**：检查所有必要的环境变量都已设置

## 监控和维护

1. **监控应用状态**：
   - 使用 Sealos 控制台监控 CPU、内存使用情况
   - 设置告警规则

2. **日志查看**：
   - 在 Sealos 控制台查看实时日志
   - 使用日志过滤功能排查问题

3. **扩缩容**：
   - 根据访问量调整副本数
   - 调整资源配置（CPU/内存）

4. **版本更新**：
   - 构建新版本镜像
   - 在 Sealos 控制台更新镜像版本
   - 执行滚动更新

## 成本优化

1. **资源配置**：
   - 根据实际使用情况调整 CPU 和内存配置
   - 在低峰期减少副本数

2. **镜像优化**：
   - 使用多阶段构建减小镜像大小
   - 清理不必要的依赖

3. **缓存策略**：
   - 配置适当的缓存策略
   - 使用 CDN 加速静态资源

## 技术支持

如果在部署过程中遇到问题：

1. **查看 Sealos 官方文档**：https://docs.sealos.io/
2. **社区支持**：加入 Sealos 社区群组
3. **项目 Issues**：在项目仓库提交 Issue

---

**部署完成后，您的 Destiny 八字计算平台就可以供其他人访问了！** 🎉

