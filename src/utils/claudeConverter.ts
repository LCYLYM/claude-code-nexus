/**
 * Claude API 与 OpenAI API 格式转换工具
 * 实现需求文档中定义的所有转换规则
 */

import type {
  ClaudeRequestSchema,
  ClaudeResponseSchema,
  OpenAIRequestSchema,
  ClaudeContentSchema,
  OpenAIMessageSchema,
} from "@common/validators/claude.schema";
import { z } from "zod";

// 类型推断
type ClaudeRequest = z.infer<typeof ClaudeRequestSchema>;
type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;
type OpenAIRequest = z.infer<typeof OpenAIRequestSchema>;
type ClaudeContent = z.infer<typeof ClaudeContentSchema>;
type OpenAIMessage = z.infer<typeof OpenAIMessageSchema>;

/**
 * 将 Claude API 请求转换为 OpenAI API 请求
 */
export function convertClaudeToOpenAI(claudeRequest: ClaudeRequest, targetModel: string): OpenAIRequest {
  const openAIRequest: OpenAIRequest = {
    model: targetModel,
    messages: [],
    max_tokens: claudeRequest.max_tokens,
    temperature: claudeRequest.temperature,
    top_p: claudeRequest.top_p,
    stream: claudeRequest.stream,
  };

  // 处理 system prompt
  if (claudeRequest.system) {
    openAIRequest.messages.push({
      role: "system",
      content: claudeRequest.system,
    });
  }

  // 转换 messages
  for (const message of claudeRequest.messages) {
    const convertedMessage = convertClaudeMessage(message);
    if (Array.isArray(convertedMessage)) {
      openAIRequest.messages.push(...convertedMessage);
    } else {
      openAIRequest.messages.push(convertedMessage);
    }
  }

  // 转换 tools
  if (claudeRequest.tools) {
    openAIRequest.tools = claudeRequest.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  // 转换 tool_choice
  if (claudeRequest.tool_choice) {
    if (claudeRequest.tool_choice.type === "auto") {
      openAIRequest.tool_choice = "auto";
    } else if (claudeRequest.tool_choice.type === "any") {
      openAIRequest.tool_choice = "required";
    } else if (claudeRequest.tool_choice.type === "tool") {
      openAIRequest.tool_choice = {
        type: "function",
        function: { name: (claudeRequest.tool_choice as any).name },
      } as any;
    }
  }

  // 处理 stop_sequences
  if (claudeRequest.stop_sequences && claudeRequest.stop_sequences.length > 0) {
    openAIRequest.stop = claudeRequest.stop_sequences;
  }

  return openAIRequest;
}

/**
 * 转换单个 Claude 消息
 */
function convertClaudeMessage(message: ClaudeRequest["messages"][0]): OpenAIMessage | OpenAIMessage[] {
  if (typeof message.content === "string") {
    return {
      role: message.role === "user" ? "user" : "assistant",
      content: message.content,
    };
  }

  // 处理复杂内容数组
  if (message.role === "user") {
    return convertUserMessage(message.content);
  } else {
    return convertAssistantMessage(message.content);
  }
}

/**
 * 转换用户消息
 */
function convertUserMessage(content: ClaudeContent[]): OpenAIMessage | OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];
  const regularContent: any[] = [];

  for (const item of content) {
    if (item.type === "text") {
      regularContent.push({ type: "text", text: item.text });
    } else if (item.type === "image") {
      regularContent.push({
        type: "image_url",
        image_url: {
          url: `data:${item.source.media_type};base64,${item.source.data}`,
        },
      });
    } else if (item.type === "tool_result") {
      // tool_result 需要作为单独的消息
      messages.push({
        role: "tool",
        tool_call_id: item.tool_use_id,
        content: typeof item.content === "string" ? item.content : JSON.stringify(item.content),
      });
    }
  }

  if (regularContent.length > 0) {
    messages.unshift({
      role: "user",
      content:
        regularContent.length === 1 && regularContent[0].type === "text" ? regularContent[0].text : regularContent,
    });
  }

  return messages.length === 1 ? messages[0] : messages;
}

/**
 * 转换助手消息
 */
function convertAssistantMessage(content: ClaudeContent[]): OpenAIMessage {
  const textParts: string[] = [];
  const toolCalls: any[] = [];

  for (const item of content) {
    if (item.type === "text") {
      textParts.push(item.text);
    } else if (item.type === "tool_use") {
      toolCalls.push({
        id: item.id,
        type: "function",
        function: {
          name: item.name,
          arguments: JSON.stringify(item.input),
        },
      });
    }
  }

  const message: OpenAIMessage = {
    role: "assistant",
    content: textParts.length > 0 ? textParts.join("\n") : null,
  };

  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return message;
}

/**
 * 将 OpenAI API 响应转换为 Claude API 响应
 */
export function convertOpenAIToClaude(openAIResponse: any, originalModel: string): ClaudeResponse {
  const choice = openAIResponse.choices[0];
  const content: ClaudeContent[] = [];

  // 处理文本内容
  if (choice.message.content) {
    content.push({
      type: "text",
      text: choice.message.content,
    });
  }

  // 处理工具调用
  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      content.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments || "{}"),
      });
    }
  }

  // 转换停止原因
  let stopReason: ClaudeResponse["stop_reason"] = null;
  switch (choice.finish_reason) {
    case "stop":
      stopReason = "end_turn";
      break;
    case "length":
      stopReason = "max_tokens";
      break;
    case "tool_calls":
      stopReason = "tool_use";
      break;
    case "content_filter":
      stopReason = "end_turn";
      break;
    default:
      stopReason = "end_turn";
  }

  return {
    id: openAIResponse.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    model: originalModel,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openAIResponse.usage?.prompt_tokens || 0,
      output_tokens: openAIResponse.usage?.completion_tokens || 0,
    },
  };
}

