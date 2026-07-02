/** Backoff delays (ms) between retries. */
const RETRY_DELAYS = [300, 600, 1200];

/** Send a message to a content script, retrying when the receiving end is not
 *  ready yet. @crxjs injects content scripts via a dynamic-import loader, so the
 *  message listener is registered only after the chunk loads — on slow pages the
 *  first EXTRACT_CONTENT can race the import and fail with "Receiving end does
 *  not exist." Backing off a few times covers that window. */
export async function sendToTabWithRetry<T>(
  tabId: number,
  message: unknown,
  attempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (e: any) {
      lastError = e;
      const transient = typeof e?.message === 'string' && e.message.includes('Receiving end does not exist');
      if (!transient || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[i] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]));
    }
  }
  throw lastError;
}
