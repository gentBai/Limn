const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

export function detectLang(text: string): string {
  if (!text.trim()) return 'unknown';
  // 取前 500 字判断，避免长文干扰
  const sample = text.slice(0, 500);
  const cjkCount = (sample.match(new RegExp(CJK_RE, 'g')) || []).length;
  if (cjkCount > sample.length * 0.2) return 'zh';
  return 'en';
}
