import type { ChatMessage, PageContent } from '@/shared/types';

export function buildSummaryPrompt(content: PageContent): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是专业的资讯摘要助手。请基于用户提供的网页内容，输出结构化中文摘要。' +
        '严格按以下格式输出：\n\n' +
        '【核心观点】\n用 2-3 个要点概括文章主旨，每点一行，以 "· " 开头。\n\n' +
        '【关键要点】\n列出 2-4 个关键技术细节或数据，每点一行，以 "· " 开头。\n\n' +
        '【适用人群】\n一句话说明适合谁阅读。不要输出其他内容。',
    },
    {
      role: 'user',
      content: `标题：${content.title}\n\n正文：\n${content.text}`,
    },
  ];
}
