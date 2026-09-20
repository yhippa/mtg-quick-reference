const KEY = 'mtg-recent-cards';
export interface RecentStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function readRecent(storage: RecentStorage): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? [...new Set(value.filter((name): name is string => typeof name === 'string' && name.length > 0 && name.length <= 500))].slice(0, 5) : [];
  } catch { return []; }
}
export function remember(names: string[], name: string): string[] {
  return [name, ...names.filter(n => n !== name)].slice(0, 5);
}
export function saveRecent(storage: RecentStorage, names: string[]) {
  try { storage.setItem(KEY, JSON.stringify(names)); } catch { /* Keep this session usable when storage is full or blocked. */ }
}
