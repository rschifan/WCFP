import type { SpeciesDataProvider } from '../SpeciesDataProvider';
import type { Species, RegionStats } from '$lib/types/species';
import { ServiceError, ServiceErrorCode } from '../../errors';

/**
 * API-based species data provider (Future Implementation).
 * Fetches data from backend REST API endpoints.
 *
 * Features:
 * - Server-side computation (stats calculated on backend)
 * - Smaller payloads (only requested data)
 * - Real-time data updates
 * - Authentication support
 *
 * Usage:
 * 1. Implement backend API endpoints:
 *    - GET /api/species/:regionName - Returns species array
 *    - GET /api/species/:regionName/stats - Returns aggregated stats
 * 2. Change config.ts: speciesProvider = 'api'
 * 3. Deploy with SvelteKit adapter-node or similar
 */
export class ApiSpeciesProvider implements SpeciesDataProvider {
	private cache = new Map<string, Species[]>();
	private readonly apiUrl: string;

	constructor(apiUrl = '/api/species') {
		this.apiUrl = apiUrl;
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
		const url = `${this.apiUrl}/${encodeURIComponent(regionName)}`;

		try {
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
			const species = Array.isArray(result) ? result : ((result as { data?: unknown }).data ?? []);

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
		const url = `${this.apiUrl}/${encodeURIComponent(regionName)}/stats`;

		try {
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
			const stats = result as Partial<RegionStats>;
			if (
				typeof stats.totalSpecies !== 'number' ||
				typeof stats.familyCount !== 'number' ||
				!Array.isArray(stats.topFamilies)
			) {
				throw new ServiceError(ServiceErrorCode.INVALID_DATA, 'Invalid stats response format', {
					regionName,
					result
				});
			}

			return stats as RegionStats;
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
 * // src/routes/api/species/[region]/+server.ts
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
 * // src/routes/api/species/[region]/stats/+server.ts
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
