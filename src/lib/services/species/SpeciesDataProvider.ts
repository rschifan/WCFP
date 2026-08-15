import type { Species, RegionStats } from '$lib/types/species';

/**
 * Provider contract for species data access.
 * All implementations must support caching and error handling.
 */
export interface SpeciesDataProvider {
	/**
	 * Fetch all species for a given region.
	 *
	 * @param regionCode - TDWG Level 3 code (e.g., "COS", "AFG")
	 * @returns Array of species found in the region
	 * @throws {Error} If region not found or network error
	 */
	getSpeciesByRegion(regionCode: string): Promise<Species[]>;

	/**
	 * Get cached data synchronously (if available).
	 * Useful for optimistic UI updates without loading states.
	 *
	 * @param regionCode - TDWG Level 3 code to look up
	 * @returns Species array if cached, null otherwise
	 */
	getCachedData(regionCode: string): Species[] | null;

	/**
	 * Get aggregated statistics for a region.
	 *
	 * @param regionCode - TDWG Level 3 code
	 * @returns Statistics including total species, family count, and top families
	 */
	getRegionStats(regionCode: string): Promise<RegionStats>;

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
