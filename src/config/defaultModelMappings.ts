/**
 * 固定的三个模型映射配置
 *
 * Claude 只支持这三个固定的模型系列：haiku、sonnet、opus
 * 用户可以选择使用系统默认映射或配置自定义映射
 */

export interface ModelMappingRule {
  keyword: string;
  description: string;
}

export interface ModelMappingConfig {
  haiku: string;
  sonnet: string;
  opus: string;
}

// 预设的API供应商配置
export interface ApiProvider {
  name: string;
  baseUrl: string;
  description: string;
}

export const PRESET_API_PROVIDERS: ApiProvider[] = [
  {
    name: "NekroAI 中转",
    baseUrl: "https://api.nekro.ai/v1",
    description: "Nekro AI 中转服务",
  },
  {
    name: "谷歌Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    description: "Google Gemini API 服务",
  },
  {
    name: "谷歌Gemini (Cloudflare代理)",
    baseUrl: "https://gemini-openai-proxy.zuisyu.workers.dev/v1beta/openai",
    description: "Google Gemini API - Cloudflare Workers 代理，绕过区域限制",
  },
  {
    name: "谷歌Gemini (GitHub代理)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    description: "Google Gemini API - GitHub Pages 代理方案",
  },
  {
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    description: "阿里云通义千问 API 服务",
  },
  {
    name: "豆包",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    description: "字节跳动豆包 API 服务",
  },
  {
    name: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    description: "月之暗面 Kimi API 服务",
  },
  {
    name: "智谱清言",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    description: "智谱AI 清言 API 服务",
  },
  {
    name: "百度千帆",
    baseUrl: "https://qianfan.baidubce.com/v2",
    description: "百度千帆大模型 API 服务",
  },
  {
    name: "科大讯飞",
    baseUrl: "https://spark-api-open.xf-yun.com/v1",
    description: "科大讯飞星火 API 服务",
  },
  {
    name: "百川",
    baseUrl: "https://api.baichuan-ai.com/v1",
    description: "百川智能 API 服务",
  },
  {
    name: "腾讯混元",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    description: "腾讯混元大模型 API 服务",
  },
  {
    name: "商汤日日新",
    baseUrl: "https://api.sensenova.cn/compatible-mode/v1",
    description: "商汤科技日日新 API 服务",
  },
];

// 固定的三个模型规则
export const FIXED_MODEL_RULES: ModelMappingRule[] = [
  {
    keyword: "haiku",
    description: "轻量级模型，在快速响应和简单任务中使用",
  },
  {
    keyword: "sonnet",
    description: "平衡性能的通用模型，在大多数场景中使用",
  },
  {
    keyword: "opus",
    description: "高性能模型，在复杂推理编码任务中使用",
  },
];

// 系统默认映射配置 - 支持最新的 Claude 模型
export const DEFAULT_MAPPING_CONFIG: ModelMappingConfig = {
  haiku: "gemini-2.0-flash-exp", // 轻量级快速模型
  sonnet: "gemini-2.0-flash-thinking-exp", // 平衡模型，支持 Claude 3.5 Sonnet v2 和 Sonnet 4
  opus: "gemini-exp-1206", // 高性能模型
};

// 默认的 API 配置
export const DEFAULT_API_CONFIG = {
  baseUrl: "https://api.nekro.ai/v1",
  name: "Nekro AI",
};

/**
 * 获取系统默认映射配置
 */
export function getDefaultMappingConfig(): ModelMappingConfig {
  return { ...DEFAULT_MAPPING_CONFIG };
}

/**
 * 根据模型关键词查找目标模型
 * @param keyword 模型关键词
 * @param config 映射配置
 * @returns 目标模型名称，如果没有找到则返回原关键词
 */
export function findTargetModel(keyword: string, config: ModelMappingConfig): string {
  const normalizedKeyword = keyword.toLowerCase();

  // 精确匹配或包含关键词
  for (const rule of FIXED_MODEL_RULES) {
    if (normalizedKeyword.includes(rule.keyword)) {
      return config[rule.keyword as keyof ModelMappingConfig];
    }
  }

  // 如果没有匹配到，返回原关键词
  return keyword;
}

/**
 * 验证映射配置是否完整
 * @param config 映射配置
 * @returns 是否有效
 */
export function isValidMappingConfig(config: any): config is ModelMappingConfig {
  return (
    config &&
    typeof config.haiku === "string" &&
    config.haiku.length > 0 &&
    typeof config.sonnet === "string" &&
    config.sonnet.length > 0 &&
    typeof config.opus === "string" &&
    config.opus.length > 0
  );
}
