/**
 * Count words in an HTML string by stripping tags and splitting on whitespace.
 */
export function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length === 0) return 0;
  return text.split(' ').length;
}
