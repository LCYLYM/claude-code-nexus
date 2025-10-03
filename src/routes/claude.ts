import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../db/schema";
import { ClaudeRequestSchema } from "@common/validators/claude.schema";
import { decryptApiKey } from "../utils/encryption";
import { ModelMappingService } from "../services/modelMappingService";
import { KeyRotationService } from "../services/keyRotationService";
import { ProxyService } from "../services/proxyService";
import { GatewayLogService } from "../services/gatewayLogService";
import type { Bindings } from "../types";
import * as drizzleSchema from "../db/schema";
import { convertClaudeToOpenAI, convertOpenAIToClaude } from "../utils/claudeConverter";

type Variables = {
  db: DrizzleD1Database<typeof drizzleSchema>;
  user?: typeof drizzleSchema.users.$inferSelect;
};

// --- StreamConverter 类 ---
class ClaudeStreamConverter {
  private claudeModel: string;
  private messageId: string;
  private contentBlockIndex: number;
  private hasSentMessageStart: boolean;
  private toolCallStates: { [id: string]: { name: string; arguments: string } };

  constructor(claudeModel: string) {
    this.claudeModel = claudeModel;
    this.messageId = `msg_${Math.random().toString(36).substr(2, 24)}`;
    this.contentBlockIndex = -1;
    this.hasSentMessageStart = false;
    this.toolCallStates = {};
  }

