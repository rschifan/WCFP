import type { SpeciesDataProvider } from '../SpeciesDataProvider';
import type { Species, RegionStats } from '$lib/types/species';
import { CacheManager } from '../../cache/CacheManager';
import { sanitizeFilename } from '$lib/utils/strings';
import { ServiceError, ServiceErrorCode } from '../../errors';

/**
 * JSON-based species data provider.
 * Loads individual JSON files per region on-demand from static storage.
 *
 * Features:
 * - Lazy loading: Only downloads data when needed
 * - Two-tier caching: In-memory (fast) + localStorage (persistent)
 * - LRU eviction: Prevents unbounded memory growth
 * - SSR-safe: Only uses localStorage in browser context
 */
export class JsonSpeciesProvider implements SpeciesDataProvider {
	private memoryCache = new Map<string, Species[]>();
	private persistentCache = new CacheManager<Species[]>('species');
	private readonly baseUrl = '/data/species';
	private readonly MAX_MEMORY_CACHE = 50;

	async preload(): Promise<void> {
		// No preloading needed for JSON provider
		// Data is loaded on-demand when regions are clicked
	}

	getCachedData(regionName: string): Species[] | null {
		// Check memory cache first (fastest)
		if (this.memoryCache.has(regionName)) {
			const data = this.memoryCache.get(regionName)!;
			// Move to end for LRU (delete and re-add to update access order)
			this.memoryCache.delete(regionName);
			this.memoryCache.set(regionName, data);
			return data;
		}

		// Check localStorage (slower but persistent)
		return this.persistentCache.get(regionName);
	}

	/**
	 * Fetch all species for a given region.
	 *
	 * Contract:
	 * - Returns Species[] if data exists
	 * - Throws ServiceError with code:
	 *   - DATA_NOT_FOUND: region has no data file (expected, recoverable)
	 *   - NETWORK_ERROR: HTTP error (unexpected)
	 *   - INVALID_DATA: parsing/format error (unexpected)
	 *   - UNKNOWN_ERROR: other errors (unexpected)
	 *
	 * @param regionName - TDWG Level 3 region name (e.g., "Costa Rica", "Afghanistan")
	 * @returns Array of species found in the region
	 * @throws {ServiceError} If region not found or network/data error
	 */
	async getSpeciesByRegion(regionName: string): Promise<Species[]> {
		// Try cache first (optimistic update)
		const cached = this.getCachedData(regionName);
		if (cached) {
			return cached;
		}

		// Fetch from server
		const filename = sanitizeFilename(regionName);
		const url = `${this.baseUrl}/${filename}.json`;

		try {
			const response = await fetch(url);

			if (!response.ok) {
				if (response.status === 404) {
					// Expected: region has no data file
					throw new ServiceError(
						ServiceErrorCode.DATA_NOT_FOUND,
						`No species data found for region: ${regionName}`,
						{ regionName, status: 404 }
					);
				}
				// Network/server error
				throw new ServiceError(
					ServiceErrorCode.NETWORK_ERROR,
					`HTTP ${response.status}: ${response.statusText}`,
					{ regionName, status: response.status, statusText: response.statusText }
				);
			}

			let data: Species[];
			try {
				data = await response.json();
			} catch (parseError) {
				// JSON parsing error
				throw new ServiceError(
					ServiceErrorCode.INVALID_DATA,
					`Failed to parse JSON response for region: ${regionName}`,
					{ regionName, parseError }
				);
			}

			// Validate response structure
			if (!Array.isArray(data)) {
				throw new ServiceError(
					ServiceErrorCode.INVALID_DATA,
					'Invalid data format: expected array of species',
					{ regionName, dataType: typeof data }
				);
			}

			// Cache the result
			this.addToMemoryCache(regionName, data);
			this.persistentCache.set(regionName, data);

			return data;
		} catch (err) {
			// Re-throw ServiceError as-is (already properly typed)
			if (err instanceof ServiceError) {
				throw err;
			}

			// Wrap unknown errors
			const message = err instanceof Error ? err.message : String(err);
			throw new ServiceError(
				ServiceErrorCode.UNKNOWN_ERROR,
				`Failed to load species for "${regionName}": ${message}`,
				{ regionName, originalError: err }
			);
		}
	}

	async getRegionStats(regionName: string): Promise<RegionStats> {
		const species = await this.getSpeciesByRegion(regionName);

		// Calculate family distribution
		const familyMap = new Map<string, number>();
		species.forEach((s) => {
			familyMap.set(s.family, (familyMap.get(s.family) || 0) + 1);
		});

		// Get top 10 families by count
		const topFamilies = Array.from(familyMap.entries())
			.map(([family, count]) => ({ family, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		return {
			totalSpecies: species.length,
			familyCount: familyMap.size,
			topFamilies
		};
	}

	async cleanup(): Promise<void> {
		this.memoryCache.clear();
		// Keep localStorage cache for next visit
	}

	/**
	 * Add to memory cache with LRU eviction.
	 * Uses Map's insertion order guarantee to track access order.
	 * Least recently used items are at the start of the Map.
	 */
	private addToMemoryCache(key: string, value: Species[]): void {
		// If key exists, delete first to update insertion order
		if (this.memoryCache.has(key)) {
			this.memoryCache.delete(key);
		}

		// Evict oldest entry if cache is full (first item = least recently used)
		if (this.memoryCache.size >= this.MAX_MEMORY_CACHE) {
			const oldestKey = this.memoryCache.keys().next().value;
			if (oldestKey) {
				this.memoryCache.delete(oldestKey);
			}
		}

		this.memoryCache.set(key, value);
	}
}
