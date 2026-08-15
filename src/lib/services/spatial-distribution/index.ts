/**
 * Spatial Distribution Service - Public API
 *
 * Exports all public interfaces and functions for the spatial distribution service.
 */

export { ApiSpatialDistributionService } from './ApiSpatialDistributionService';
export { createSpatialDistributionService } from './factory';
export { setSpatialDistributionService, useSpatialDistributionService } from './context';
export type { ISpatialDistributionService } from '$lib/types/spatial-distribution';
