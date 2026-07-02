import type { PageContent } from '@/shared/types';

const STORAGE_KEY = 'contentCache';

/**
 * Per-tab extracted page content, persisted to chrome.storage.session.
 *
 * Unlike an in-memory Map, session storage survives Service Worker shutdowns
 * (Chrome evicts the SW after ~30s idle), so a chat/summary request started
 * before the SW was killed can still reuse the already-extracted content.
 */
async function readAll(): Promise<Record<number, PageContent>> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as Record<number, PageContent>) ?? {};
}

async function writeAll(cache: Record<number, PageContent>): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: cache });
}

export async function getContent(tabId: number): Promise<PageContent | undefined> {
  const all = await readAll();
  return all[tabId];
}

export async function setContent(tabId: number, content: PageContent): Promise<void> {
  const all = await readAll();
  all[tabId] = content;
  await writeAll(all);
}

export async function deleteContent(tabId: number): Promise<void> {
  const all = await readAll();
  if (!(tabId in all)) return;
  delete all[tabId];
  await writeAll(all);
}
