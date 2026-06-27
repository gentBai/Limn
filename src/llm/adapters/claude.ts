import type { LLMClient, CompleteRequest, CompleteResponse, StreamChunk, HealthStatus, TokenUsage } from '@/llm/types';
import type { ChatMessage } from '@/shared/types';
import { LLMError } from './openai-compat';
import { classifyHttpError } from '@/llm/errors';
import { ErrorCode } from '@/shared/messages';

export interface ClaudeConfig {
  providerId: string;
  baseURL: string;   // 如 https://api.anthropic.com
  apiKey: string;
  model: string;
}

interface ClaudeContent {
  type: string;
  text?: string;
}
interface ClaudeResponse {
  content?: ClaudeContent[];
  usage?: { input_tokens?: number; output_tokens?: number };
  // 流式事件
  type?: string;
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  delta?: { type: string; text?: string };
}

/** Anthropic 的 system 是独立字段，需从 messages 里抽出来 */
function splitSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const rest = messages.filter((m) => m.role !== 'system');
  return { system: systemParts.join('\n\n'), rest };
}

export class ClaudeAdapter implements LLMClient {
  readonly providerId: string;
  constructor(private cfg: ClaudeConfig) {
    this.providerId = cfg.providerId;
  }

  private headers(): HeadersInit {
    return {
      'content-type': 'application/json',
      'x-api-key': this.cfg.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/v1/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(req, false)),
      });
    } catch {
      throw new LLMError(ErrorCode.NETWORK_ERROR, '网络连接失败', true);
    }
    if (!resp.ok) throw this.httpError(resp.status);
    const data: ClaudeResponse = await resp.json();
    const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('') ?? '';
    const usage: TokenUsage | undefined = data.usage
      ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 }
      : undefined;
    return { text, usage };
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamChunk> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/v1/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(req, true)),
      });
    } catch {
      throw new LLMError(ErrorCode.NETWORK_ERROR, '网络连接失败', true);
    }
    if (!resp.ok) throw this.httpError(resp.status);
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: TokenUsage | undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const evt of events) {
        const dataLine = evt.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const jsonStr = dataLine.replace(/^data:\s*/, '').trim();
        if (!jsonStr) continue;
        const parsed: ClaudeResponse = JSON.parse(jsonStr);
        // content_block_delta 携带文本增量
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          yield { delta: parsed.delta.text, done: false };
        }
        // message_start 携带 input_tokens
        if (parsed.type === 'message_start' && parsed.message?.usage?.input_tokens !== undefined) {
          usage = { input: parsed.message.usage.input_tokens, output: parsed.message.usage.output_tokens ?? 0 };
        }
        // message_delta 携带累计 output_tokens
        if (parsed.type === 'message_delta' && parsed.usage?.output_tokens !== undefined) {
          usage = { input: usage?.input ?? 0, output: parsed.usage.output_tokens };
        }
      }
    }
    yield { delta: '', done: true, usage };
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const res = await this.complete({
        messages: [{ role: 'user', content: 'ping' }],
        options: { maxTokens: 1 },
      });
      return { ok: true, message: res.text.slice(0, 20) };
    } catch (e) {
      const err = e as LLMError;
      return { ok: false, message: err.message };
    }
  }

  private buildBody(req: CompleteRequest, stream: boolean) {
    const { system, rest } = splitSystem(req.messages);
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: rest,
      max_tokens: req.options?.maxTokens ?? 1024,
      stream,
    };
    if (system) body.system = system;
    if (req.options?.temperature !== undefined) body.temperature = req.options.temperature;
    return body;
  }

  private httpError(status: number): LLMError {
    const code = classifyHttpError(status);
    return new LLMError(
      code,
      code === ErrorCode.INVALID_API_KEY ? 'API Key 无效或已过期' : '模型服务返回错误',
      code === ErrorCode.NETWORK_ERROR || code === ErrorCode.RATE_LIMITED
    );
  }
}
