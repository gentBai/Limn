import type { LLMClient, CompleteRequest, CompleteResponse, StreamChunk, HealthStatus, TokenUsage } from '@/llm/types';
import { classifyHttpError } from '@/llm/errors';
import { ErrorCode, type ErrorResponse } from '@/shared/messages';

export class LLMError extends Error {
  constructor(public code: ErrorCode, message: string, public retryable: boolean) {
    super(message);
    this.name = 'LLMError';
  }
  toResponse(): ErrorResponse {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

export interface OpenAICompatConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

interface OpenAIChoice {
  delta?: { content?: string };
  message?: { content?: string };
}
interface OpenAIChunk {
  choices?: OpenAIChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function parseUsage(u?: { prompt_tokens?: number; completion_tokens?: number }): TokenUsage | undefined {
  if (!u) return undefined;
  return { input: u.prompt_tokens ?? 0, output: u.completion_tokens ?? 0 };
}

export class OpenAICompatAdapter implements LLMClient {
  readonly providerId: string;
  constructor(private cfg: OpenAICompatConfig) {
    this.providerId = cfg.providerId;
  }

  private headers(): HeadersInit {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.cfg.apiKey}`,
    };
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(req, false)),
      });
    } catch {
      throw new LLMError(ErrorCode.NETWORK_ERROR, 'Network error', true);
    }
    if (!resp.ok) throw this.httpError(resp.status);
    const data: OpenAIChunk & { choices: OpenAIChoice[] } = await resp.json();
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: parseUsage(data.usage),
    };
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamChunk> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(req, true)),
      });
    } catch {
      throw new LLMError(ErrorCode.NETWORK_ERROR, 'Network error', true);
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
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.replace(/^data:\s*/, '').trim();
        if (!trimmed || trimmed === '[DONE]') continue;
        const parsed: OpenAIChunk = JSON.parse(trimmed);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield { delta, done: false };
        // streaming usage is usually in the last chunk (choices empty, usage only)
        if (parsed.usage) usage = parseUsage(parsed.usage);
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
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: req.messages,
      stream,
    };
    if (req.options?.temperature !== undefined) body.temperature = req.options.temperature;
    if (req.options?.maxTokens !== undefined) body.max_tokens = req.options.maxTokens;
    // request streaming usage (supported by OpenAI and most compatible vendors)
    if (stream) body.stream_options = { include_usage: true };
    return body;
  }

  private httpError(status: number): LLMError {
    const code = classifyHttpError(status);
    return new LLMError(
      code,
      code === ErrorCode.INVALID_API_KEY ? 'Invalid API key' : 'Model service error',
      code === ErrorCode.NETWORK_ERROR || code === ErrorCode.RATE_LIMITED
    );
  }
}
