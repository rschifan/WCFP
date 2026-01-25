import { browser } from '$app/environment';
import type { CacheEntry } from '$lib/types/species';

const CACHE_VERSION = 'v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Generic cache manager with localStorage persistence, TTL, and versioning.
 * SSR-safe implementation that only uses localStorage in browser context.
 */
export class CacheManager<T> {
	constructor(private prefix: string) {}

	/**
	 * Get cached data if available and not expired
	 */
	get(key: string): T | null {
		if (!browser) return null;

		try {
			const cached = localStorage.getItem(`${this.prefix}_${key}`);
			if (!cached) return null;

			const entry: CacheEntry<T> = JSON.parse(cached);

			// Check version - invalidate if version changed
			if (entry.version !== CACHE_VERSION) {
				this.remove(key);
				return null;
			}

			// Check expiration - invalidate if expired
			if (Date.now() - entry.timestamp > CACHE_TTL) {
				this.remove(key);
				return null;
			}

			return entry.data;
		} catch (err) {
			console.error('[CacheManager] Get error:', err);
			return null;
		}
	}

	/**
	 * Store data in cache with timestamp and version
	 */
	set(key: string, data: T): void {
		if (!browser) return;

		try {
			const entry: CacheEntry<T> = {
				data,
				timestamp: Date.now(),
				version: CACHE_VERSION
			};
			localStorage.setItem(`${this.prefix}_${key}`, JSON.stringify(entry));
		} catch (err) {
			// localStorage full or disabled - fail silently
			console.warn('[CacheManager] Set error (storage may be full):', err);
		}
	}

	/**
	 * Remove specific cache entry
	 */
	remove(key: string): void {
		if (!browser) return;
		localStorage.removeItem(`${this.prefix}_${key}`);
	}

	/**
	 * Clear all cache entries with this prefix
	 */
	clear(): void {
		if (!browser) return;

		try {
			// Iterate backwards to safely remove items while iterating
			for (let i = localStorage.length - 1; i >= 0; i--) {
				const key = localStorage.key(i);
				if (key?.startsWith(this.prefix)) {
					localStorage.removeItem(key);
				}
			}
		} catch (err) {
			console.warn('[CacheManager] Failed to clear cache:', err);
		}
	}
}
