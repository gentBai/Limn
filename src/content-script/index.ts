import { setupExtractorListener } from './extractor-runner';
import { AskBubble } from './selection-bubble/Bubble';
import { initLocale, t } from '@/i18n';

setupExtractorListener();

// Initialize locale (read user override or browser language), then set up the bubble
initLocale().then(() => {
  // Ask-AI bubble: initiates streaming interpretation via port, fills token-by-token
  new AskBubble(
    async (text, onDelta) => {
      const port = chrome.runtime.connect({ name: `chat:selection:${text}` });
      return new Promise<string>((resolve, reject) => {
        let full = '';
        port.onMessage.addListener((chunk) => {
          if (chunk.kind === 'userAdded') {
            // user message added to the conversation stream
          } else if (chunk.kind === 'streaming') {
            full += chunk.delta;
            onDelta?.(full);
          } else if (chunk.kind === 'done') {
            resolve(chunk.message?.content || full);
            port.disconnect();
          } else if (chunk.kind === 'error') {
            reject(new Error(chunk.error?.message ?? t('bubble.failed')));
            port.disconnect();
          }
        });
        port.onDisconnect.addListener(() => {
          if (full) resolve(full);
          else reject(new Error('Connection closed'));
        });
      });
    }
  );
  console.log('[AI Reader] content-script loaded');
});
