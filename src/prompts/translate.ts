import type { ChatMessage } from '@/shared/types';
import type { Locale } from '@/i18n';

/**
 * Build translation prompt.
 * Source language is auto-detected by the model; target language follows UI locale.
 */
export function buildTranslatePrompt(text: string, locale: Locale): ChatMessage[] {
  const targetLang = locale === 'en' ? 'English' : 'Simplified Chinese';
  return [
    {
      role: 'system',
      content:
        `You are a professional translator. Translate the user-provided text into ${targetLang}. ` +
        'Requirements: preserve code blocks, lists, and proper noun formatting; use accurate terminology; ' +
        'output only the translation without explanation.',
    },
    { role: 'user', content: text },
  ];
}
