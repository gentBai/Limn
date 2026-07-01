import { describe, expect, it } from 'vitest';
import type { ProviderSettings } from '@/storage/schema';
import { hasRequiredCredentials } from '@/llm/provider-auth';

function provider(patch: Partial<ProviderSettings>): ProviderSettings {
  return {
    id: 'p',
    label: 'Provider',
    protocol: 'openai-compat',
    baseURL: 'https://api.example.com/v1',
    apiKey: '',
    model: 'model',
    isCustom: false,
    ...patch,
  };
}

describe('hasRequiredCredentials', () => {
  it('requires apiKey for remote providers', () => {
    expect(hasRequiredCredentials(provider({ protocol: 'openai-compat', apiKey: '' }))).toBe(false);
    expect(hasRequiredCredentials(provider({ protocol: 'claude', apiKey: '' }))).toBe(false);
    expect(hasRequiredCredentials(provider({ protocol: 'openai-compat', apiKey: 'sk-test' }))).toBe(true);
  });

  it('does not require apiKey for Ollama', () => {
    expect(hasRequiredCredentials(provider({ protocol: 'ollama', apiKey: '' }))).toBe(true);
  });
});
