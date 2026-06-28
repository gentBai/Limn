export function segment(text: string): string[] {
  return text
    .split(/\n\s*\n+/)            // split by blank lines
    .map((p) => p.replace(/\s+/g, ' ').trim())  // collapse intra-paragraph newlines
    .filter((p) => p.length > 0);
}
