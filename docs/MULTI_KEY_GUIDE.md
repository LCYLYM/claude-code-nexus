# 多密钥轮询系统 - 完整指南

## 概述

多密钥轮询（Multi-Key Rotation）是 Claude Code Nexus 的核心功能之一，允许你配置多个后端 API 密钥，实现：

- ⚖️ **负载均衡**: 在多个密钥之间自动分配请求
- 🔄 **故障转移**: 某个密钥失败时自动切换
- 📊 **统计追踪**: 详细的使用统计和健康检查
- 🎯 **灵活控制**: 通过优先级和权重精细控制流量

## 架构设计

### 数据模型

每个 Provider Key 包含以下字段：

```typescript
{
  id: string;              // 唯一标识符
  userId: string;          // 所属用户
  keyName: string;         // 密钥名称
  encryptedApiKey: string; // 加密的 API Key
  baseUrl: string;         // API 服务地址
  priority: number;        // 优先级 (0-100)
  weight: number;          // 权重 (1-100)
  enabled: boolean;        // 是否启用
  failureCount: number;    // 失败次数
  lastUsedAt: Date;        // 最后使用时间
  totalRequests: number;   // 总请求数
  successfulRequests: number; // 成功请求数
}
```

### 密钥选择算法

```
┌─────────────────────────────────────┐
│  开始: 选择下一个 Provider Key      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 获取所有启用的 Keys                 │
│ (enabled = true)                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 过滤健康的 Keys                     │
│ (failureCount < 5)                  │
└──────────────┬──────────────────────┘
               │
               ├─ 没有健康的 Keys? ──► 重置所有失败计数 ──┐
               │                                           │
               ▼                                           │
┌─────────────────────────────────────┐                  │
│ 选择最高优先级的 Keys               │                  │
└──────────────┬──────────────────────┘                  │
               │                                           │
               ▼                                           │
┌─────────────────────────────────────┐                  │
│ 在相同优先级中选择最少使用的        │                  │
│ (按 lastUsedAt 排序)                │                  │
└──────────────┬──────────────────────┘                  │
               │                                           │
               ▼                                           │
┌─────────────────────────────────────┐                  │
│ 解密并返回选中的 Key                │                  │
└─────────────────────────────────────┘                  │
                                                           │
               ┌───────────────────────────────────────────┘
               │
               ▼
         返回第一个 Key
```

## API 接口

### 1. 获取所有密钥

**端点**: `GET /api/keys`

**响应**:
```json
{
  "keys": [
    {
      "id": "key_123",
      "keyName": "Primary API Key",
      "baseUrl": "https://api.nekro.ai/v1",
      "priority": 90,
      "weight": 10,
      "enabled": true,
      "failureCount": 0,
      "lastUsedAt": "2025-01-20T10:30:00Z",
      "totalRequests": 1250,
      "successfulRequests": 1245,
      "createdAt": "2025-01-15T08:00:00Z",
      "updatedAt": "2025-01-20T10:30:00Z"
    }
  ]
}
```

### 2. 创建密钥

**端点**: `POST /api/keys`

**请求体**:
```json
{
  "keyName": "Backup API Key",
  "apiKey": "sk-your-api-key-here",
  "baseUrl": "https://api.openai.com/v1",
  "priority": 50,
  "weight": 5,
  "enabled": true
}
```

**响应**:
```json
{
  "id": "key_456",
  "message": "Key created successfully"
}
```

### 3. 更新密钥

**端点**: `PUT /api/keys/{keyId}`

**请求体**:
```json
{
  "keyName": "Updated Name",
  "priority": 80,
  "enabled": false
}
```

**注意**: 
- `apiKey` 字段可选，留空则不更新
- 只能更新自己的密钥

### 4. 删除密钥

**端点**: `DELETE /api/keys/{keyId}`

**响应**:
```json
{
  "message": "Key deleted successfully"
}
```

### 5. 获取密钥统计

**端点**: `GET /api/keys/{keyId}/stats`

**响应**:
```json
{
  "totalRequests": 1250,
  "successfulRequests": 1245,
  "failureRate": 0.4
}
```

## 使用场景

### 场景 1: 基础负载均衡

**配置**:
```
Key A: priority=100, weight=10, baseUrl=service-a.com
Key B: priority=100, weight=10, baseUrl=service-b.com
```

**效果**: 请求在两个密钥之间均匀分配

### 场景 2: 主备模式

**配置**:
```
Primary: priority=100, weight=10, baseUrl=primary-service.com
Backup:  priority=50,  weight=10, baseUrl=backup-service.com
```

**效果**: 
- 正常情况下使用 Primary
- Primary 失败 5 次后自动切换到 Backup

### 场景 3: 多层降级

**配置**:
```
Tier 1: priority=100, weight=10 (高级服务)
Tier 2: priority=80,  weight=10 (标准服务)
Tier 3: priority=50,  weight=10 (备用服务)
```

**效果**: 按优先级依次降级

### 场景 4: 加权流量分配

