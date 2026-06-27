import { extractPageContent } from '@/extractor';

/**
 * 监听来自 background 的抽取请求。
 * 注意：sendResponse 必须在异步上下文中正确调用，
 * 且 listener 必须返回 true 才能保持消息通道开启。
 */
export function setupExtractorListener() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'EXTRACT_CONTENT') {
      // 用 setTimeout(0) 确保在异步上下文中执行，避免同步 sendResponse 的竞态
      setTimeout(() => {
        try {
          const content = extractPageContent(document, location.href);
          sendResponse(content);
        } catch (e) {
          console.error('[Limn] extract failed:', e);
          sendResponse({ error: String(e) });
        }
      }, 0);
      return true; // 保持通道开启，等异步 sendResponse
    }
  });
}
