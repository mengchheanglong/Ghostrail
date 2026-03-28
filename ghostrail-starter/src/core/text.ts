export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function splitSentences(value: string): string[] {
  return value
    .split(/[.!?]\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

export function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function includesAny(value: string, keywords: string[]): boolean {
  const lower = value.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}
