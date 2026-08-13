import type { SpeciesDataProvider } from '../SpeciesDataProvider';
import type { Species, RegionStats } from '$lib/types/species';
import { ServiceError, ServiceErrorCode } from '../../errors';
import { profileApiQuery } from '$lib/utils/api-profiler';
import { config } from '../../config';

/**
 * API-backed species data provider.
 * Fetches all runtime species data from the server-side DuckDB API.
 */
export class ApiSpeciesProvider implements SpeciesDataProvider {
	private cache = new Map<string, Species[]>();
	private readonly apiBaseUrl: string;

	constructor(apiBaseUrl: string = config.apiUrl) {
		this.apiBaseUrl = apiBaseUrl;
	}

	async preload(): Promise<void> {
		// Could warm up API connection or fetch popular regions
	}

	getCachedData(regionName: string): Species[] | null {
		return this.cache.get(regionName) || null;
	}

	async getSpeciesByRegion(regionName: string): Promise<Species[]> {
		// Check cache first
		const cached = this.cache.get(regionName);
		if (cached) {
			return cached;
		}

		// Fetch from API
		const url = `${this.apiBaseUrl}/regions/${encodeURIComponent(regionName)}/species`;

		try {
			return await profileApiQuery(url, async () => {
				const response = await fetch(url);

				if (!response.ok) {
					if (response.status === 404) {
						// Expected: region has no data
						throw new ServiceError(
							ServiceErrorCode.DATA_NOT_FOUND,
							`No species data found for region: ${regionName}`,
							{ regionName, status: 404 }
						);
					}

					// Network/server error
					throw new ServiceError(
						ServiceErrorCode.NETWORK_ERROR,
						`HTTP ${response.status}: ${response.statusText}`,
						{ regionName, status: response.status, statusText: response.statusText }
					);
				}

				let result: unknown;
				try {
					result = await response.json();
				} catch (parseError) {
					// JSON parsing error
					throw new ServiceError(
						ServiceErrorCode.INVALID_DATA,
						`Failed to parse API response for region: ${regionName}`,
						{ regionName, parseError }
					);
				}

				// Handle both { data: [...] } and [...] response formats
				const species = Array.isArray(result)
					? result
					: ((result as { data?: unknown }).data ?? []);

				// Validate structure
				if (!Array.isArray(species)) {
					throw new ServiceError(
						ServiceErrorCode.INVALID_DATA,
						'Invalid API response format: expected array of species',
						{ regionName, dataType: typeof species }
					);
				}

				// Cache it
				this.cache.set(regionName, species as Species[]);

				return species as Species[];
			});
		} catch (err) {
			// Re-throw ServiceError as-is (already properly typed)
			if (err instanceof ServiceError) {
				throw err;
			}

			// Wrap unknown errors
			const message = err instanceof Error ? err.message : String(err);
			throw new ServiceError(
				ServiceErrorCode.UNKNOWN_ERROR,
				`Failed to load species for "${regionName}": ${message}`,
				{ regionName, originalError: err }
			);
		}
	}

	async getRegionStats(regionName: string): Promise<RegionStats> {
		// API can pre-calculate stats server-side (more efficient!)
		const url = `${this.apiBaseUrl}/regions/${encodeURIComponent(regionName)}/stats`;

		try {
			return await profileApiQuery(url, async () => {
				const response = await fetch(url);

				if (!response.ok) {
					if (response.status === 404) {
						// No stats for this region is treated as DATA_NOT_FOUND
						throw new ServiceError(
							ServiceErrorCode.DATA_NOT_FOUND,
							`No stats found for region: ${regionName}`,
							{ regionName, status: 404 }
						);
					}

					throw new ServiceError(
						ServiceErrorCode.NETWORK_ERROR,
						`HTTP ${response.status}: ${response.statusText}`,
						{ regionName, status: response.status, statusText: response.statusText }
					);
				}

				let result: unknown;
				try {
					result = await response.json();
				} catch (parseError) {
					throw new ServiceError(
						ServiceErrorCode.INVALID_DATA,
						`Failed to parse stats response for region: ${regionName}`,
						{ regionName, parseError }
					);
				}

				// Basic structural validation
				const payload = Array.isArray(result)
					? null
					: ((result as { data?: unknown }).data ?? result);
				const stats = payload as Partial<RegionStats> & {
					total_species?: number;
					family_count?: number;
					top_families?: Array<{ family: string; count: number }>;
				};
				const normalized: RegionStats = {
					totalSpecies:
						typeof stats.totalSpecies === 'number'
							? stats.totalSpecies
							: typeof stats.total_species === 'number'
								? stats.total_species
								: NaN,
					familyCount:
						typeof stats.familyCount === 'number'
							? stats.familyCount
							: typeof stats.family_count === 'number'
								? stats.family_count
								: NaN,
					topFamilies: Array.isArray(stats.topFamilies)
						? stats.topFamilies
						: Array.isArray(stats.top_families)
							? stats.top_families
							: []
				};

				if (
					typeof normalized.totalSpecies !== 'number' ||
					Number.isNaN(normalized.totalSpecies) ||
					typeof normalized.familyCount !== 'number' ||
					Number.isNaN(normalized.familyCount) ||
					!Array.isArray(normalized.topFamilies)
				) {
					throw new ServiceError(ServiceErrorCode.INVALID_DATA, 'Invalid stats response format', {
						regionName,
						result
					});
				}

				return normalized;
			});
		} catch (err) {
			if (err instanceof ServiceError) {
				throw err;
			}

			const message = err instanceof Error ? err.message : String(err);
			throw new ServiceError(
				ServiceErrorCode.UNKNOWN_ERROR,
				`Failed to load stats for "${regionName}": ${message}`,
				{ regionName, originalError: err }
			);
		}
	}

	async cleanup(): Promise<void> {
		this.cache.clear();
	}
}

/**
 * Example backend implementation (SvelteKit):
 *
 * // src/routes/api/v1/regions/[region]/species/+server.ts
 * import { json } from '@sveltejs/kit';
 * import type { RequestHandler } from './$types';
 * import db from '$lib/server/database';
 *
 * export const GET: RequestHandler = async ({ params }) => {
 *   const species = await db.query(
 *     'SELECT wcfp_id, name, authors, family FROM species WHERE area = ?',
 *     [params.region]
 *   );
 *   return json(species);
 * };
 *
 * // src/routes/api/v1/regions/[region]/stats/+server.ts
 * export const GET: RequestHandler = async ({ params }) => {
 *   const stats = await db.query(`
 *     SELECT
 *       COUNT(*) as totalSpecies,
 *       COUNT(DISTINCT family) as familyCount,
 *       family,
 *       COUNT(*) as count
 *     FROM species
 *     WHERE area = ?
 *     GROUP BY family
 *     ORDER BY count DESC
 *     LIMIT 10
 *   `, [params.region]);
 *   return json(stats);
 * };
 */
