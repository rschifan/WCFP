/**
 * Type definitions for spatial distribution service
 */

import type { TaxonomyNodeNormalized } from './taxonomy';

/**
 * Interface for spatial distribution service.
 * Provides methods to compute spatial distributions for taxonomy nodes.
 */
export interface ISpatialDistributionService {
	/**
	 * Get spatial distribution for a taxonomy node.
	 * Returns a map of region codes to species counts.
	 *
	 * @param node - The taxonomy node to compute distribution for
	 * @param abortSignal - Optional AbortSignal for request cancellation
	 * @returns Map of region codes to species counts
	 * @throws {Error} If computation fails or is aborted
	 */
	getDistributionForNode(
		node: TaxonomyNodeNormalized,
		abortSignal?: AbortSignal
	): Promise<Map<string, number>>;

	/**
	 * Clear all caches.
	 * Useful for memory management or when data changes.
	 */
	clearCache(): void;
}
