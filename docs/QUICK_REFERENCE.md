# Claude Code Nexus - Quick Reference

## 🚀 快速开始

```bash
# 1. 设置环境变量
export ANTHROPIC_API_KEY="ak-your-nexus-key"
export ANTHROPIC_BASE_URL="https://claude.nekro.ai"

# 2. 使用 Claude Code
claude
```

## 📋 功能速查

### 多密钥管理

| 操作 | 页面位置 | 说明 |
|------|---------|------|
| 添加密钥 | 密钥管理 → 添加密钥 | 配置新的后端 API Key |
| 编辑密钥 | 密钥管理 → 编辑按钮 | 修改优先级、权重等 |
| 删除密钥 | 密钥管理 → 删除按钮 | 移除不用的密钥 |
| 查看统计 | 密钥管理 → 表格 | 成功率、请求数等 |

**密钥选择优先级**:
```
优先级 (高→低) → 权重 (按比例) → 最少使用
```

### 网关日志

| 指标 | 位置 | 用途 |
|------|------|------|
| 总请求数 | 日志页面顶部 | 监控使用量 |
| 成功率 | 日志页面顶部 | 服务健康度 |
| Token 数 | 日志页面顶部 | 成本追踪 |
| 平均延迟 | 日志页面顶部 | 性能分析 |
| 详细日志 | 日志页面表格 | 故障排查 |

**日志保留期**: 30 天

### 代理配置

| 服务 | 推荐代理 | Base URL |
|------|---------|----------|
| Google Gemini | Cloudflare | `https://gemini-openai-proxy.zuisyu.workers.dev/v1beta/openai` |
| Google Gemini | GitHub | `https://generativelanguage.googleapis.com/v1beta/openai` |
| 其他服务 | 直连 | 使用官方地址 |

### API Key 管理

| 操作 | 位置 | 注意事项 |
|------|------|---------|
| 查看 Key | 控制台 → CLI 配置 | 部分隐藏显示 |
| 复制 Key | 复制按钮 | 复制完整 Key |
| 重新生成 | 控制台 → 重新生成按钮 | 旧 Key 立即失效 |

## 🔧 配置参考

### 基础配置

```typescript
// 单密钥配置（传统方式）
{
  baseUrl: "https://api.nekro.ai/v1",
  apiKey: "sk-your-key"
}
```

### 多密钥配置示例

#### 主备模式
```typescript
[
  {
    name: "主要服务",
    priority: 100,  // 高优先级
    weight: 10,
    baseUrl: "https://primary.example.com/v1",
    enabled: true
  },
  {
    name: "备用服务",
    priority: 50,   // 低优先级（主要服务失败时使用）
    weight: 10,
    baseUrl: "https://backup.example.com/v1",
    enabled: true
  }
]
```

#### 负载均衡模式
```typescript
[
  {
    name: "服务A",
    priority: 100,
    weight: 7,      // 70% 流量
    baseUrl: "https://service-a.example.com/v1",
    enabled: true
  },
  {
    name: "服务B",
    priority: 100,
    weight: 3,      // 30% 流量
    baseUrl: "https://service-b.example.com/v1",
    enabled: true
  }
]
```

### 模型映射

#### 系统默认（推荐 Gemini 用户）
```
haiku  → gemini-2.0-flash-exp
sonnet → gemini-2.0-flash-thinking-exp
opus   → gemini-exp-1206
```

#### 自定义映射（OpenAI 用户）
```
haiku  → gpt-4o-mini
sonnet → gpt-4o
opus   → gpt-4o
```

## 📊 监控指标

### 密钥健康度

| 指标 | 正常值 | 警告值 | 危险值 |
|------|--------|--------|--------|
| 成功率 | > 95% | 90-95% | < 90% |
| 失败次数 | 0-2 | 3-4 | ≥ 5 (自动禁用) |
| 响应时间 | < 500ms | 500-1000ms | > 1000ms |

### 日志指标

| 指标 | 含义 | 建议 |
|------|------|------|
| 总请求数 | API 调用次数 | 监控使用量 |
| 成功率 | 成功请求占比 | 应保持 > 95% |
| Token 数 | 消耗的 Token | 成本控制 |
| 平均延迟 | 响应时间 | 性能优化 |

## 🔍 故障排查速查表

| 错误 | 可能原因 | 解决方法 |
|------|---------|---------|
| `authentication_error` | API Key 无效 | 检查环境变量 |
| `No model mapping found` | 模型未配置 | 配置模型映射 |
| `Upstream API failed: 401` | 后端 Key 错误 | 检查 Provider Key |
| `Upstream API failed: 429` | 请求过多 | 添加更多密钥 |
| `Upstream API failed: 500` | 服务故障 | 切换到备用密钥 |
| 所有密钥都失败 | 网络/配置问题 | 检查日志详情 |

## 💡 最佳实践

### 密钥配置
- ✅ 配置至少 2 个密钥（高可用）
- ✅ 主要服务设高优先级（90-100）
- ✅ 备用服务设低优先级（50-80）
- ✅ 定期检查成功率
- ✅ 失败率 > 5% 时及时替换

### 监控建议
- 📊 每周查看一次统计
- 📊 关注失败次数和成功率
- 📊 监控 Token 使用避免超支
- 📊 分析延迟找出性能瓶颈

### 安全建议
- 🔒 不要分享 API Key
- 🔒 使用环境变量存储
- 🔒 定期更换（3-6 个月）
- 🔒 监控异常使用
- 🔒 及时重新生成泄露的 Key

## 🔗 快速链接

| 资源 | 链接 |
|------|------|
| 用户指南 | [USER_GUIDE.md](./USER_GUIDE.md) |
| 多密钥指南 | [MULTI_KEY_GUIDE.md](./MULTI_KEY_GUIDE.md) |
| 部署指南 | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| 更新日志 | [CHANGELOG.md](./CHANGELOG.md) |
| GitHub Issues | [Report Issues](https://github.com/LCYLYM/claude-code-nexus/issues) |

## 📞 获取帮助

1. 查看 [故障排除指南](./TROUBLESHOOTING.md)
2. 搜索 [GitHub Issues](https://github.com/LCYLYM/claude-code-nexus/issues)
3. 加入社区 QQ 群或 Discord
4. 提交新的 Issue

## 🎯 常用命令

```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY
echo $ANTHROPIC_BASE_URL

# 测试连接
curl -X POST $ANTHROPIC_BASE_URL/v1/messages \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}'

# 查看 Claude Code 配置
claude config

# 清除缓存（如有问题）
claude cache clear
```

---

**提示**: 将此页面加入书签，方便快速查阅！

**最后更新**: 2025-01-20
