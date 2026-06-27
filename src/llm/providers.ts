import type { LLMProtocol } from '@/llm/types';

/**
 * 内置 provider 模板。
 * 这些是"一键填充"用的预设，用户点击后自动填好协议+地址+默认模型，
 * 用户仍可自由修改任意字段，也可完全自定义新建 provider。
 */
export interface ProviderTemplate {
  id: string;
  label: string;
  protocol: LLMProtocol;
  baseURL: string;
  defaultModel: string;
  /** 是否需要 API Key（Ollama 本地无需） */
  requiresApiKey: boolean;
  /** 协议的可读说明，给用户参考 */
  hint?: string;
}

export const BUILTIN_PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai-compat',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    hint: 'OpenAI 官方 API',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai-compat',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
    hint: '性价比高，兼容 OpenAI 协议',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    protocol: 'openai-compat',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    requiresApiKey: true,
    hint: '国产，兼容 OpenAI 协议',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    protocol: 'claude',
    baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    requiresApiKey: true,
    hint: 'Anthropic 官方 Messages API',
  },
  {
    id: 'ollama',
    label: 'Ollama (本地)',
    protocol: 'ollama',
    baseURL: 'http://localhost:11434',
    defaultModel: 'llama3',
    requiresApiKey: false,
    hint: '本地模型，数据不出本机',
  },
];

/** 协议选项，供 UI 下拉选择 */
export const PROTOCOL_OPTIONS: { value: LLMProtocol; label: string; desc: string }[] = [
  { value: 'openai-compat', label: 'OpenAI 兼容', desc: 'OpenAI / DeepSeek / 智谱 / 通义 / Kimi 等' },
  { value: 'claude', label: 'Anthropic Claude', desc: 'Claude 官方 Messages API' },
  { value: 'ollama', label: 'Ollama', desc: '本地模型（localhost）' },
];

export function findTemplate(id: string): ProviderTemplate | undefined {
  return BUILTIN_PROVIDER_TEMPLATES.find((p) => p.id === id);
}
