export function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
export function splitSentences(value) {
    return value
        .split(/[.!?]\s+/)
        .map((part) => normalizeWhitespace(part))
        .filter(Boolean);
}
export function unique(items) {
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
export function includesAny(value, keywords) {
    const lower = value.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
}
