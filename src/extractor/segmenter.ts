export function segment(text: string): string[] {
  return text
    .split(/\n\s*\n+/)            // 按空行分段
    .map((p) => p.replace(/\s+/g, ' ').trim())  // 段内换行合并
    .filter((p) => p.length > 0);
}
