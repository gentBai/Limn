import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAdapter } from '@/llm/adapters/claude';
import { ErrorCode } from '@/shared/messages';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ClaudeAdapter', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('complete extracts system from messages and parses content blocks', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      mockResponse({
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'World' },
        ],
      })
    );
    const adapter = new ClaudeAdapter({
      providerId: 'claude', baseURL: 'https://api.anthropic.com',
      apiKey: 'sk-test', model: 'claude-3-5-sonnet-20241022',
    });
    const res = await adapter.complete({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'hi' },
      ],
    });
    expect(res.text).toBe('Hello World');
    // 验证 system 被抽到顶层，messages 只剩 user
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('throws classified error on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse({ error: 'bad key' }, 401));
    const adapter = new ClaudeAdapter({
      providerId: 'claude', baseURL: 'https://api.anthropic.com',
      apiKey: 'bad', model: 'claude-3-5-sonnet-20241022',
    });
    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
  });

  it('stream yields deltas from content_block_delta events', async () => {
    // Anthropic SSE 格式：event: xxx\ndata: {...}\n\n
    const sseEvents = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        sseEvents.forEach((c) => controller.enqueue(new TextEncoder().encode(c)));
        controller.close();
      },
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(stream));
    const adapter = new ClaudeAdapter({
      providerId: 'claude', baseURL: 'https://api.anthropic.com',
      apiKey: 'sk-test', model: 'claude-3-5-sonnet-20241022',
    });
    const out: string[] = [];
    for await (const chunk of adapter.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (chunk.delta) out.push(chunk.delta);
    }
    expect(out.join('')).toBe('Hello');
  });
});
