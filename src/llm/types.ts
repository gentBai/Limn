import type { ChatMessage } from '@/shared/types';

/** 支持的接口协议类型。决定 client-factory 路由到哪个 adapter */
export type LLMProtocol = 'openai-compat' | 'claude' | 'ollama';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface CompleteRequest {
  messages: ChatMessage[];
  options?: LLMOptions;
}

export interface CompleteResponse {
  text: string;
  /** token 用量（可选，部分协议/场景才返回） */
  usage?: TokenUsage;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  /** token 用量，通常只在 done=true 的最后一个 chunk 携带 */
  usage?: TokenUsage;
}

export interface HealthStatus {
  ok: boolean;
  message?: string;
}

export interface LLMClient {
  readonly providerId: string;
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  stream(req: CompleteRequest): AsyncIterable<StreamChunk>;
  healthCheck(): Promise<HealthStatus>;
}