**配置**:
```
Key A: priority=100, weight=7  (70% 流量)
Key B: priority=100, weight=3  (30% 流量)
```

**效果**: 按权重比例分配请求

## 监控和维护

### 关键指标

在密钥管理页面监控：

1. **成功率**: `successfulRequests / totalRequests * 100%`
2. **最后使用时间**: 确认密钥在正常轮换
3. **失败次数**: > 3 需要关注，= 5 会被暂时跳过

### 健康检查策略

系统自动进行健康检查：

```typescript
// 密钥被认为不健康的条件
if (key.failureCount >= 5) {
  // 跳过此密钥
}

// 成功后重置
if (requestSuccess) {
  key.failureCount = 0;
}

// 失败后累加
if (requestFailed) {
  key.failureCount += 1;
}
```

### 最佳实践

1. **至少配置 2 个密钥**: 实现基本的高可用
2. **设置合理的优先级**: 避免所有密钥同优先级
3. **定期检查统计**: 每周查看一次成功率
4. **及时替换异常密钥**: 失败率 > 5% 需要调查
5. **保留备用密钥**: 低优先级的备用密钥很重要

## 故障排除

### 问题 1: 某个密钥一直不被使用

**原因**: 
- 优先级设置过低
- 被标记为不健康（失败次数 >= 5）

**解决**:
```
1. 检查优先级设置
2. 查看失败次数，如果 >= 5，临时禁用其他密钥测试
3. 手动重置失败计数（编辑密钥，不修改任何字段，直接保存）
```

### 问题 2: 所有密钥都失败

**现象**: 请求返回 500 错误

**排查步骤**:
```
1. 检查网关日志 (/logs)
2. 验证每个密钥的 API Key 是否有效
3. 检查 baseUrl 是否正确
4. 测试后端服务是否在线
```

### 问题 3: 负载不均衡

**原因**: 
- 权重设置不合理
- 最后使用时间差异大

**解决**:
```
1. 调整权重比例
2. 确保所有密钥都是启用状态
3. 临时禁用某些密钥观察流量变化
```

## 安全考虑

### 加密存储

所有 API Key 在数据库中加密存储：

```typescript
// 保存时
const encrypted = await encryptApiKey(plainKey, ENCRYPTION_KEY);

// 使用时
const decrypted = await decryptApiKey(encrypted, ENCRYPTION_KEY);
```

### 权限控制

- 用户只能访问自己的密钥
- API 端点有认证中间件保护
- 密钥不会在日志中明文显示

### 审计追踪

每个密钥的使用都会记录：

- 使用时间
- 请求结果
- 相关联的网关日志

## 性能优化

### 数据库索引

关键字段已添加索引：

```sql
CREATE INDEX provider_keys_user_id_idx ON provider_keys(user_id);
CREATE INDEX provider_keys_enabled_idx ON provider_keys(enabled);
```

### 缓存策略

密钥选择算法在单次请求内完成，无需缓存。

### 并发控制

使用数据库事务确保计数器的准确性：

```typescript
await db.update(providerKeys)
  .set({ 
    totalRequests: providerKeys.totalRequests + 1 
  })
  .where(eq(providerKeys.id, keyId));
```

## 高级功能（未来计划）

1. **速率限制**: 按密钥设置 QPS 限制
2. **定时任务**: 自动重置失败计数
3. **告警通知**: 失败率过高时发送通知
4. **A/B 测试**: 灵活的流量分配策略
5. **地理位置**: 根据用户位置选择密钥

## 示例代码

### 使用 API 管理密钥

```typescript
// 添加密钥
async function addKey() {
  const response = await fetch('/api/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      keyName: 'My API Key',
      apiKey: 'sk-...',
      baseUrl: 'https://api.example.com/v1',
      priority: 90,
      weight: 10,
      enabled: true,
    }),
  });
  
  const data = await response.json();
  console.log('Key created:', data.id);
}

// 获取统计
async function getStats(keyId: string) {
  const response = await fetch(`/api/keys/${keyId}/stats`, {
    credentials: 'include',
  });
  
  const stats = await response.json();
  console.log('Success rate:', 
    (stats.successfulRequests / stats.totalRequests * 100).toFixed(2) + '%'
  );
}
```

### 测试密钥轮换

```bash
# 发送多个请求观察密钥使用情况
for i in {1..10}; do
  curl -X POST https://your-domain.pages.dev/v1/messages \
    -H "Authorization: Bearer ak-your-nexus-key" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "claude-3-5-sonnet-20241022",
      "messages": [{"role": "user", "content": "Hello"}],
      "max_tokens": 100
    }'
  sleep 1
done

# 然后在网关日志中查看使用了哪些密钥
```

## 总结

多密钥轮询系统提供了企业级的高可用和负载均衡能力：

✅ 自动故障转移  
✅ 灵活的流量控制  
✅ 详细的统计追踪  
✅ 简单易用的管理界面  

合理配置和监控多个密钥，可以显著提高服务的稳定性和可用性。

---

**版本**: v1.0  
**最后更新**: 2025-01-20
