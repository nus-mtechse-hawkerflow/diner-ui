/**
 * Thin wrappers over localStorage that never throw: storage can be missing
 * (server render), blocked (private mode) or full, and none of those should
 * stop a diner from ordering.
 */

export const GUEST_STATE_STORAGE_KEY = 'hawkerflow.diner.guest';
export const CART_STORAGE_KEY_PREFIX = 'hawkerflow.diner.cart.';

export function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: the state simply stays in memory.
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}
