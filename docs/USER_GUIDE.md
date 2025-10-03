# Claude Code Nexus - 用户指南

## 目录

1. [快速开始](#快速开始)
2. [多密钥轮询配置](#多密钥轮询配置)
3. [代理配置](#代理配置)
4. [模型映射](#模型映射)
5. [网关日志](#网关日志)
6. [API 密钥管理](#api-密钥管理)
7. [故障排除](#故障排除)

## 快速开始

### 1. 注册与登录

访问 [https://claude.nekro.ai/](https://claude.nekro.ai/)，使用 GitHub 账户登录。系统会自动为你生成专属的 API Key。

### 2. 配置后端服务

在**控制台**页面：

1. 选择或输入你的 OpenAI 兼容 API 服务地址
2. 输入你的 API Key
3. 配置模型映射（可选）
4. 点击"保存配置"

### 3. 在 Claude Code 中使用

```bash
# 设置环境变量
export ANTHROPIC_API_KEY="ak-your-nexus-key"
export ANTHROPIC_BASE_URL="https://claude.nekro.ai"

# 使用 Claude Code
claude
```

## 多密钥轮询配置

多密钥轮询功能允许你配置多个后端 API 密钥，实现：

- **负载均衡**: 自动在多个密钥之间分配请求
- **高可用**: 某个密钥失败时自动切换到其他密钥
- **成本优化**: 根据优先级和权重灵活分配流量

### 配置步骤

1. 进入**密钥管理**页面
2. 点击 "添加密钥" 按钮
3. 填写以下信息：
   - **密钥名称**: 便于识别的名称（如 "主要 API Key"）
   - **API Key**: 你的 OpenAI 兼容服务的 API 密钥
   - **Base URL**: API 服务地址（如 `https://api.nekro.ai/v1`）
   - **优先级**: 数字越大优先级越高（0-100）
   - **权重**: 相同优先级下的流量分配权重（1-100）
   - **启用**: 是否启用此密钥

### 工作原理

#### 1. 密钥选择算法

系统使用加权轮询算法选择密钥：

1. 首先选择**最高优先级**的密钥
2. 在相同优先级的密钥中，选择**最少使用**的密钥
3. 跳过**失败次数过多**（>5次）的密钥

#### 2. 自动故障转移

- 请求成功：重置失败计数，记录使用时间
- 请求失败：增加失败计数，记录失败时间
- 失败次数 > 5：暂时跳过该密钥
- 所有密钥都失败：重置所有失败计数，重新尝试

#### 3. 统计信息

每个密钥都会记录：

- 总请求数
- 成功请求数
- 成功率
- 最后使用时间
- 失败次数

### 最佳实践

1. **配置多个密钥**: 至少配置 2-3 个密钥以确保高可用
2. **设置合理的优先级**: 
   - 主要服务设为高优先级（如 90）
   - 备用服务设为低优先级（如 50）
3. **监控统计信息**: 定期查看成功率，及时替换异常密钥
4. **启用/禁用**: 临时禁用某个密钥而不删除配置

## 代理配置

对于受地区限制的服务（特别是 Google Gemini），系统提供内置代理支持。

### 可用代理

在 API 服务提供商下拉列表中，选择带有 "代理" 标记的选项：

1. **谷歌Gemini (Cloudflare代理)**
   - 地址: `https://gemini-openai-proxy.zuisyu.workers.dev/v1beta/openai`
   - 推荐使用，稳定性高

2. **谷歌Gemini (GitHub代理)**
   - 地址: `https://generativelanguage.googleapis.com/v1beta/openai`
   - 备用方案

### 使用方法

1. 在控制台选择代理版本的 API 提供商
2. 输入你的 Google API Key
3. 保存配置

系统会自动检测并应用代理。

### 自定义代理

如果你有自己的代理服务：

1. 选择"自定义"选项
2. 输入代理地址
3. 确保代理兼容 OpenAI API 格式

## 模型映射

模型映射将 Claude 的模型名称转换为目标服务的模型名称。

### 固定映射规则

Claude 支持三个模型系列：

- **haiku**: 轻量级快速模型
- **sonnet**: 平衡性能模型（包括 Sonnet 3.5 v2、Sonnet 4）
- **opus**: 高性能模型

### 配置方式

#### 1. 使用系统默认映射

系统默认映射（推荐）：

```
haiku  -> gemini-2.0-flash-exp
sonnet -> gemini-2.0-flash-thinking-exp  
opus   -> gemini-exp-1206
```

适合使用 Google Gemini 的用户。

#### 2. 自定义映射

切换到"自定义映射"模式：

1. 点击"切换到自定义映射"
2. 为每个模型系列选择目标模型
3. 从模型列表中选择或手动输入

**示例：** 映射到 GPT 模型

```
haiku  -> gpt-4o-mini
sonnet -> gpt-4o
opus   -> gpt-4o
```

### 获取可用模型列表

点击"获取模型列表"按钮，系统会从你配置的 API 服务获取所有可用模型。

## 网关日志

网关日志功能记录所有通过系统的 API 请求。

### 统计面板

顶部显示关键指标：

- **总请求数**: 所有请求的总数
- **成功率**: 成功请求的百分比
- **总 Token 数**: 累计消耗的 Token
- **平均延迟**: 请求的平均响应时间（毫秒）

### 日志列表

每条日志包含：

- **时间**: 请求发起时间
- **请求模型**: 原始 Claude 模型名
- **目标模型**: 映射后的实际模型
- **状态**: HTTP 状态码和成功/失败标记
- **Tokens**: 请求/响应/总 Token 数
- **延迟**: 请求响应时间
- **模式**: Stream（流式）或 Standard（标准）

### 使用场景

1. **调试**: 查看请求是否正确发送
2. **成本追踪**: 监控 Token 使用量
3. **性能分析**: 分析延迟和响应时间
4. **故障排查**: 查看失败请求的错误信息

### 数据保留

日志默认保留 **30 天**，之后自动清理。

## API 密钥管理

### 查看当前 API Key

在控制台页面的 "CLI 配置" 区域可以看到你的 API Key（部分隐藏显示）。

点击复制按钮可以复制完整的 Key。

### 重新生成 API Key

如果需要重新生成（如密钥泄露）：

1. 在控制台找到 "重新生成 API Key" 按钮
2. 点击并确认
3. 系统会显示新的 API Key
4. **立即更新** Claude Code 配置

⚠️ **重要警告**：
- 旧的 API Key 会**立即失效**
- 所有使用旧 Key 的客户端都需要更新
- 建议在非高峰期操作

### 安全建议

1. **不要分享**: API Key 是你的专属凭证
2. **定期更换**: 建议每 3-6 个月更换一次
3. **安全存储**: 使用环境变量而非硬编码
4. **监控使用**: 定期查看日志，及时发现异常

## 故障排除

### 问题 1: 认证失败

**错误**: `authentication_error: Invalid API key`

**解决方法**:
1. 检查环境变量是否正确设置
2. 确认 API Key 没有多余的空格
3. 尝试重新复制粘贴 API Key

### 问题 2: 模型映射未找到

**错误**: `No model mapping found for: claude-3-5-sonnet`

**解决方法**:
1. 确认已配置模型映射
2. 检查映射规则是否包含对应的关键词
3. 尝试重置到系统默认映射

### 问题 3: 上游 API 请求失败

**错误**: `Upstream API request failed: 401`

**解决方法**:
1. 检查后端 API Key 是否正确
2. 确认 Base URL 是否正确
3. 验证后端服务是否正常运行
4. 如果使用多密钥，检查所有密钥的状态

### 问题 4: 代理连接失败

**解决方法**:
1. 尝试切换到其他代理
2. 检查网络连接
3. 直接访问代理地址测试可用性

### 问题 5: 无法获取模型列表

**解决方法**:
1. 确认 API Key 和 Base URL 已配置
2. 检查后端服务是否支持 `/v1/models` 端点
3. 尝试手动输入模型名称

### 获取帮助

如果问题仍未解决：

1. 查看网关日志了解详细错误信息
2. 在 [GitHub Issues](https://github.com/LCYLYM/claude-code-nexus/issues) 提交问题
3. 加入 QQ 群或 Discord 寻求帮助

## 附录：环境变量配置

### Bash/Zsh

```bash
# ~/.bashrc 或 ~/.zshrc
export ANTHROPIC_API_KEY="ak-your-nexus-key"
export ANTHROPIC_BASE_URL="https://claude.nekro.ai"
```

### Fish Shell

```fish
# ~/.config/fish/config.fish
set -gx ANTHROPIC_API_KEY "ak-your-nexus-key"
set -gx ANTHROPIC_BASE_URL "https://claude.nekro.ai"
```

### Windows PowerShell

```powershell
# PowerShell Profile
$env:ANTHROPIC_API_KEY = "ak-your-nexus-key"
$env:ANTHROPIC_BASE_URL = "https://claude.nekro.ai"
```

### Windows CMD

```cmd
# 临时设置
set ANTHROPIC_API_KEY=ak-your-nexus-key
set ANTHROPIC_BASE_URL=https://claude.nekro.ai

# 永久设置（使用 setx）
setx ANTHROPIC_API_KEY "ak-your-nexus-key"
setx ANTHROPIC_BASE_URL "https://claude.nekro.ai"
```

---

**版本**: v1.0  
**最后更新**: 2025-01-20
