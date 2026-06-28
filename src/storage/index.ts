import type { Settings, ProviderSettings } from './schema';
import { BUILTIN_PROVIDER_TEMPLATES } from '@/llm/providers';
import { t } from '@/i18n';

const KEY = 'settings';

/** 默认启用 DeepSeek 模板，用户只需填 Key */
const DEFAULT_DEEPSEEK = BUILTIN_PROVIDER_TEMPLATES[1];

export const DEFAULT_SETTINGS: Settings = {
  activeProviderId: DEFAULT_DEEPSEEK.id,
  providers: {
    [DEFAULT_DEEPSEEK.id]: {
      id: DEFAULT_DEEPSEEK.id,
      label: t('provider.deepseek'),
      protocol: DEFAULT_DEEPSEEK.protocol,
      baseURL: DEFAULT_DEEPSEEK.baseURL,
      model: DEFAULT_DEEPSEEK.defaultModel,
      apiKey: '',
      isCustom: false,
    },
  },
  translateTargetLang: 'zh',
  summaryStyle: 'standard',
  uiLanguage: 'auto',
};

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY);
  const saved = result[KEY] as Partial<Settings> | undefined;
  if (!saved) return { ...DEFAULT_SETTINGS };
  // Merge: keep user config but fill in new fields (backward compatible with old structure)
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    providers: { ...saved.providers },
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ [KEY]: merged });
}

export async function getActiveProviderSettings(): Promise<ProviderSettings | null> {
  const s = await loadSettings();
  return s.providers[s.activeProviderId] ?? null;
}