  private formatEvent(eventName: string, data: object): string {
    return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  public generateInitialEvents(): string[] {
    const events = [];
    if (!this.hasSentMessageStart) {
      const messageStartEvent = {
        type: "message_start",
        message: {
          id: this.messageId,
          type: "message",
          role: "assistant",
          content: [],
          model: this.claudeModel,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      };
      events.push(this.formatEvent("message_start", messageStartEvent));
      this.hasSentMessageStart = true;
    }
    return events;
  }

  public processOpenAIChunk(chunk: any): string[] {
    const events: string[] = [];
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return events;

    if (delta.content) {
      if (
        this.contentBlockIndex === -1 ||
        this.toolCallStates[Object.keys(this.toolCallStates)[this.contentBlockIndex]]
      ) {
        // 如果当前是工具块，或者还没有块，则开始新的文本块
        if (this.contentBlockIndex !== -1) {
          events.push(
            this.formatEvent("content_block_stop", { type: "content_block_stop", index: this.contentBlockIndex }),
          );
        }
        this.contentBlockIndex++;
        events.push(
          this.formatEvent("content_block_start", {
            type: "content_block_start",
            index: this.contentBlockIndex,
            content_block: { type: "text", text: "" },
          }),
        );
      }
      events.push(
        this.formatEvent("content_block_delta", {
          type: "content_block_delta",
          index: this.contentBlockIndex,
          delta: { type: "text_delta", text: delta.content },
        }),
      );
    }

    if (delta.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        if (
          toolCallDelta.index > this.contentBlockIndex ||
          (this.contentBlockIndex !== -1 &&
            !this.toolCallStates[Object.keys(this.toolCallStates)[this.contentBlockIndex]])
        ) {
          if (this.contentBlockIndex !== -1) {
            events.push(
              this.formatEvent("content_block_stop", { type: "content_block_stop", index: this.contentBlockIndex }),
            );
          }
          this.contentBlockIndex = toolCallDelta.index;
          const toolCallId = toolCallDelta.id || `toolu_${Math.random().toString(36).substr(2, 24)}`;
          this.toolCallStates[toolCallId] = { name: toolCallDelta.function.name || "", arguments: "" };

          events.push(
            this.formatEvent("content_block_start", {
              type: "content_block_start",
              index: this.contentBlockIndex,
              content_block: {
                type: "tool_use",
                id: toolCallId,
                name: this.toolCallStates[toolCallId].name,
                input: {},
              },
            }),
          );
        }

        const toolCallId = Object.keys(this.toolCallStates)[toolCallDelta.index];
        if (toolCallId && toolCallDelta.function?.arguments) {
          this.toolCallStates[toolCallId].arguments += toolCallDelta.function.arguments;
          events.push(
            this.formatEvent("content_block_delta", {
              type: "content_block_delta",
              index: this.contentBlockIndex,
              delta: { type: "input_json_delta", partial_json: toolCallDelta.function.arguments },
            }),
          );
        }
      }
    }
    return events;
  }

  public generateFinishEvents(
    finishReason: string | null,
    usage: { input_tokens: number; output_tokens: number },
  ): string[] {
    const events = [];
    for (let i = 0; i <= this.contentBlockIndex; i++) {
      events.push(this.formatEvent("content_block_stop", { type: "content_block_stop", index: i }));
    }
    events.push(
      this.formatEvent("message_delta", {
        type: "message_delta",
        delta: { stop_reason: finishReason, stop_sequence: null },
        usage: { output_tokens: usage.output_tokens },
      }),
    );
    events.push(
      this.formatEvent("message_stop", {
        type: "message_stop",
        "amazon-bedrock-invocationMetrics": {
          inputTokenCount: usage.input_tokens,
          outputTokenCount: usage.output_tokens,
          invocationLatency: 0,
          firstByteLatency: 0,
        },
      }),
    );
    return events;
  }
}

const claude = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

claude.use("*", async (c, next) => {
  const db = drizzle(c.env.DB, { schema: drizzleSchema });
  c.set("db", db);
  await next();
});

claude.openapi(
  createRoute({
    method: "post",
    path: "/messages",
    summary: "Claude Messages API 兼容接口",
    description: "完全兼容 Claude API 的消息接口，支持流式响应和工具使用",
    request: {
      body: {
        content: { "application/json": { schema: ClaudeRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "成功响应",
        content: {
          "application/json": { schema: { type: "object" } },
          "text/event-stream": { schema: { type: "string" } },
        },
      },
      400: { description: "请求错误" },
      401: { description: "认证失败" },
      500: { description: "服务器错误" },
    },
  }),
  async (c: any) => {
    const startTime = Date.now();
    const db = c.get("db");
    const claudeRequest = c.req.valid("json");

    const authHeader = c.req.header("authorization");
    let userApiKey = c.req.header("x-api-key") || c.req.header("anthropic-api-key");
    if (!userApiKey && authHeader && authHeader.startsWith("Bearer ")) {
      userApiKey = authHeader.substring(7);
    }
    if (!userApiKey) {
      return c.json({ error: { type: "authentication_error", message: "Missing API key." } }, 401);
    }
    const user = await db.query.users.findFirst({ where: eq(users.apiKey, userApiKey) });
    if (!user) {
      return c.json({ error: { type: "authentication_error", message: "Invalid API key" } }, 401);
    }
    const modelKeyword = claudeRequest.model;
    const mappingService = new ModelMappingService(db);
    const targetModel = await mappingService.findTargetModel(user.id, modelKeyword);
    if (targetModel === modelKeyword) {
      return c.json(
        { error: { type: "invalid_request_error", message: `No model mapping found for: ${modelKeyword}.` } },
        400,
      );
    }

    // 初始化服务
    const keyRotationService = new KeyRotationService(db, c.env.ENCRYPTION_KEY);
    const proxyService = new ProxyService(db);
    const logService = new GatewayLogService(db);

    // 尝试使用多 key 轮询
    let selectedKey = await keyRotationService.selectNextKey(user.id);
    let targetApiKey: string;
    let baseUrl: string;
    let providerKeyId: string | undefined;

    if (selectedKey) {
      // 使用多 key 系统
      targetApiKey = selectedKey.apiKey;
      baseUrl = selectedKey.baseUrl;
      providerKeyId = selectedKey.id;
      console.log(`Using provider key: ${selectedKey.keyName} (ID: ${selectedKey.id})`);
    } else {
      // 回退到用户配置的单个 key
      if (!user.encryptedProviderApiKey) {
        return c.json(
          { error: { type: "invalid_request_error", message: "User has not configured an API key" } },
          400,
        );
      }
      const defaultApiConfig = mappingService.getDefaultApiConfig();
      baseUrl = user.providerBaseUrl || defaultApiConfig.baseUrl;
      targetApiKey = await decryptApiKey(user.encryptedProviderApiKey, c.env.ENCRYPTION_KEY);
      console.log("Using legacy single key configuration");
    }

    // 检查是否需要使用代理
    let targetUrl = baseUrl.endsWith("/") ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
    if (proxyService.shouldUseProxy(baseUrl)) {
      const proxy = await proxyService.selectBestProxy("gemini");
      if (proxy) {
        targetUrl = proxyService.applyProxy(targetUrl, proxy);
        console.log(`Using proxy: ${proxy.name} -> ${targetUrl}`);
      }
    }

    const openAIRequest = convertClaudeToOpenAI(claudeRequest, targetModel);

    let res: Response;
    let requestSuccess = true;
    let errorMessage: string | undefined;

    try {
      res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${targetApiKey}`,
        },
        body: JSON.stringify(openAIRequest),
      });

      if (!res.ok) {
        requestSuccess = false;
        errorMessage = `Upstream API request failed: ${res.status} ${res.statusText}`;
        console.error(errorMessage);

        // 记录失败
        if (providerKeyId) {
          await keyRotationService.recordFailure(providerKeyId);
        }

        // 记录到网关日志
        await logService.logRequest({
          userId: user.id,
          requestModel: modelKeyword,
          targetModel: targetModel,
          latencyMs: Date.now() - startTime,
          statusCode: res.status,
          isSuccess: false,
          errorMessage: errorMessage,
          providerKeyId: providerKeyId,
          streamMode: claudeRequest.stream || false,
        });

        return c.newResponse(res.body, res.status, res.headers);
      }

      // 记录成功
      if (providerKeyId) {
        await keyRotationService.recordSuccess(providerKeyId);
      }
    } catch (error: any) {
      requestSuccess = false;
      errorMessage = error.message || "Unknown error";
      console.error("Fetch error:", error);

      // 记录失败
      if (providerKeyId) {
        await keyRotationService.recordFailure(providerKeyId);
      }

      // 记录到网关日志
      await logService.logRequest({
        userId: user.id,
        requestModel: modelKeyword,
        targetModel: targetModel,
        latencyMs: Date.now() - startTime,
        statusCode: 500,
        isSuccess: false,
        errorMessage: errorMessage,
        providerKeyId: providerKeyId,
        streamMode: claudeRequest.stream || false,
      });

      return c.json({ error: { type: "api_error", message: errorMessage } }, 500);
    }

    const inputLength = claudeRequest.messages.reduce((total: number, msg: any) => {
      if (typeof msg.content === "string") {
        return total + msg.content.length;
      }
      if (Array.isArray(msg.content)) {
        return (
          total +
          msg.content.reduce((sum: number, block: any) => {
            if (block.type === "text" && typeof block.text === "string") {
              return sum + block.text.length;
            }
            return sum;
          }, 0)
        );
      }
      return total;
    }, 0);

    if (claudeRequest.stream) {
      return handleStreamingResponse(
        c,
        res,
        claudeRequest.model,
        inputLength,
        user.username,
        startTime,
        user.id,
        targetModel,
        providerKeyId,
        logService,
      );
    } else {
      const openAIResponse: any = await res.json();
      const claudeResponse = convertOpenAIToClaude(openAIResponse, claudeRequest.model);

      // 记录到网关日志
      await logService.logRequest({
        userId: user.id,
        requestModel: modelKeyword,
        targetModel: targetModel,
        requestTokens: openAIResponse.usage?.prompt_tokens,
        responseTokens: openAIResponse.usage?.completion_tokens,
        totalTokens: openAIResponse.usage?.total_tokens,
        latencyMs: Date.now() - startTime,
        statusCode: 200,
        isSuccess: true,
        providerKeyId: providerKeyId,
        streamMode: false,
      });

      return c.json(claudeResponse);
    }
  },
);

async function handleStreamingResponse(
  c: any,
  upstreamResponse: Response,
  originalModel: string,
  inputLength: number,
  username: string,
  startTime: number,
  userId: string,
  targetModel: string,
  providerKeyId: string | undefined,
  logService: GatewayLogService,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let heartbeatInterval: number;

  const stream = new ReadableStream({
    async start(controller) {
      heartbeatInterval = setInterval(() => {
        controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));
      }, 3000);

      const converter = new ClaudeStreamConverter(originalModel);
      converter.generateInitialEvents().forEach((event) => controller.enqueue(encoder.encode(event)));

      const reader = upstreamResponse.body?.getReader();
      if (!reader) throw new Error("Unable to read response stream");

      let buffer = "";
      let usage = { input_tokens: 0, output_tokens: 0 };
      let finishReason: string | null = null;
      let totalOutputLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);
            if (chunk.usage) {
              usage = chunk.usage;
            }
            if (chunk.choices?.[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }

            const events = converter.processOpenAIChunk(chunk);
            for (const event of events) {
              controller.enqueue(encoder.encode(event));
              if (event.includes('"type":"text_delta"')) {
                try {
                  const eventData = JSON.parse(event.split("\ndata: ")[1]);
                  totalOutputLength += eventData.delta.text.length;
                } catch (e) {
                  /* ignore */
                }
              }
            }
          } catch (e) {
            console.error("Failed to parse SSE chunk:", e, "Data:", data);
          }
        }
      }

      clearInterval(heartbeatInterval);
      converter.generateFinishEvents(finishReason, usage).forEach((event) => controller.enqueue(encoder.encode(event)));

      // 记录到网关日志
      await logService.logRequest({
        userId,
        requestModel: originalModel,
        targetModel: targetModel,
        requestTokens: usage.input_tokens,
        responseTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        latencyMs: Date.now() - startTime,
        statusCode: 200,
        isSuccess: true,
        providerKeyId: providerKeyId,
        streamMode: true,
      });

      console.log(
        `📤 Stream finished | User: ${username} | Input: ${inputLength} chars | Output: ${totalOutputLength} chars | Tokens: ${usage.input_tokens + usage.output_tokens}`,
      );
      controller.close();
    },
    cancel() {
      clearInterval(heartbeatInterval);
      console.log("Stream cancelled by client.");
    },
  });

  return c.newResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export default claude;
