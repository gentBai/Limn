import { describe, expect, it } from 'vitest';
import type { Settings } from '@/storage/schema';
import { BUILTIN_PROVIDER_TEMPLATES } from '@/llm/providers';
import { upsertTemplateProvider } from '@/options/provider-templates';

const baseSettings: Settings = {
  activeProviderId: 'deepseek',
  providers: {
    deepseek: {
      id: 'deepseek',
      label: 'DeepSeek',
      protocol: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-keep',
      model: 'deepseek-chat',
      isCustom: false,
    },
  },
  translateTargetLang: 'zh',
  summaryStyle: 'standard',
  uiLanguage: 'zh',
};

describe('upsertTemplateProvider', () => {
  it('adds a missing template and activates it', () => {
    const openai = BUILTIN_PROVIDER_TEMPLATES.find((p) => p.id === 'openai')!;
    const next = upsertTemplateProvider(baseSettings, openai, 'OpenAI');
    expect(next.activeProviderId).toBe('openai');
    expect(next.providers.openai).toMatchObject({
      id: 'openai',
      label: 'OpenAI',
      protocol: 'openai-compat',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: '',
      isCustom: false,
    });
  });

  it('activates an existing template without overwriting user configuration', () => {
    const deepseek = BUILTIN_PROVIDER_TEMPLATES.find((p) => p.id === 'deepseek')!;
    const next = upsertTemplateProvider(baseSettings, deepseek, 'DeepSeek');
    expect(next.activeProviderId).toBe('deepseek');
    expect(next.providers.deepseek.apiKey).toBe('sk-keep');
  });
});
