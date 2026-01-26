import type { SpeciesDataProvider } from '../SpeciesDataProvider';
import type { Species, RegionStats, SpeciesManifest } from '$lib/types/species';
import { CacheManager } from '../../cache/CacheManager';
import { sanitizeFilename } from '$lib/utils/strings';
import { ServiceError, ServiceErrorCode } from '../../errors';

/**
 * JSON-based species data provider.
 * Loads individual JSON files per region on-demand from static storage.
 *
 * Features:
 * - Content-hashed filenames: Files are named {region}.{hash}.json for automatic cache invalidation
 * - Manifest-based lookup: Resolves region names to hashed filenames via manifest.json
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

	// Manifest for resolving region names to hashed filenames
	private manifest: SpeciesManifest | null = null;
	private manifestPromise: Promise<SpeciesManifest> | null = null;

	async preload(): Promise<void> {
		// Preload the manifest so region lookups don't wait for it
		await this.loadManifest();
	}

	/**
	 * Load the manifest file that maps region names to hashed filenames.
	 * Uses singleton pattern: only fetches once, subsequent calls return cached promise.
	 */
	private async loadManifest(): Promise<SpeciesManifest> {
		if (this.manifest) return this.manifest;
		if (this.manifestPromise) return this.manifestPromise;

		this.manifestPromise = fetch(`${this.baseUrl}/manifest.json`)
			.then((response) => {
				if (!response.ok) {
					throw new ServiceError(
						ServiceErrorCode.NETWORK_ERROR,
						`Failed to load species manifest: HTTP ${response.status}`,
						{ status: response.status }
					);
				}
				return response.json();
			})
			.then((manifest: SpeciesManifest) => {
				this.manifest = manifest;
				return manifest;
			})
			.catch((err) => {
				// Reset promise so we can retry
				this.manifestPromise = null;
				throw err;
			});

		return this.manifestPromise;
	}

	/**
	 * Get cached data synchronously (if available).
	 * Only works if manifest is already loaded; returns null if manifest not yet fetched.
	 *
	 * @param regionName - Region name to look up
	 * @returns Species array if cached, null otherwise
	 */
	getCachedData(regionName: string): Species[] | null {
		// Can't resolve filename without manifest
		if (!this.manifest) return null;

		const sanitized = sanitizeFilename(regionName);
		const filename = this.manifest.files[sanitized];
		if (!filename) return null;

		return this.getCachedDataByFilename(filename);
	}

	/**
	 * Get cached data by hashed filename (the cache key).
	 */
	private getCachedDataByFilename(filename: string): Species[] | null {
		// Check memory cache first (fastest)
		if (this.memoryCache.has(filename)) {
			const data = this.memoryCache.get(filename)!;
			// Move to end for LRU (delete and re-add to update access order)
			this.memoryCache.delete(filename);
			this.memoryCache.set(filename, data);
			return data;
		}

		// Check localStorage (slower but persistent)
		return this.persistentCache.get(filename);
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
		// Load manifest to resolve region -> hashed filename
		const manifest = await this.loadManifest();
		const sanitized = sanitizeFilename(regionName);
		const filename = manifest.files[sanitized];

		if (!filename) {
			throw new ServiceError(
				ServiceErrorCode.DATA_NOT_FOUND,
				`No species data found for region: ${regionName}`,
				{ regionName, sanitized }
			);
		}

		// Use hashed filename as cache key (guarantees freshness when content changes)
		const cached = this.getCachedDataByFilename(filename);
		if (cached) {
			return cached;
		}

		// Fetch from server
		const url = `${this.baseUrl}/${filename}`;

		try {
			const response = await fetch(url);

			if (!response.ok) {
				if (response.status === 404) {
					// Manifest listed file but it's missing - unexpected
					throw new ServiceError(
						ServiceErrorCode.DATA_NOT_FOUND,
						`Species data file not found: ${filename}`,
						{ regionName, filename, status: 404 }
					);
				}
				// Network/server error
				throw new ServiceError(
					ServiceErrorCode.NETWORK_ERROR,
					`HTTP ${response.status}: ${response.statusText}`,
					{ regionName, filename, status: response.status, statusText: response.statusText }
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
					{ regionName, filename, parseError }
				);
			}

			// Validate response structure
			if (!Array.isArray(data)) {
				throw new ServiceError(
					ServiceErrorCode.INVALID_DATA,
					'Invalid data format: expected array of species',
					{ regionName, filename, dataType: typeof data }
				);
			}

			// Cache using hashed filename as key (automatic invalidation when content changes)
			this.addToMemoryCache(filename, data);
			this.persistentCache.set(filename, data);

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
				{ regionName, filename, originalError: err }
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
