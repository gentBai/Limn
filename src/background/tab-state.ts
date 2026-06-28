import type { TabState, SummaryState, ConversationMessage } from '@/shared/messages';
import type { PageContent } from '@/shared/types';

const STORAGE_KEY = 'tabStates';

/** Default empty TabState */
function emptyTabState(tabId: number): TabState {
  return {
    tabId,
    pageContent: null,
    summary: { status: 'idle', text: '', error: null, usage: null },
    chat: [],
  };
}

/** Read all tab states */
async function readAll(): Promise<Record<number, TabState>> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as Record<number, TabState>) ?? {};
}

/** Write all tab states */
async function writeAll(states: Record<number, TabState>): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: states });
}

/** Get a single tab state (returns empty state if absent) */
export async function getTabState(tabId: number): Promise<TabState> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  // Backward compat: old data without chat field gets initialized
  if (!state.chat) state.chat = [];
  return state;
}

/** Set/update pageContent */
export async function setPageContent(tabId: number, content: PageContent): Promise<void> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  state.pageContent = content;
  all[tabId] = state;
  await writeAll(all);
}

/** Update summary state (partial merge) */
export async function updateSummary(tabId: number, patch: Partial<SummaryState>): Promise<void> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  state.summary = { ...state.summary, ...patch };
  all[tabId] = state;
  await writeAll(all);
}

/** Append a message to the single conversation stream */
export async function addChatMessage(tabId: number, message: ConversationMessage): Promise<void> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  state.chat.push(message);
  all[tabId] = state;
  await writeAll(all);
}

/** Replace the entire chat history for a tab */
export async function setChat(tabId: number, messages: ConversationMessage[]): Promise<void> {
  const all = await readAll();
  const state = all[tabId] ?? emptyTabState(tabId);
  state.chat = messages;
  all[tabId] = state;
  await writeAll(all);
}

/** Clear a single tab state (called on tab close) */
export async function clearTabState(tabId: number): Promise<void> {
  const all = await readAll();
  delete all[tabId];
  await writeAll(all);
}
