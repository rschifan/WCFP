/**
 * Species service - Main entry point
 *
 * Exports:
 * - Types and interfaces
 * - Factory function
 * - Context API for dependency injection
 */

// Type exports
export type { SpeciesDataProvider } from './SpeciesDataProvider';
export type { Species, RegionStats } from '$lib/types/species';

// Factory export
export { createSpeciesProvider } from './factory';

// Context API exports
export { setSpeciesProvider, getSpeciesProvider as useSpeciesProvider } from './context';
