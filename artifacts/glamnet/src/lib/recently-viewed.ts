export const RECENTLY_VIEWED_KEY = "glamnet_recently_viewed";

export function recordRecentlyViewed(stylistId: string) {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = [stylistId, ...ids.filter(id => id !== stylistId)].slice(0, 10);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {}
}
