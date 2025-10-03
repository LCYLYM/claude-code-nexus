import { eq, and, desc, gt } from "drizzle-orm";
import { gatewayLogs } from "../db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as drizzleSchema from "../db/schema";
import { createId } from "@paralleldrive/cuid2";

export interface LogRequest {
  userId: string;
  requestModel: string;
  targetModel: string;
  requestTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  statusCode: number;
  isSuccess: boolean;
  errorMessage?: string;
  providerKeyId?: string;
  streamMode: boolean;
}

export interface LogEntry {
  id: string;
  userId: string;
  requestModel: string;
  targetModel: string;
  requestTokens: number | null;
  responseTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  statusCode: number;
  isSuccess: boolean;
  errorMessage: string | null;
  providerKeyId: string | null;
  streamMode: boolean;
  createdAt: Date;
}

/**
 * Gateway Log Service - 记录所有 API 请求和响应
 */
export class GatewayLogService {
  constructor(private db: DrizzleD1Database<typeof drizzleSchema>) {}

  /**
   * 记录一次 API 请求
   */
  async logRequest(logData: LogRequest): Promise<string> {
    const logId = createId();

    await this.db.insert(gatewayLogs).values({
      id: logId,
      userId: logData.userId,
      requestModel: logData.requestModel,
      targetModel: logData.targetModel,
      requestTokens: logData.requestTokens || null,
      responseTokens: logData.responseTokens || null,
      totalTokens: logData.totalTokens || null,
      latencyMs: logData.latencyMs || null,
      statusCode: logData.statusCode,
      isSuccess: logData.isSuccess,
      errorMessage: logData.errorMessage || null,
      providerKeyId: logData.providerKeyId || null,
      streamMode: logData.streamMode,
      createdAt: new Date(),
    });

    return logId;
  }

  /**
   * 获取用户的日志
   */
  async getUserLogs(userId: string, limit: number = 100, offset: number = 0): Promise<LogEntry[]> {
    const logs = await this.db.query.gatewayLogs.findMany({
      where: eq(gatewayLogs.userId, userId),
      orderBy: [desc(gatewayLogs.createdAt)],
      limit,
      offset,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      requestModel: log.requestModel,
      targetModel: log.targetModel,
      requestTokens: log.requestTokens,
      responseTokens: log.responseTokens,
      totalTokens: log.totalTokens,
      latencyMs: log.latencyMs,
      statusCode: log.statusCode,
      isSuccess: log.isSuccess,
      errorMessage: log.errorMessage,
      providerKeyId: log.providerKeyId,
      streamMode: log.streamMode,
      createdAt: log.createdAt,
    }));
  }

  /**
   * 获取用户日志的统计信息
   */
  async getUserLogStats(userId: string): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    averageLatency: number;
  }> {
    const logs = await this.db.query.gatewayLogs.findMany({
      where: eq(gatewayLogs.userId, userId),
    });

    const totalRequests = logs.length;
    const successfulRequests = logs.filter((log) => log.isSuccess).length;
    const failedRequests = totalRequests - successfulRequests;
    const totalTokens = logs.reduce((sum, log) => sum + (log.totalTokens || 0), 0);
    const averageLatency =
      logs.reduce((sum, log) => sum + (log.latencyMs || 0), 0) / (totalRequests || 1);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokens,
      averageLatency,
    };
  }

  /**
   * 删除过期日志 (保留最近 30 天)
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db
      .delete(gatewayLogs)
      .where(gt(gatewayLogs.createdAt, cutoffDate))
      .returning();

    return result.length;
  }

  /**
   * 获取特定 key 的日志
   */
  async getKeyLogs(providerKeyId: string, limit: number = 100): Promise<LogEntry[]> {
    const logs = await this.db.query.gatewayLogs.findMany({
      where: eq(gatewayLogs.providerKeyId, providerKeyId),
      orderBy: [desc(gatewayLogs.createdAt)],
      limit,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      requestModel: log.requestModel,
      targetModel: log.targetModel,
      requestTokens: log.requestTokens,
      responseTokens: log.responseTokens,
      totalTokens: log.totalTokens,
      latencyMs: log.latencyMs,
      statusCode: log.statusCode,
      isSuccess: log.isSuccess,
      errorMessage: log.errorMessage,
      providerKeyId: log.providerKeyId,
      streamMode: log.streamMode,
      createdAt: log.createdAt,
    }));
  }
}
