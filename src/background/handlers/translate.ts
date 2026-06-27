import { createLLMClient } from '@/llm/client-factory';
import { buildTranslatePrompt } from '@/prompts/translate';
import { getActiveProviderSettings } from '@/storage';
import { LLMError } from '@/llm/adapters/openai-compat';
import { ErrorCode, type TranslateResult } from '@/shared/messages';

export async function handleTranslate(text: string): Promise<TranslateResult> {
  const settings = await getActiveProviderSettings();
  if (!settings || !settings.apiKey) {
    throw new LLMError(ErrorCode.MISSING_API_KEY, '尚未配置 API Key', false);
  }
  const client = createLLMClient(settings);
  const res = await client.complete({ messages: buildTranslatePrompt(text) });
  return { translated: res.text };
}
