import { setupExtractorListener } from './extractor-runner';
import { TranslateBubble } from './selection-bubble/Bubble';

setupExtractorListener();

// 划词翻译气泡：通过 port 发起流式翻译，译文逐字填充
new TranslateBubble(async (text, onDelta) => {
  const port = chrome.runtime.connect({ name: `translate:${text}` });
  return new Promise<string>((resolve, reject) => {
    let full = '';
    port.onMessage.addListener((chunk) => {
      if (chunk.kind === 'created') {
        // 空记录已建，气泡可显示加载态
      } else if (chunk.kind === 'streaming') {
        full += chunk.delta;
        onDelta?.(full); // 通知气泡逐字更新
      } else if (chunk.kind === 'done') {
        resolve(chunk.record.target || full);
        port.disconnect();
      } else if (chunk.kind === 'error') {
        reject(new Error(chunk.error?.message ?? '翻译失败'));
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      // 若未 resolve/reject 则视为中断
      if (full) resolve(full);
      else reject(new Error('连接已断开'));
    });
  });
});

console.log('[AI Reader] content-script loaded');
