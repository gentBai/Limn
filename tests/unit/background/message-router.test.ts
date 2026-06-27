import { describe, it, expect, vi } from 'vitest';
import { routeMessage } from '@/background/message-router';

describe('routeMessage', () => {
  it('returns SUCCESS wrapper around handler result', async () => {
    const handlers = { TEST: vi.fn().mockResolvedValue({ ok: true }) };
    const res = await routeMessage(handlers as any, { type: 'TEST' } as any);
    expect(res).toEqual({ type: 'SUCCESS', data: { ok: true } });
  });

  it('wraps thrown LLMError into ERROR', async () => {
    const handlers = {
      TEST: vi.fn().mockRejectedValue({ toResponse: () => ({ code: 'INVALID_API_KEY', message: 'bad', retryable: false }) }),
    };
    const res = await routeMessage(handlers as any, { type: 'TEST' } as any);
    expect(res.type).toBe('ERROR');
  });
});
