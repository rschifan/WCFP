/**
 * Factory function for creating API-backed spatial distribution service instances.
 */

import type { ISpatialDistributionService } from '$lib/types/spatial-distribution';
import { ApiSpatialDistributionService } from './ApiSpatialDistributionService';
import { config } from '../config';

/**
 * Factory function - creates the API-backed spatial distribution service.
 */
export function createSpatialDistributionService(): ISpatialDistributionService {
	return new ApiSpatialDistributionService(config.apiUrl);
}
