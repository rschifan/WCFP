/**
 * Context API for SpatialDistributionService dependency injection.
 * Follows the same pattern as species provider context.
 */

import { getContext, setContext } from 'svelte';
import type { ISpatialDistributionService } from '$lib/types/spatial-distribution';

/**
 * Context key for spatial distribution service (Symbol ensures uniqueness)
 */
const SPATIAL_DISTRIBUTION_SERVICE_KEY = Symbol('spatialDistributionService');

/**
 * Set the spatial distribution service in Svelte context.
 * Call this in a parent component (e.g., +page.svelte).
 *
 * @param service - The service instance to inject
 *
 * @example
 * ```typescript
 * const service = createSpatialDistributionService(speciesProvider);
 * setSpatialDistributionService(service);
 * ```
 */
export function setSpatialDistributionService(service: ISpatialDistributionService): void {
	setContext(SPATIAL_DISTRIBUTION_SERVICE_KEY, service);
}

/**
 * Get the spatial distribution service from Svelte context.
 * Call this in child components that need distribution data.
 *
 * @returns The service instance
 * @throws {Error} If service not found in context
 *
 * @example
 * ```typescript
 * const service = useSpatialDistributionService();
 * const distribution = await service.getDistributionForNode(node, families, geoJSON);
 * ```
 */
export function useSpatialDistributionService(): ISpatialDistributionService {
	const service = getContext<ISpatialDistributionService>(SPATIAL_DISTRIBUTION_SERVICE_KEY);

	if (!service) {
		throw new Error(
			'SpatialDistributionService not found in context. ' +
				'Did you call setSpatialDistributionService() in a parent component?'
		);
	}

	return service;
}
