import type { LLMProtocol } from '@/llm/types';

/** 单个 provider 的用户配置 */
export interface ProviderSettings {
  /** 唯一 id（内置 provider 用厂商名，自定义用 uuid） */
  id: string;
  /** 显示名称 */
  label: string;
  /** 接口协议：决定走哪个 adapter */
  protocol: LLMProtocol;
  /** 接口地址（baseURL），如 https://api.deepseek.com/v1 */
  baseURL: string;
  /** API Key（Ollama 不需要） */
  apiKey: string;
  /** 模型名，如 deepseek-chat、gpt-4o-mini */
  model: string;
  /** 是否用户自定义（内置模板为 false） */
  isCustom: boolean;
}

export interface Settings {
  /** 当前启用的 provider id */
  activeProviderId: string;
  /** 所有已配置的 provider（按 id 索引） */
  providers: Record<string, ProviderSettings>;
  translateTargetLang: string;
  summaryStyle: 'concise' | 'standard' | 'detailed';
}

export interface StorageSchema {
  settings: Settings;
}
