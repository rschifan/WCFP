/**
 * SpatialDistributionService - Production-ready service for WCFP_ID-based distributions.
 *
 * Features:
 * - Multi-level caching (per-node distribution results + derived region list)
 * - Reuses SpeciesDataProvider cache (no duplication)
 * - AbortController support (request cancellation)
 * - LRU eviction (memory management)
 * - Structured error logging
 * - Input validation
 * - Performance monitoring
 */

import type { SpeciesDataProvider } from '../species/SpeciesDataProvider';
import type { TaxonomyNode, FamilyLookup, TaxonomySchema } from '$lib/types/taxonomy';
import type { FeatureCollection } from 'geojson';
import type { RegionCache, ISpatialDistributionService } from '$lib/types/spatial-distribution';
import { getNodePath, getWcfpIdsForNode } from '$lib/utils/taxonomy/node-traversal';
import { ServiceError, ServiceErrorCode } from '../errors';

export class SpatialDistributionService implements ISpatialDistributionService {
	// Level 1: Final results cache (nodePath → Map<region, count>)
	private distributionCache = new Map<string, Map<string, number>>();
	private readonly MAX_DISTRIBUTION_CACHE = 50;

	// Level 2: Region list cache (single entry per GeoJSON hash)
	private regionCache: RegionCache | null = null;

	// Memoized hash cache to avoid repeated JSON.stringify for the same GeoJSON object
	private geoJSONHashCache = new WeakMap<FeatureCollection, string>();

	private readonly speciesProvider: SpeciesDataProvider;

	constructor(speciesProvider: SpeciesDataProvider) {
		this.speciesProvider = speciesProvider;
	}

	/**
	 * Get cached regions from GeoJSON or extract them.
	 * Uses a simple hash of the GeoJSON string for cache key.
	 */
	private getCachedRegions(geoJSON: FeatureCollection): string[] {
		// Generate or retrieve a memoized hash for this GeoJSON
		let geoJSONHash = this.geoJSONHashCache.get(geoJSON);
		if (!geoJSONHash) {
			const geoJSONString = JSON.stringify(geoJSON);
			geoJSONHash = this.simpleHash(geoJSONString);
			this.geoJSONHashCache.set(geoJSON, geoJSONHash);
		}

		// Check if we have cached regions for this GeoJSON
		if (this.regionCache && this.regionCache.geoJSONHash === geoJSONHash) {
			return this.regionCache.regions;
		}

		// Extract regions from GeoJSON features
		const regions = new Set<string>();
		for (const feature of geoJSON.features) {
			const regionName = feature.properties?.LEVEL3_NAM || feature.properties?.area;
			if (regionName && typeof regionName === 'string') {
				regions.add(regionName);
			}
		}

		const regionArray = Array.from(regions).sort();
		this.regionCache = {
			geoJSONHash,
			regions: regionArray
		};

		return regionArray;
	}

