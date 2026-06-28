import type { LLMClient } from '@/llm/types';
import { OpenAICompatAdapter } from '@/llm/adapters/openai-compat';
import { ClaudeAdapter } from '@/llm/adapters/claude';
import { OllamaAdapter } from '@/llm/adapters/ollama';
import type { ProviderSettings } from '@/storage/schema';

/**
 * 根据用户配置的 protocol 字段，路由到对应的 adapter。
 * 这是"混合模式"的核心：上层只认 LLMClient 接口，不感知底层协议差异。
 */
export function createLLMClient(settings: ProviderSettings): LLMClient {
  switch (settings.protocol) {
    case 'openai-compat':
      return new OpenAICompatAdapter({
        providerId: settings.id,
        baseURL: settings.baseURL,
        apiKey: settings.apiKey,
        model: settings.model,
      });
    case 'claude':
      return new ClaudeAdapter({
        providerId: settings.id,
        baseURL: settings.baseURL,
        apiKey: settings.apiKey,
        model: settings.model,
      });
    case 'ollama':
      return new OllamaAdapter({
        providerId: settings.id,
        baseURL: settings.baseURL,
        model: settings.model,
      });
    default:
      throw new Error(`Unsupported protocol: ${(settings as ProviderSettings).protocol}`);
  }
}
