import { extractPageContent } from '@/extractor';

/**
 * 监听来自 background 的抽取请求。
 * 注意：sendResponse 必须在异步上下文中正确调用，
 * 且 listener 必须返回 true 才能保持消息通道开启。
 */
export function setupExtractorListener() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'EXTRACT_CONTENT') {
      // Use setTimeout(0) to run in an async context, avoiding sync sendResponse race
      setTimeout(() => {
        try {
          const content = extractPageContent(document, location.href);
          sendResponse(content);
        } catch (e) {
          console.error('[Limn] extract failed:', e);
          sendResponse({ error: String(e) });
        }
      }, 0);
      return true; // keep channel open for async sendResponse
    }
  });
}
