/**
 * Factory function for creating SpatialDistributionService instances.
 * Follows the same pattern as createSpeciesProvider.
 */

import type { SpeciesDataProvider } from '../species/SpeciesDataProvider';
import type { ISpatialDistributionService } from '$lib/types/spatial-distribution';
import { SpatialDistributionService } from './SpatialDistributionService';

/**
 * Factory function - creates a SpatialDistributionService instance.
 * Requires a SpeciesDataProvider for dependency injection.
 *
 * @param speciesProvider - The species data provider to use
 * @returns A configured SpatialDistributionService instance
 *
 * @example
 * ```typescript
 * const speciesProvider = createSpeciesProvider();
 * const distributionService = createSpatialDistributionService(speciesProvider);
 * ```
 */
export function createSpatialDistributionService(
	speciesProvider: SpeciesDataProvider
): ISpatialDistributionService {
	return new SpatialDistributionService(speciesProvider);
}
