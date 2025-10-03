import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { providerKeys } from "../db/schema";
import { encryptApiKey } from "../utils/encryption";
import { KeyRotationService } from "../services/keyRotationService";
import { authMiddleware } from "../middleware/auth";
import type { Bindings } from "../types";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as drizzleSchema from "../db/schema";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

type Variables = {
  db: DrizzleD1Database<typeof drizzleSchema>;
  user: typeof drizzleSchema.users.$inferSelect;
};

const app = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

app.use("/*", authMiddleware);

// Schema for creating a new key
const CreateKeySchema = z.object({
  keyName: z.string().min(1).max(100),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  priority: z.number().int().min(0).default(0),
  weight: z.number().int().min(1).default(1),
  enabled: z.boolean().default(true),
});

// Schema for updating a key
const UpdateKeySchema = z.object({
  keyName: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  priority: z.number().int().min(0).optional(),
  weight: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
});

// Get all keys for the authenticated user
app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "获取用户的所有 Provider Keys",
    responses: {
      200: { description: "成功" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");

    const keys = await db.query.providerKeys.findMany({
      where: eq(providerKeys.userId, user.id),
      orderBy: (keys, { desc }) => [desc(keys.priority)],
    });

    // 不返回加密的 API key，只返回统计信息
    const keysData = keys.map((key) => ({
      id: key.id,
      keyName: key.keyName,
      baseUrl: key.baseUrl,
      priority: key.priority,
      weight: key.weight,
      enabled: key.enabled,
      failureCount: key.failureCount,
      lastUsedAt: key.lastUsedAt,
      lastFailureAt: key.lastFailureAt,
      totalRequests: key.totalRequests,
      successfulRequests: key.successfulRequests,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));

    return c.json({ keys: keysData });
  },
);

// Create a new key
app.openapi(
  createRoute({
    method: "post",
    path: "/",
    summary: "添加新的 Provider Key",
    request: {
      body: {
        content: { "application/json": { schema: CreateKeySchema } },
      },
    },
    responses: {
      201: { description: "创建成功" },
      400: { description: "请求错误" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const data = await c.req.json();

    const parsed = CreateKeySchema.safeParse(data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request data", details: parsed.error }, 400);
    }

    const { keyName, apiKey, baseUrl, priority, weight, enabled } = parsed.data;

    // 加密 API key
    const encryptedApiKey = await encryptApiKey(apiKey, c.env.ENCRYPTION_KEY);

    const keyId = createId();
    await db.insert(providerKeys).values({
      id: keyId,
      userId: user.id,
      keyName,
      encryptedApiKey,
      baseUrl,
      priority,
      weight,
      enabled,
      failureCount: 0,
      totalRequests: 0,
      successfulRequests: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return c.json({ id: keyId, message: "Key created successfully" }, 201);
  },
);

// Update a key
app.openapi(
  createRoute({
    method: "put",
    path: "/{keyId}",
    summary: "更新 Provider Key",
    request: {
      params: z.object({ keyId: z.string() }),
      body: {
        content: { "application/json": { schema: UpdateKeySchema } },
      },
    },
    responses: {
      200: { description: "更新成功" },
      403: { description: "无权限" },
      404: { description: "Key 不存在" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const { keyId } = c.req.param();
    const data = await c.req.json();

    const parsed = UpdateKeySchema.safeParse(data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request data", details: parsed.error }, 400);
    }

    // 检查 key 是否属于当前用户
    const existingKey = await db.query.providerKeys.findFirst({
      where: eq(providerKeys.id, keyId),
    });

    if (!existingKey) {
      return c.json({ error: "Key not found" }, 404);
    }

    if (existingKey.userId !== user.id) {
      return c.json({ error: "Permission denied" }, 403);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (parsed.data.keyName !== undefined) updateData.keyName = parsed.data.keyName;
    if (parsed.data.baseUrl !== undefined) updateData.baseUrl = parsed.data.baseUrl;
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
    if (parsed.data.weight !== undefined) updateData.weight = parsed.data.weight;
    if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;

    // 如果提供了新的 API key，加密它
    if (parsed.data.apiKey !== undefined) {
      updateData.encryptedApiKey = await encryptApiKey(parsed.data.apiKey, c.env.ENCRYPTION_KEY);
    }

    await db.update(providerKeys).set(updateData).where(eq(providerKeys.id, keyId));

    return c.json({ message: "Key updated successfully" });
  },
);

// Delete a key
app.openapi(
  createRoute({
    method: "delete",
    path: "/{keyId}",
    summary: "删除 Provider Key",
    request: {
      params: z.object({ keyId: z.string() }),
    },
    responses: {
      200: { description: "删除成功" },
      403: { description: "无权限" },
      404: { description: "Key 不存在" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const { keyId } = c.req.param();

    // 检查 key 是否属于当前用户
    const existingKey = await db.query.providerKeys.findFirst({
      where: eq(providerKeys.id, keyId),
    });

    if (!existingKey) {
      return c.json({ error: "Key not found" }, 404);
    }

    if (existingKey.userId !== user.id) {
      return c.json({ error: "Permission denied" }, 403);
    }

    await db.delete(providerKeys).where(eq(providerKeys.id, keyId));

    return c.json({ message: "Key deleted successfully" });
  },
);

// Get key statistics
app.openapi(
  createRoute({
    method: "get",
    path: "/{keyId}/stats",
    summary: "获取 Key 统计信息",
    request: {
      params: z.object({ keyId: z.string() }),
    },
    responses: {
      200: { description: "成功" },
      403: { description: "无权限" },
      404: { description: "Key 不存在" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const { keyId } = c.req.param();

    const key = await db.query.providerKeys.findFirst({
      where: eq(providerKeys.id, keyId),
    });

    if (!key) {
      return c.json({ error: "Key not found" }, 404);
    }

    if (key.userId !== user.id) {
      return c.json({ error: "Permission denied" }, 403);
    }

    const keyRotationService = new KeyRotationService(db, c.env.ENCRYPTION_KEY);
    const stats = await keyRotationService.getKeyStats(keyId);

    return c.json(stats);
  },
);

export default app;
