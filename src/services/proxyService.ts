import { eq, and } from "drizzle-orm";
import { proxyConfigs } from "../db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as drizzleSchema from "../db/schema";

export interface ProxyConfig {
  id: string;
  name: string;
  targetService: string;
  proxyUrl: string;
  proxyType: string;
  enabled: boolean;
  priority: number;
  description: string | null;
}

/**
 * Proxy Service - 管理代理配置，特别是 Google Gemini 的代理
 */
export class ProxyService {
  constructor(private db: DrizzleD1Database<typeof drizzleSchema>) {}

  /**
   * 获取指定服务的启用代理
   */
  async getEnabledProxies(targetService: string): Promise<ProxyConfig[]> {
    const proxies = await this.db.query.proxyConfigs.findMany({
      where: and(eq(proxyConfigs.targetService, targetService), eq(proxyConfigs.enabled, true)),
      orderBy: (proxies, { desc }) => [desc(proxies.priority)],
    });

    return proxies.map((proxy) => ({
      id: proxy.id,
      name: proxy.name,
      targetService: proxy.targetService,
      proxyUrl: proxy.proxyUrl,
      proxyType: proxy.proxyType,
      enabled: proxy.enabled,
      priority: proxy.priority,
      description: proxy.description,
    }));
  }

  /**
   * 选择最高优先级的代理
   */
  async selectBestProxy(targetService: string): Promise<ProxyConfig | null> {
    const proxies = await this.getEnabledProxies(targetService);

    if (proxies.length === 0) {
      return null;
    }

    // 返回优先级最高的代理
    return proxies[0];
  }

  /**
   * 应用代理到 URL
   */
  applyProxy(originalUrl: string, proxy: ProxyConfig | null): string {
    if (!proxy) {
      return originalUrl;
    }

    // 对于 Cloudflare Workers 代理，替换基础 URL
    if (proxy.proxyType === "cloudflare") {
      const url = new URL(originalUrl);
      const proxyUrl = new URL(proxy.proxyUrl);
      return `${proxyUrl.origin}${url.pathname}${url.search}`;
    }

    // 对于 GitHub 代理，也是替换基础 URL
    if (proxy.proxyType === "github") {
      const url = new URL(originalUrl);
      const proxyUrl = new URL(proxy.proxyUrl);
      return `${proxyUrl.origin}${url.pathname}${url.search}`;
    }

    // 默认情况，返回原始 URL
    return originalUrl;
  }

  /**
   * 检查是否应该使用代理
   */
  shouldUseProxy(baseUrl: string): boolean {
    // 对于 Google Gemini API，建议使用代理
    return baseUrl.includes("generativelanguage.googleapis.com");
  }
}

// 预设的代理配置 - 可以在初始化时插入数据库
export const DEFAULT_PROXIES = [
  {
    name: "Cloudflare Gemini Proxy",
    targetService: "gemini",
    proxyUrl: "https://gemini.cloudflare-proxy.workers.dev/v1beta/openai",
    proxyType: "cloudflare",
    enabled: false, // 默认关闭，用户需要手动启用
    priority: 100,
    description: "Cloudflare Workers 代理，绕过区域限制",
  },
  {
    name: "GitHub Gemini Proxy",
    targetService: "gemini",
    proxyUrl: "https://raw.githubusercontent.com/gemini-proxy/api/main/v1beta/openai",
    proxyType: "github",
    enabled: false,
    priority: 90,
    description: "GitHub Pages 代理，备用方案",
  },
];
