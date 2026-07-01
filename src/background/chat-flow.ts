import type { TabState } from '@/shared/messages';
import type { PageContent } from '@/shared/types';

export type ChatMode = 'selection' | 'question';

export interface ParsedChatPort {
  tabId: number;
  mode: ChatMode;
  payload: string;
}

function parseModeAndPayload(rest: string): Pick<ParsedChatPort, 'mode' | 'payload'> | null {
  const colonIdx = rest.indexOf(':');
  if (colonIdx < 0) return null;
  const mode = rest.slice(0, colonIdx);
  if (mode !== 'selection' && mode !== 'question') return null;
  return { mode, payload: rest.slice(colonIdx + 1) };
}

export function parseChatPortName(name: string, senderTabId?: number): ParsedChatPort | null {
  if (!name.startsWith('chat:')) return null;

  const rest = name.slice('chat:'.length);
  const firstColonIdx = rest.indexOf(':');
  if (firstColonIdx < 0) return null;

  const first = rest.slice(0, firstColonIdx);
  const remaining = rest.slice(firstColonIdx + 1);
  if (/^\d+$/.test(first)) {
    const parsed = parseModeAndPayload(remaining);
    return parsed ? { tabId: Number(first), ...parsed } : null;
  }

  const parsed = parseModeAndPayload(rest);
  if (!parsed || senderTabId === undefined) return null;
  return { tabId: senderTabId, ...parsed };
}

export async function getContentForChat(
  tabId: number,
  cached: PageContent | undefined,
  state: TabState,
  extract: (tabId: number) => Promise<PageContent>
): Promise<PageContent> {
  if (cached) return cached;
  if (state.pageContent) return state.pageContent;
  return extract(tabId);
}
