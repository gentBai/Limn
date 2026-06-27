import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaAdapter } from '@/llm/adapters/ollama';
import { ErrorCode } from '@/shared/messages';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OllamaAdapter', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('complete parses message content', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockResponse({ message: { role: 'assistant', content: '你好' }, done: true })
    );
    const adapter = new OllamaAdapter({
      providerId: 'ollama', baseURL: 'http://localhost:11434', model: 'llama3',
    });
    const res = await adapter.complete({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.text).toBe('你好');
    // 验证无需 auth header
    const init = vi.spyOn(global, 'fetch').mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('network failure maps to OLLAMA_NOT_RUNNING', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const adapter = new OllamaAdapter({
      providerId: 'ollama', baseURL: 'http://localhost:11434', model: 'llama3',
    });
    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toMatchObject({ code: ErrorCode.OLLAMA_NOT_RUNNING });
  });

  it('stream yields deltas from NDJSON lines', async () => {
    // Ollama 流式是 NDJSON：每行一个 JSON
    const ndjson = [
      '{"message":{"role":"assistant","content":"Hel"},"done":false}',
      '{"message":{"role":"assistant","content":"lo"},"done":false}',
      '{"message":{"role":"assistant","content":""},"done":true}',
    ].join('\n');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ndjson));
        controller.close();
      },
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(stream));
    const adapter = new OllamaAdapter({
      providerId: 'ollama', baseURL: 'http://localhost:11434', model: 'llama3',
    });
    const out: string[] = [];
    for await (const chunk of adapter.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (chunk.delta) out.push(chunk.delta);
    }
    expect(out.join('')).toBe('Hello');
  });
});
