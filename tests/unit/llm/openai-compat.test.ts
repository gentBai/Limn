import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAICompatAdapter } from '@/llm/adapters/openai-compat';
import { ErrorCode } from '@/shared/messages';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenAICompatAdapter', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('complete sends correct body and returns text', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      mockResponse({ choices: [{ message: { content: 'hello' } }] })
    );
    const adapter = new OpenAICompatAdapter({
      providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test', model: 'deepseek-chat',
    });
    const res = await adapter.complete({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.text).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.deepseek.com/v1/chat/completions');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('deepseek-chat');
    expect(body.stream).toBe(false);
  });

  it('throws classified error on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse({ error: 'bad key' }, 401));
    const adapter = new OpenAICompatAdapter({
      providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'bad', model: 'deepseek-chat',
    });
    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
  });

  it('stream yields deltas then done', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        sseChunks.forEach((c) => controller.enqueue(new TextEncoder().encode(c)));
        controller.close();
      },
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(stream));
    const adapter = new OpenAICompatAdapter({
      providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test', model: 'deepseek-chat',
    });
    const out: string[] = [];
    for await (const chunk of adapter.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (chunk.delta) out.push(chunk.delta);
    }
    expect(out.join('')).toBe('Hello');
  });
});
