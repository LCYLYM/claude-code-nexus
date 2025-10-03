import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { GatewayLogService } from "../services/gatewayLogService";
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

// Get user logs
app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "获取用户的网关日志",
    request: {
      query: z.object({
        limit: z.string().optional().default("100"),
        offset: z.string().optional().default("0"),
      }),
    },
    responses: {
      200: { description: "成功" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const { limit, offset } = c.req.query();

    const logService = new GatewayLogService(db);
    const logs = await logService.getUserLogs(user.id, parseInt(limit), parseInt(offset));

    return c.json({ logs });
  },
);

// Get user log statistics
app.openapi(
  createRoute({
    method: "get",
    path: "/stats",
    summary: "获取用户日志统计",
    responses: {
      200: { description: "成功" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");

    const logService = new GatewayLogService(db);
    const stats = await logService.getUserLogStats(user.id);

    return c.json(stats);
  },
);

// Get logs for a specific key
app.openapi(
  createRoute({
    method: "get",
    path: "/key/{keyId}",
    summary: "获取特定 Key 的日志",
    request: {
      params: z.object({ keyId: z.string() }),
      query: z.object({
        limit: z.string().optional().default("100"),
      }),
    },
    responses: {
      200: { description: "成功" },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const { keyId } = c.req.param();
    const { limit } = c.req.query();

    const logService = new GatewayLogService(db);
    const logs = await logService.getKeyLogs(keyId, parseInt(limit));

    return c.json({ logs });
  },
);

export default app;
