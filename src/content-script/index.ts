import { setupExtractorListener } from './extractor-runner';
import { TranslateBubble } from './selection-bubble/Bubble';
import { initLocale, t } from '@/i18n';

setupExtractorListener();

// Initialize locale (read user override or browser language), then set up the bubble
initLocale().then(() => {
  // Hover translate bubble: initiates streaming translation via port, fills token-by-token
  new TranslateBubble(
    async (text, onDelta) => {
      const port = chrome.runtime.connect({ name: `translate:${text}` });
      return new Promise<string>((resolve, reject) => {
        let full = '';
        port.onMessage.addListener((chunk) => {
          if (chunk.kind === 'created') {
            // empty record created, bubble can show loading state
          } else if (chunk.kind === 'streaming') {
            full += chunk.delta;
            onDelta?.(full);
          } else if (chunk.kind === 'done') {
            resolve(chunk.record.target || full);
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