	/**
	 * Simple hash function for GeoJSON string.
	 * Used to detect when GeoJSON changes.
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString(36);
	}

	/**
	 * Get spatial distribution for a taxonomy node.
	 *
	 * Contract:
	 * - Returns Map<region, count> of matching WCFP_IDs per region
	 * - Never throws for "no data" scenarios (empty map = no coverage)
	 * - Only throws ServiceError for:
	 *   - VALIDATION_ERROR: invalid input
	 *   - ABORTED: request cancelled
	 *   - NETWORK_ERROR / INVALID_DATA / UNKNOWN_ERROR: infrastructure failures
	 *
	 * Missing region files (DATA_NOT_FOUND) are treated as 0 species for that region.
	 *
	 * @param node - Taxonomy node to compute distribution for
	 * @param families - Family lookup (unused, kept for interface compatibility)
	 * @param geoJSON - GeoJSON feature collection with region data
	 * @param abortSignal - Optional AbortSignal for cancellation
	 * @param fullTree - Full taxonomy tree (used to extract schema for WCFP_ID lookup)
	 * @returns Map of region names to species counts
	 * @throws {ServiceError} Only for validation errors, aborted requests, or infrastructure failures
	 */
	async getDistributionForNode(
		node: TaxonomyNode,
		families: FamilyLookup,
		geoJSON: FeatureCollection,
		abortSignal?: AbortSignal,
		fullTree?: TaxonomyNode
	): Promise<Map<string, number>> {
		// Validate inputs
		this.validateInputs(node, geoJSON);

		// Check abort signal
		if (abortSignal?.aborted) {
			throw new ServiceError(ServiceErrorCode.ABORTED, 'Request aborted');
		}

		// Generate cache key from node path
		const nodePath = getNodePath(node);
		const startTime = performance.now();

		// Check Level 1 cache (distribution cache)
		if (this.distributionCache.has(nodePath)) {
			const cached = this.distributionCache.get(nodePath)!;
			// Move to end for LRU
			this.distributionCache.delete(nodePath);
			this.distributionCache.set(nodePath, cached);
			this.logPerformance('getDistributionForNode (cached)', performance.now() - startTime);
			return new Map(cached); // Return a copy
		}

		// Extract all WCFP_IDs for this node using the schema-based taxonomy tree
		const schema: TaxonomySchema | undefined = fullTree?.schema;
		const targetIds =
			schema && schema.ranks ? getWcfpIdsForNode(node, schema) : new Set<number>();

		if (targetIds.size === 0) {
			// No IDs found, return empty distribution (not an error)
			const emptyDistribution = new Map<string, number>();
			this.distributionCache.set(nodePath, emptyDistribution);
			this.evictDistributionIfNeeded();
			return emptyDistribution;
		}

		// Get cached regions (Level 2 cache)
		const regions = this.getCachedRegions(geoJSON);

		// Build distribution by processing regions in parallel
		const distribution = new Map<string, number>();

		try {
			// Process regions in parallel with Promise.allSettled for graceful error handling
			const regionPromises = regions.map(async (region) => {
				// Check abort signal
				if (abortSignal?.aborted) {
					return { region, count: 0 };
				}

				try {
					// Fetch species for this region and count how many distinct WCFP_IDs
					// from the target set are present.
					const species = await this.speciesProvider.getSpeciesByRegion(region);
					const seen = new Set<number>();
					let count = 0;

					for (const s of species) {
						const id = s.wcfpId;
						if (typeof id === 'number' && targetIds.has(id) && !seen.has(id)) {
							seen.add(id);
							count++;
						}
					}

					return { region, count };
				} catch (err) {
					// Handle errors based on error type
					if (err instanceof ServiceError) {
						// Expected errors (DATA_NOT_FOUND) are recoverable - continue silently
						if (err.isRecoverable()) {
							return { region, count: 0 };
						}
						// Unexpected errors - log as warning
						this.logWarning(`getDistributionForNode region(${region})`, err);
						return { region, count: 0 };
					}

					// Unknown error type - wrap and log
					const message = err instanceof Error ? err.message : String(err);
					this.logWarning(`getDistributionForNode region(${region})`, new Error(message));
					return { region, count: 0 };
				}
			});

			const results = await Promise.allSettled(regionPromises);

			// Process results and collect statistics
			let totalRegionsWithMatches = 0;
			let totalSpeciesCount = 0;
			for (const result of results) {
				if (result.status === 'fulfilled') {
					const { region, count } = result.value;
					if (count > 0) {
						distribution.set(region, count);
						totalRegionsWithMatches++;
						totalSpeciesCount += count;
					}
				} else {
					// Log rejected promises
					this.logError('getDistributionForNode region promise', result.reason);
				}
			}

			// Check abort signal again before caching
			if (abortSignal?.aborted) {
				throw new ServiceError(ServiceErrorCode.ABORTED, 'Request aborted');
			}

			// Log summary (dev-only, can be removed in production)
			if (import.meta.env.DEV) {
				console.log(
					`[SpatialDistributionService] Distribution: ${totalRegionsWithMatches}/${regions.length} regions, ${totalSpeciesCount} species`
				);
			}

			// Cache the result (Level 1)
			this.evictDistributionIfNeeded();
			this.distributionCache.set(nodePath, new Map(distribution));

			const duration = performance.now() - startTime;
			this.logPerformance('getDistributionForNode', duration);

			return distribution;
		} catch (err) {
			// Re-throw ServiceError as-is (already properly typed)
			if (err instanceof ServiceError) {
				this.logError('getDistributionForNode', err);
				throw err;
			}

			// Wrap unknown errors
			const message = err instanceof Error ? err.message : String(err);
			const wrappedError = new ServiceError(
				ServiceErrorCode.UNKNOWN_ERROR,
				`Failed to compute distribution: ${message}`,
				{ originalError: err }
			);
			this.logError('getDistributionForNode', wrappedError);
			throw wrappedError;
		}
	}

	/**
	 * Evict oldest entry from distribution cache if needed (LRU).
	 */
	private evictDistributionIfNeeded(): void {
		if (this.distributionCache.size >= this.MAX_DISTRIBUTION_CACHE) {
			// Remove first entry (least recently used)
			const oldestKey = this.distributionCache.keys().next().value;
			if (oldestKey) {
				this.distributionCache.delete(oldestKey);
			}
		}
	}

	/**
	 * Validate inputs for getDistributionForNode.
	 */
	private validateInputs(node: TaxonomyNode, geoJSON: FeatureCollection): void {
		if (!node) {
			throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Node is required');
		}
		if (!node.name) {
			throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Node must have a name');
		}
		if (!geoJSON) {
			throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'GeoJSON is required');
		}
		if (!geoJSON.features || !Array.isArray(geoJSON.features)) {
			throw new ServiceError(
				ServiceErrorCode.VALIDATION_ERROR,
				'GeoJSON must have a features array'
			);
		}
	}

	/**
	 * Log errors (only unexpected ones, not DATA_NOT_FOUND).
	 */
	private logError(context: string, error: Error | ServiceError): void {
		if (error instanceof ServiceError && error.isExpected()) {
			return; // Don't log expected errors
		}
		console.error(`[SpatialDistributionService] ${context}:`, error);
	}

	/**
	 * Log warnings (only unexpected ones).
	 */
	private logWarning(context: string, error: Error | ServiceError): void {
		if (error instanceof ServiceError && error.isExpected()) {
			return; // Don't log expected errors
		}
		console.warn(`[SpatialDistributionService] ${context}:`, error);
	}

	/**
	 * Performance monitoring - log slow operations.
	 */
	private logPerformance(operation: string, duration: number): void {
		if (duration > 1000) {
			console.warn(
				`[SpatialDistributionService] Slow operation: ${operation} took ${duration.toFixed(2)}ms`
			);
		}
	}

	/**
	 * Check if a node has distribution data (synchronously checks cache only).
	 * Returns true if the node is in cache and has non-empty distribution data.
	 * Returns false if not in cache or has empty distribution data.
	 */
	hasDistributionData(node: TaxonomyNode, geoJSON: FeatureCollection): boolean {
		const nodePath = getNodePath(node);
		const cached = this.distributionCache.get(nodePath);
		
		if (!cached) {
			// Not in cache - we don't know yet, return false to be conservative
			return false;
		}
		
		// Check if cached distribution has any data
		return cached.size > 0;
	}

	/**
	 * Clear all caches.
	 */
	clearCache(): void {
		this.distributionCache.clear();
		this.regionCache = null;
		this.geoJSONHashCache = new WeakMap<FeatureCollection, string>();
	}
}
