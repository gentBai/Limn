import type { TabState, SummaryState, TranslationRecord } from '@/shared/messages';
import type { PageContent } from '@/shared/types';

const STORAGE_KEY = 'tabStates';

/** 默认的空 TabState */
function emptyTabState(tabId: number): TabState {
  return {
    tabId,
    pageContent: null,
    summary: { status: 'idle', text: '', error: null, usage: null },
    translations: [],
  };
}

/** 读取所有 tab 状态 */
async function readAll(): Promise<Record<number, TabState>> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as Record<number, TabState>) ?? {};
}

/** 写入所有 tab 状态 */
async function writeAll(states: Record<number, TabState>): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: states });
}

/** 获取单个 tab 状态（不存在则返回空状态） */
export async function getTabState(tabId: number): Promise<TabState> {
  const all = await readAll();
  return all[tabId] ?? emptyTabState(tabId);
}

/** 设置/更新 pageContent */
export async function setPageContent(tabId: number, content: PageContent): Promise<void> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  state.pageContent = content;
  all[tabId] = state;
  await writeAll(all);
}

/** 更新摘要状态（部分字段合并） */
export async function updateSummary(tabId: number, patch: Partial<SummaryState>): Promise<void> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  state.summary = { ...state.summary, ...patch };
  all[tabId] = state;
  await writeAll(all);
}

/** 追加一条翻译记录 */
export async function addTranslation(tabId: number, record: TranslationRecord): Promise<void> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  state.translations.unshift(record); // newest first
  all[tabId] = state;
  await writeAll(all);
}

/** 更新某条翻译记录（流式翻译时逐字填充 target） */
export async function updateTranslation(tabId: number, id: string, patch: Partial<TranslationRecord>): Promise<void> {
  const all = await readAll();
  const state = all[tabId];
  if (!state) return;
  const idx = state.translations.findIndex((t) => t.id === id);
  if (idx === -1) return;
  state.translations[idx] = { ...state.translations[idx], ...patch };
  all[tabId] = state;
  await writeAll(all);
}

/** 清除单个 tab 的状态（tab 关闭时调用） */
export async function clearTabState(tabId: number): Promise<void> {
  const all = await readAll();
  delete all[tabId];
  await writeAll(all);
}
