import type { ProviderSettings } from '@/storage/schema';

export function hasRequiredCredentials(settings: ProviderSettings | null): settings is ProviderSettings {
  if (!settings) return false;
  if (settings.protocol === 'ollama') return true;
  return settings.apiKey.trim().length > 0;
}