/**
 * 流式响应转换状态管理器
 */
export class StreamConverter {
  private messageId: string;
  private originalModel: string;
  private contentBlocks: Array<{ type: string; index: number; started: boolean; content?: any }> = [];
  private currentToolArgs: { [key: string]: string } = {};
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(messageId?: string, originalModel = "claude-3-5-sonnet-20240620") {
    this.messageId = messageId || `msg_${Date.now()}`;
    this.originalModel = originalModel;
  }

  /**
   * 生成初始事件
   */
  generateInitialEvents(): string[] {
    const events: string[] = [];

    // 1. ping 事件
    events.push(this.formatSSEEvent("ping", { type: "ping" }));

    // 2. message_start 事件
    events.push(
      this.formatSSEEvent("message_start", {
        type: "message_start",
        message: {
          id: this.messageId,
          type: "message",
          role: "assistant",
          content: [],
          model: this.originalModel,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }),
    );

    return events;
  }

  /**
   * 处理 OpenAI 流式数据块
   */
  processOpenAIChunk(chunk: any): string[] {
    const events: string[] = [];
    const delta = chunk.choices?.[0]?.delta;

    if (!delta) return events;

    // 处理文本内容
    if (delta.content) {
      const textBlockIndex = this.getOrCreateTextBlock();
      events.push(...this.handleTextDelta(textBlockIndex, delta.content));
    }

    // 处理工具调用
    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const blockIndex = this.getOrCreateToolBlock(toolCall.index || 0, toolCall);
        events.push(...this.handleToolDelta(blockIndex, toolCall));
      }
    }

    // 处理使用情况统计
    if (chunk.usage) {
      this.totalInputTokens = chunk.usage.prompt_tokens || 0;
      this.totalOutputTokens = chunk.usage.completion_tokens || 0;
    }

    return events;
  }

  /**
   * 生成结束事件
   */
  generateFinishEvents(finishReason?: string): string[] {
    const events: string[] = [];

    // 为所有开始的内容块生成 stop 事件
    for (const block of this.contentBlocks) {
      if (block.started) {
        events.push(
          this.formatSSEEvent("content_block_stop", {
            type: "content_block_stop",
            index: block.index,
          }),
        );
      }
    }

    // 转换停止原因
    let claudeStopReason: string;
    switch (finishReason) {
      case "stop":
        claudeStopReason = "end_turn";
        break;
      case "length":
        claudeStopReason = "max_tokens";
        break;
      case "tool_calls":
        claudeStopReason = "tool_use";
        break;
      default:
        claudeStopReason = "end_turn";
    }

    // message_delta 事件
    events.push(
      this.formatSSEEvent("message_delta", {
        type: "message_delta",
        delta: { stop_reason: claudeStopReason },
        usage: { output_tokens: this.totalOutputTokens },
      }),
    );

    // message_stop 事件
    events.push(this.formatSSEEvent("message_stop", { type: "message_stop" }));

    return events;
  }

  private getOrCreateTextBlock(): number {
    let textBlock = this.contentBlocks.find((b) => b.type === "text");
    if (!textBlock) {
      textBlock = {
        type: "text",
        index: 0,
        started: false,
      };
      this.contentBlocks.push(textBlock);
    }
    return textBlock.index;
  }

  private getOrCreateToolBlock(toolIndex: number, toolCall: any): number {
    const blockIndex = this.contentBlocks.filter((b) => b.type === "text").length + toolIndex;
    let toolBlock = this.contentBlocks.find((b) => b.index === blockIndex);

    if (!toolBlock) {
      toolBlock = {
        type: "tool_use",
        index: blockIndex,
        started: false,
        content: {
          id: toolCall.id,
          name: toolCall.function?.name,
        },
      };
      this.contentBlocks.push(toolBlock);
    }

    return blockIndex;
  }

  private handleTextDelta(blockIndex: number, text: string): string[] {
    const events: string[] = [];
    const block = this.contentBlocks.find((b) => b.index === blockIndex);

    if (!block?.started) {
      // 首次文本内容，发送 content_block_start
      events.push(
        this.formatSSEEvent("content_block_start", {
          type: "content_block_start",
          index: blockIndex,
          content_block: { type: "text", text: "" },
        }),
      );
      if (block) block.started = true;
    }

    // 发送文本增量
    events.push(
      this.formatSSEEvent("content_block_delta", {
        type: "content_block_delta",
        index: blockIndex,
        delta: { type: "text_delta", text },
      }),
    );

    return events;
  }

  private handleToolDelta(blockIndex: number, toolCall: any): string[] {
    const events: string[] = [];
    const block = this.contentBlocks.find((b) => b.index === blockIndex);

    if (!block?.started && toolCall.function?.name) {
      // 首次工具调用，发送 content_block_start
      events.push(
        this.formatSSEEvent("content_block_start", {
          type: "content_block_start",
          index: blockIndex,
          content_block: {
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: {},
          },
        }),
      );
      if (block) block.started = true;
    }

    // 处理参数增量
    if (toolCall.function?.arguments) {
      events.push(
        this.formatSSEEvent("content_block_delta", {
          type: "content_block_delta",
          index: blockIndex,
          delta: { type: "input_json_delta", partial_json: toolCall.function.arguments },
        }),
      );
    }

    return events;
  }

  private formatSSEEvent(event: string, data: any): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }
}
