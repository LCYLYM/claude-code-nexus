import { eq, and, gt } from "drizzle-orm";
import { providerKeys } from "../db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as drizzleSchema from "../db/schema";
import { decryptApiKey } from "../utils/encryption";

export interface ProviderKeyData {
  id: string;
  keyName: string;
  baseUrl: string;
  priority: number;
  weight: number;
  enabled: boolean;
  failureCount: number;
  lastUsedAt: Date | null;
  totalRequests: number;
  successfulRequests: number;
}

export interface DecryptedKeyData extends ProviderKeyData {
  apiKey: string;
}

/**
 * Key Rotation Service - 支持多 key 轮询和自动故障转移
 */
export class KeyRotationService {
  constructor(
    private db: DrizzleD1Database<typeof drizzleSchema>,
    private encryptionKey: string,
  ) {}

  /**
   * 获取用户的所有启用的 Provider Keys
   */
  async getUserKeys(userId: string): Promise<ProviderKeyData[]> {
    const keys = await this.db.query.providerKeys.findMany({
      where: and(eq(providerKeys.userId, userId), eq(providerKeys.enabled, true)),
      orderBy: (keys, { desc }) => [desc(keys.priority), desc(keys.weight)],
    });

    return keys.map((key) => ({
      id: key.id,
      keyName: key.keyName,
      baseUrl: key.baseUrl,
      priority: key.priority,
      weight: key.weight,
      enabled: key.enabled,
      failureCount: key.failureCount,
      lastUsedAt: key.lastUsedAt,
      totalRequests: key.totalRequests,
      successfulRequests: key.successfulRequests,
    }));
  }

  /**
   * 使用加权轮询算法选择下一个 key
   * 优先级高的优先选择，相同优先级按权重和最近使用时间选择
   */
  async selectNextKey(userId: string): Promise<DecryptedKeyData | null> {
    const keys = await this.getUserKeys(userId);

    if (keys.length === 0) {
      return null;
    }

    // 过滤掉失败次数过多的 key (超过 5 次)
    const healthyKeys = keys.filter((key) => key.failureCount < 5);

    if (healthyKeys.length === 0) {
      // 如果所有 key 都失败了，重置失败计数并重试
      await this.resetAllFailureCounts(userId);
      return this.selectNextKey(userId);
    }

    // 按优先级分组
    const maxPriority = Math.max(...healthyKeys.map((k) => k.priority));
    const highestPriorityKeys = healthyKeys.filter((k) => k.priority === maxPriority);

    // 在最高优先级的 keys 中，选择使用最少的那个
    const selectedKey = highestPriorityKeys.reduce((prev, current) => {
      if (!prev.lastUsedAt) return current;
      if (!current.lastUsedAt) return current;
      return prev.lastUsedAt < current.lastUsedAt ? prev : current;
    });

    // 解密 API key
    const fullKey = await this.db.query.providerKeys.findFirst({
      where: eq(providerKeys.id, selectedKey.id),
    });

    if (!fullKey) {
      return null;
    }

    const decryptedApiKey = await decryptApiKey(fullKey.encryptedApiKey, this.encryptionKey);

    return {
      ...selectedKey,
      apiKey: decryptedApiKey,
    };
  }

  /**
   * 记录 key 使用成功
   */
  async recordSuccess(keyId: string): Promise<void> {
    await this.db
      .update(providerKeys)
      .set({
        lastUsedAt: new Date(),
        totalRequests: (providerKeys.totalRequests as any) + 1,
        successfulRequests: (providerKeys.successfulRequests as any) + 1,
        failureCount: 0, // 重置失败计数
        updatedAt: new Date(),
      })
      .where(eq(providerKeys.id, keyId));
  }

  /**
   * 记录 key 使用失败
   */
  async recordFailure(keyId: string): Promise<void> {
    await this.db
      .update(providerKeys)
      .set({
        lastFailureAt: new Date(),
        totalRequests: (providerKeys.totalRequests as any) + 1,
        failureCount: (providerKeys.failureCount as any) + 1,
        updatedAt: new Date(),
      })
      .where(eq(providerKeys.id, keyId));
  }

  /**
   * 重置所有 key 的失败计数
   */
  async resetAllFailureCounts(userId: string): Promise<void> {
    await this.db
      .update(providerKeys)
      .set({
        failureCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(providerKeys.userId, userId));
  }

  /**
   * 获取 key 的统计信息
   */
  async getKeyStats(keyId: string): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failureRate: number;
  } | null> {
    const key = await this.db.query.providerKeys.findFirst({
      where: eq(providerKeys.id, keyId),
    });

    if (!key) {
      return null;
    }

    const failureRate =
      key.totalRequests > 0 ? ((key.totalRequests - key.successfulRequests) / key.totalRequests) * 100 : 0;

    return {
      totalRequests: key.totalRequests,
      successfulRequests: key.successfulRequests,
      failureRate,
    };
  }
}
