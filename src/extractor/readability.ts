import { Readability } from '@mozilla/readability';

export interface ReadableResult {
  title: string;
  text: string;
}

export function extractReadable(document: Document): ReadableResult {
  // Readability 会修改传入的 document，故克隆
  const docClone = document.cloneNode(true) as Document;
  const article = new Readability(docClone).parse();
  const text = article?.textContent?.trim() ?? '';
  // Readability 对短文/无 <title> 的页面可能返回空 title，
  // 依次尝试 document.title、首个 h1、textContent 首行兜底
  let title = article?.title?.trim() || document.title?.trim() || '';
  if (!title) {
    const h1 = document.querySelector('h1');
    if (h1?.textContent?.trim()) title = h1.textContent.trim();
    else if (text) title = text.split('\n')[0].trim().slice(0, 100);
  }
  return { title, text };
}
