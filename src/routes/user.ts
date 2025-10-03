import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { generateUserApiKey } from "../utils/encryption";
import { authMiddleware } from "../middleware/auth";
import type { Bindings } from "../types";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as drizzleSchema from "../db/schema";
import { z } from "zod";

type Variables = {
  db: DrizzleD1Database<typeof drizzleSchema>;
  user: typeof drizzleSchema.users.$inferSelect;
};

const app = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

app.use("/*", authMiddleware);

// Regenerate user API key
app.openapi(
  createRoute({
    method: "post",
    path: "/regenerate-key",
    summary: "重新生成用户 API Key",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              confirm: z.boolean(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "重新生成成功" },
      400: { description: "请求错误" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const body = await c.req.json();

    if (!body.confirm) {
      return c.json({ error: "Confirmation required" }, 400);
    }

    // 生成新的 API key
    const newApiKey = generateUserApiKey();

    // 更新数据库
    await db
      .update(users)
      .set({
        apiKey: newApiKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log(`🔑 API Key regenerated for user: ${user.username} (${user.id})`);

    return c.json({
      message: "API Key regenerated successfully",
      apiKey: newApiKey,
      warning: "Please update your Claude Code configuration with the new API key",
    });
  },
);

// Get current user info
app.openapi(
  createRoute({
    method: "get",
    path: "/me",
    summary: "获取当前用户信息",
    responses: {
      200: { description: "成功" },
    },
  }),
  async (c) => {
    const user = c.get("user");

    return c.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      apiKey: user.apiKey,
      createdAt: user.createdAt,
    });
  },
);

export default app;
