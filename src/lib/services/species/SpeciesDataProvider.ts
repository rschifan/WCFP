import type { Species, RegionStats } from '$lib/types/species';

/**
 * Provider contract for species data access.
 * All implementations must support caching and error handling.
 *
 * Implementations:
 * - JsonSpeciesProvider: Lazy-loaded JSON files from static CDN
 * - ApiSpeciesProvider: REST API backend
 * - DuckDBSpeciesProvider: Client-side DuckDB-WASM database
 */
export interface SpeciesDataProvider {
	/**
	 * Fetch all species for a given region.
	 *
	 * @param regionName - TDWG Level 3 region name (e.g., "Costa Rica", "Afghanistan")
	 * @returns Array of species found in the region
	 * @throws {Error} If region not found or network error
	 */
	getSpeciesByRegion(regionName: string): Promise<Species[]>;

	/**
	 * Get cached data synchronously (if available).
	 * Useful for optimistic UI updates without loading states.
	 *
	 * @param regionName - Region name to look up
	 * @returns Species array if cached, null otherwise
	 */
	getCachedData(regionName: string): Species[] | null;

	/**
	 * Get aggregated statistics for a region.
	 *
	 * @param regionName - Region name
	 * @returns Statistics including total species, family count, and top families
	 */
	getRegionStats(regionName: string): Promise<RegionStats>;

	/**
	 * Initialize provider (load databases, warm up connections, etc.).
	 * Called once before first use.
	 *
	 * @returns Promise that resolves when initialization is complete
	 */
	preload(): Promise<void>;

	/**
	 * Clean up resources (close connections, clear cache).
	 * Called on component unmount or provider swap.
	 */
	cleanup(): Promise<void>;
}
