/**
 * Core type definitions for species data
 */

/**
 * Use categories for a species (from WCFP columns C-F, H-M)
 * Note: HumanFood (column G) is intentionally excluded
 */
export interface SpeciesUses {
	animalFood?: boolean;
	environmentalUses?: boolean;
	fuels?: boolean;
	geneSources?: boolean;
	invertebrateFood?: boolean;
	materials?: boolean;
	medicines?: boolean;
	poisons?: boolean;
	socialUses?: boolean;
	total: number;
}

/**
 * Represents a single plant species
 */
export interface Species {
	wcfpId: number;
	name: string;
	authors: string;
	family: string;
	genus?: string;
	lifeform?: string;
	cwr?: boolean;
	uses?: SpeciesUses;
}

/**
 * Aggregated statistics for a region
 */
export interface RegionStats {
	totalSpecies: number;
	familyCount: number;
	topFamilies: Array<{ family: string; count: number }>;
}

/**
 * Cache entry with versioning and TTL
 */
export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	version: string;
}
