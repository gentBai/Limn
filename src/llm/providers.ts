import type { LLMProtocol } from '@/llm/types';

/**
 * Built-in provider templates.
 * These are "one-click fill" presets: protocol + endpoint + default model are filled in,
 * users can freely modify any field, or fully customize a new provider.
 *
 * label and hint are i18n keys (resolved via t() at display time).
 */
export interface ProviderTemplate {
  id: string;
  /** i18n key for display label, e.g. 'provider.deepseek' */
  labelKey: string;
  protocol: LLMProtocol;
  baseURL: string;
  defaultModel: string;
  /** Whether an API key is required (Ollama local does not) */
  requiresApiKey: boolean;
  /** i18n key for hint, e.g. 'provider.deepseek.hint' */
  hintKey?: string;
}

export const BUILTIN_PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'openai',
    labelKey: 'provider.openai',
    protocol: 'openai-compat',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    hintKey: 'provider.openai.hint',
  },
  {
    id: 'deepseek',
    labelKey: 'provider.deepseek',
    protocol: 'openai-compat',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
    hintKey: 'provider.deepseek.hint',
  },
  {
    id: 'zhipu',
    labelKey: 'provider.zhipu',
    protocol: 'openai-compat',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    requiresApiKey: true,
    hintKey: 'provider.zhipu.hint',
  },
  {
    id: 'claude',
    labelKey: 'provider.claude',
    protocol: 'claude',
    baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    requiresApiKey: true,
    hintKey: 'provider.claude.hint',
  },
  {
    id: 'ollama',
    labelKey: 'provider.ollama',
    protocol: 'ollama',
    baseURL: 'http://localhost:11434',
    defaultModel: 'llama3',
    requiresApiKey: false,
    hintKey: 'provider.ollama.hint',
  },
];

/** Protocol options for the dropdown selection */
export const PROTOCOL_OPTIONS: { value: LLMProtocol; labelKey: string; descKey: string }[] = [
  { value: 'openai-compat', labelKey: 'protocol.openai-compat', descKey: 'protocol.openai-compat.desc' },
  { value: 'claude', labelKey: 'protocol.claude', descKey: 'protocol.claude.desc' },
  { value: 'ollama', labelKey: 'protocol.ollama', descKey: 'protocol.ollama.desc' },
];

export function findTemplate(id: string): ProviderTemplate | undefined {
  return BUILTIN_PROVIDER_TEMPLATES.find((p) => p.id === id);
}
