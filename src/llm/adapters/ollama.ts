import type { LLMClient, CompleteRequest, CompleteResponse, StreamChunk, HealthStatus, TokenUsage } from '@/llm/types';
import { LLMError } from './openai-compat';
import { ErrorCode } from '@/shared/messages';

export interface OllamaConfig {
  providerId: string;
  baseURL: string;   // 如 http://localhost:11434
  model: string;
}

interface OllamaResponse {
  message?: { role: string; content: string };
  done?: boolean;
  // Ollama 在 done=true 的最后一个响应里携带 token 统计
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaAdapter implements LLMClient {
  readonly providerId: string;
  constructor(private cfg: OllamaConfig) {
    this.providerId = cfg.providerId;
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildBody(req, false)),
      });
    } catch {
      throw new LLMError(ErrorCode.OLLAMA_NOT_RUNNING, '本地模型服务未运行，请检查 Ollama 是否已启动', true);
    }
    if (!resp.ok) throw new LLMError(ErrorCode.MODEL_ERROR, `Ollama 返回错误 ${resp.status}`, false);
    const data: OllamaResponse = await resp.json();
    const usage: TokenUsage | undefined = data.prompt_eval_count !== undefined || data.eval_count !== undefined
      ? { input: data.prompt_eval_count ?? 0, output: data.eval_count ?? 0 }
      : undefined;
    return { text: data.message?.content ?? '', usage };
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamChunk> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildBody(req, true)),
      });
    } catch {
      throw new LLMError(ErrorCode.OLLAMA_NOT_RUNNING, '本地模型服务未运行，请检查 Ollama 是否已启动', true);
    }
    if (!resp.ok) throw new LLMError(ErrorCode.MODEL_ERROR, `Ollama 返回错误 ${resp.status}`, false);
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: TokenUsage | undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parsed: OllamaResponse = JSON.parse(trimmed);
        const delta = parsed.message?.content;
        if (delta) yield { delta, done: false };
        // done=true 的最后行携带 token 统计
        if (parsed.done && (parsed.prompt_eval_count !== undefined || parsed.eval_count !== undefined)) {
          usage = { input: parsed.prompt_eval_count ?? 0, output: parsed.eval_count ?? 0 };
        }
      }
    }
    yield { delta: '', done: true, usage };
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const resp = await fetch(`${this.cfg.baseURL}/api/tags`);
      if (!resp.ok) return { ok: false, message: `状态码 ${resp.status}` };
      return { ok: true, message: 'Ollama 服务正常' };
    } catch {
      return { ok: false, message: 'Ollama 未运行' };
    }
  }

  private buildBody(req: CompleteRequest, stream: boolean) {
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: req.messages,
      stream,
    };
    if (req.options?.temperature !== undefined) body.options = { temperature: req.options.temperature };
    return body;
  }
}
