/**
 * Type definitions for spatial distribution service
 */

import type { FeatureCollection } from 'geojson';
import type { TaxonomyNode, FamilyLookup } from './taxonomy';

/**
 * Cached region list extracted from GeoJSON.
 * Single entry per GeoJSON hash to avoid redundant extraction.
 */
export interface RegionCache {
	geoJSONHash: string;
	regions: string[];
}

/**
 * Interface for spatial distribution service.
 * Provides methods to compute spatial distributions for taxonomy nodes.
 */
export interface ISpatialDistributionService {
	/**
	 * Get spatial distribution for a taxonomy node.
	 * Returns a map of region names to species counts.
	 *
	 * @param node - The taxonomy node to compute distribution for
	 * @param families - Family lookup data (from families.json)
	 * @param geoJSON - GeoJSON feature collection with region data
	 * @param abortSignal - Optional AbortSignal for request cancellation
	 * @param fullTree - Optional full taxonomy tree for path-based family lookup (needed for species-level nodes)
	 * @returns Map of region names to species counts
	 * @throws {Error} If computation fails or is aborted
	 */
	getDistributionForNode(
		node: TaxonomyNode,
		families: FamilyLookup,
		geoJSON: FeatureCollection,
		abortSignal?: AbortSignal,
		fullTree?: TaxonomyNode
	): Promise<Map<string, number>>;

	/**
	 * Clear all caches.
	 * Useful for memory management or when data changes.
	 */
	clearCache(): void;

	/**
	 * Check if a node has distribution data (synchronously checks cache only).
	 * Returns true if the node is in cache and has non-empty distribution data.
	 * Returns false if not in cache or has empty distribution data.
	 *
	 * @param node - The taxonomy node to check
	 * @param geoJSON - GeoJSON feature collection (used for cache key consistency)
	 * @returns true if node has distribution data in cache, false otherwise
	 */
	hasDistributionData(node: TaxonomyNode, geoJSON: FeatureCollection): boolean;
}
