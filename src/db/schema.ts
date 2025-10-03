import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";

// 保留原有的 features 表
export const features = sqliteTable(
  "features",
  {
    id: integer("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [unique("features_key_idx").on(table.key)],
);

// AI 代理服务相关表结构

// 用户表
export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    githubId: text("github_id").notNull().unique(),
    username: text("username").notNull(),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    apiKey: text("api_key")
      .notNull()
      .unique()
      .$defaultFn(() => `ak-${createId()}`),
    encryptedProviderApiKey: text("encrypted_provider_api_key"),
    providerBaseUrl: text("provider_base_url"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => [index("users_github_id_idx").on(table.githubId), index("users_api_key_idx").on(table.apiKey)],
);

// 用户会话表
export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("user_sessions_session_token_idx").on(table.sessionToken),
    index("user_sessions_user_id_idx").on(table.userId),
  ],
);

// 用户模型映射配置表 - 存储用户的映射模式和自定义配置
export const userModelConfig = sqliteTable(
  "user_model_config",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    useSystemMapping: integer("use_system_mapping", { mode: "boolean" }).notNull().default(true), // true=使用系统默认映射，false=使用自定义映射
    // 自定义映射配置（JSON格式存储三个固定映射）
    customHaiku: text("custom_haiku"), // 自定义haiku映射
    customSonnet: text("custom_sonnet"), // 自定义sonnet映射
    customOpus: text("custom_opus"), // 自定义opus映射
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("user_model_config_user_id_idx").on(table.userId)],
);

// Provider API Keys 表 - 支持多 key 轮询
export const providerKeys = sqliteTable(
  "provider_keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(), // 用户给这个key的命名
    encryptedApiKey: text("encrypted_api_key").notNull(), // 加密的API密钥
    baseUrl: text("base_url").notNull(), // API服务地址
    priority: integer("priority").notNull().default(0), // 优先级（数字越大优先级越高）
    weight: integer("weight").notNull().default(1), // 权重（用于加权轮询）
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true), // 是否启用
    failureCount: integer("failure_count").notNull().default(0), // 失败次数
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }), // 最后使用时间
    lastFailureAt: integer("last_failure_at", { mode: "timestamp" }), // 最后失败时间
    totalRequests: integer("total_requests").notNull().default(0), // 总请求数
    successfulRequests: integer("successful_requests").notNull().default(0), // 成功请求数
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("provider_keys_user_id_idx").on(table.userId),
    index("provider_keys_enabled_idx").on(table.enabled),
  ],
);

// Proxy 配置表 - 用于 Google Gemini 等服务的代理
export const proxyConfigs = sqliteTable(
  "proxy_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(), // 代理名称
    targetService: text("target_service").notNull(), // 目标服务 (gemini, openai等)
    proxyUrl: text("proxy_url").notNull(), // 代理地址
    proxyType: text("proxy_type").notNull(), // 代理类型 (cloudflare, github, custom)
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true), // 是否启用
    priority: integer("priority").notNull().default(0), // 优先级
    description: text("description"), // 描述
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("proxy_configs_target_service_idx").on(table.targetService),
    index("proxy_configs_enabled_idx").on(table.enabled),
  ],
);

// Gateway 日志表 - 记录所有 API 请求和响应
export const gatewayLogs = sqliteTable(
  "gateway_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestModel: text("request_model").notNull(), // 请求的模型名
    targetModel: text("target_model").notNull(), // 映射后的目标模型
    requestTokens: integer("request_tokens"), // 请求token数
    responseTokens: integer("response_tokens"), // 响应token数
    totalTokens: integer("total_tokens"), // 总token数
    latencyMs: integer("latency_ms"), // 延迟（毫秒）
    statusCode: integer("status_code").notNull(), // HTTP状态码
    isSuccess: integer("is_success", { mode: "boolean" }).notNull(), // 是否成功
    errorMessage: text("error_message"), // 错误消息（如果有）
    providerKeyId: text("provider_key_id").references(() => providerKeys.id, { onDelete: "set null" }), // 使用的key ID
    streamMode: integer("stream_mode", { mode: "boolean" }).notNull(), // 是否流式
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("gateway_logs_user_id_idx").on(table.userId),
    index("gateway_logs_created_at_idx").on(table.createdAt),
    index("gateway_logs_provider_key_id_idx").on(table.providerKeyId),
  ],
);
