import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock chrome.tabs.sendMessage with controllable failure sequence
const sendMessage = vi.fn();
const chrome = { tabs: { sendMessage } };
vi.stubGlobal('chrome', chrome);

const { sendToTabWithRetry } = await import('@/background/tab-messaging');

describe('sendToTabWithRetry', () => {
  beforeEach(() => {
    sendMessage.mockReset();
    // Silence retry backoff delays (real timers; values are tiny).
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return 0 as any;
    });
  });

  it('returns the response on first success without retrying', async () => {
    sendMessage.mockResolvedValueOnce({ text: 'ok' });
    const res = await sendToTabWithRetry(1, { type: 'EXTRACT_CONTENT' });
    expect(res).toEqual({ text: 'ok' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('retries when the content script is not ready yet ("Receiving end does not exist")', async () => {
    const transient = new Error('Receiving end does not exist');
    sendMessage
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce({ text: 'finally' });

    const res = await sendToTabWithRetry(1, { type: 'EXTRACT_CONTENT' }, 3);
    expect(res).toEqual({ text: 'finally' });
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on non-transient errors', async () => {
    sendMessage.mockRejectedValueOnce(new Error('Frame not found'));
    await expect(sendToTabWithRetry(1, { type: 'EXTRACT_CONTENT' })).rejects.toThrow('Frame not found');
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('gives up after the max attempts and rethrows the last transient error', async () => {
    const transient = new Error('Receiving end does not exist');
    sendMessage
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient);

    await expect(sendToTabWithRetry(1, { type: 'EXTRACT_CONTENT' }, 3)).rejects.toThrow('Receiving end does not exist');
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });
});
