/**
 * 轻量 i18n 模块
 * - 优先读 options 里的语言覆盖（用户手动指定）
 * - 其次跟随浏览器语言（navigator.language）
 * - 默认中文
 *
 * 用法：t('summary.generate') 或 t('summary.tokens', { total: 100 })
 */

import { zh } from './zh';
import { en } from './en';
import type { Settings } from '@/storage/schema';

export type Locale = 'zh' | 'en';

const messages: Record<Locale, typeof zh> = { zh, en };

/** 从 chrome.storage 读取用户配置的 locale 覆盖（异步，启动时用） */
export async function getUserLocaleOverride(): Promise<Locale | null> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings as Settings | undefined;
    const lang = settings?.uiLanguage;
    if (lang === 'zh' || lang === 'en') return lang;
    return null; // 'auto' or unset -> follow browser
  } catch {
    return null;
  }
}

/** 根据浏览器语言推断 locale */
export function detectBrowserLocale(): Locale {
  const browserLang = (navigator.language || 'zh').toLowerCase();
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}

let currentLocale: Locale = detectBrowserLocale();

/** 初始化 locale（应用启动时调用一次，读 options 覆盖） */
export async function initLocale(): Promise<Locale> {
  const override = await getUserLocaleOverride();
  if (override) currentLocale = override;
  return currentLocale;
}

/** 获取当前 locale */
export function getLocale(): Locale {
  return currentLocale;
}

/** 直接设置 locale（options 页切换语言时调用） */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/**
 * 翻译函数
 * @param key 资源 key，如 'summary.generate'
 * @param params 模板参数，如 { total: 100 } 用于替换 {total}
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[currentLocale] ?? messages.zh;
  let text = (dict as Record<string, string>)[key] ?? (messages.zh as Record<string, string>)[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
