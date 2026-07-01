import type { ProviderTemplate } from '@/llm/providers';
import type { Settings } from '@/storage/schema';

export function upsertTemplateProvider(
  settings: Settings,
  template: ProviderTemplate,
  label: string
): Settings {
  const existing = settings.providers[template.id];
  return {
    ...settings,
    activeProviderId: template.id,
    providers: {
      ...settings.providers,
      [template.id]: existing ?? {
        id: template.id,
        label,
        protocol: template.protocol,
        baseURL: template.baseURL,
        apiKey: '',
        model: template.defaultModel,
        isCustom: false,
      },
    },
  };
}
