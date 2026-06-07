const cache = new Map<string, string[]>();

/** Parse detection categories → string array. Handles both JSON string (legacy) and array (JSONB). */
export function parseCategories(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  if (cache.has(raw)) return cache.get(raw)!;
  try {
    const parsed = JSON.parse(raw);
    const result = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
    if (cache.size > 10000) cache.clear(); // Simple eviction to prevent unbounded memory growth
    cache.set(raw, result);
    return result;
  } catch {
    return [];
  }
}
