# Destiny 项目 Sealos 部署检查清单

## ✅ 部署前准备

- [ ] 代码已推送到 Git 仓库（GitHub/GitLab）
- [ ] 仓库设置为公开或已配置访问权限
- [ ] 已注册 Sealos Cloud 账户：https://cloud.sealos.io/

## 🚀 API 服务部署

- [ ] 在 Sealos 控制台创建应用：`destiny-api`
- [ ] 配置源码构建：
  - [ ] Git 仓库地址：`https://github.com/your-username/destiny`
  - [ ] Dockerfile 路径：`apps/api/Dockerfile`
  - [ ] 端口：`3001`
- [ ] 设置环境变量：
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3001`
- [ ] 资源配置：
  - [ ] CPU: `0.5 核`
  - [ ] 内存: `1Gi`
- [ ] 点击部署并等待完成
- [ ] 启用外网访问并记录域名：`_________________`

## 🌐 Web 服务部署

- [ ] 在 Sealos 控制台创建应用：`destiny-web`
- [ ] 配置源码构建：
  - [ ] Git 仓库地址：`https://github.com/your-username/destiny`
  - [ ] Dockerfile 路径：`apps/web/Dockerfile`
  - [ ] 端口：`80`
- [ ] 设置环境变量：
  - [ ] `VITE_API_URL=https://上面记录的API域名`
- [ ] 资源配置：
  - [ ] CPU: `0.2 核`
  - [ ] 内存: `512Mi`
- [ ] 点击部署并等待完成
- [ ] 启用外网访问并记录域名：`_________________`

## 🔍 部署验证

- [ ] API 健康检查：访问 `https://api域名/health`
- [ ] Web 应用访问：访问 `https://web域名`
- [ ] 功能测试：尝试进行八字计算
- [ ] 移动端兼容性测试

## 📝 部署信息记录

```
部署时间：________________
API 域名：________________
Web 域名：________________
Git 仓库：________________
备注：____________________
```

## 🆘 遇到问题？

1. 查看详细部署指南：`deploy/SEALOS_CONSOLE_DEPLOYMENT.md`
2. 检查应用日志
3. 验证环境变量配置
4. 确认网络访问设置
