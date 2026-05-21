export function normalizeQuestionContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase();
}
