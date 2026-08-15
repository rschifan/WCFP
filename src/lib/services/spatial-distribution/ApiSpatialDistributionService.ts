/**
 * ApiSpatialDistributionService
 *
 * Executes a single DB-backed API request per taxonomy node selection.
 */

import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
import type { ISpatialDistributionService } from '$lib/types/spatial-distribution';
import { ServiceError, ServiceErrorCode } from '../errors';
import { profileApiQuery } from '$lib/utils/api-profiler';
import { config } from '../config';

interface DistributionApiRow {
	code: string;
	name?: string;
	count?: number;
}

// Rank names that map to indexed columns in the species table.
// This is a closed whitelist — never interpolated from user input on the server.
const VALID_API_RANKS = new Set(['kingdom', 'phylum', 'class', 'order', 'family', 'genus']);

// Maximum time to wait for a distribution API response (ms)
const FETCH_TIMEOUT_MS = 10_000;

export class ApiSpatialDistributionService implements ISpatialDistributionService {
	private readonly apiBaseUrl: string;

	constructor(apiBaseUrl: string = config.apiUrl) {
		this.apiBaseUrl = apiBaseUrl;
	}

	async getDistributionForNode(
		node: TaxonomyNodeNormalized,
		abortSignal?: AbortSignal
	): Promise<Map<string, number>> {
		let url: string;

		if (node.rank === 'species' && typeof node.wcfpId === 'number') {
			url = `${this.apiBaseUrl}/distribution?rank=species&wcfp_id=${node.wcfpId}`;
		} else if (VALID_API_RANKS.has(node.rank)) {
			url = `${this.apiBaseUrl}/distribution?rank=${encodeURIComponent(node.rank)}&name=${encodeURIComponent(node.name)}`;
		} else {
			return new Map();
		}

		if (abortSignal?.aborted) {
			throw new ServiceError(ServiceErrorCode.ABORTED, 'Request aborted');
		}

		// Combine the caller's AbortSignal with a local timeout
		const timeoutController = new AbortController();
		const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);
		const combinedSignal = abortSignal
			? AbortSignal.any([abortSignal, timeoutController.signal])
			: timeoutController.signal;

		const distribution = await profileApiQuery(
			url,
			async () => {
				let res: Response;
				try {
					res = await fetch(url, {
						signal: combinedSignal,
						cache: 'no-store'
					});
				} catch (err) {
					if (err instanceof Error && err.name === 'AbortError') {
						throw new ServiceError(ServiceErrorCode.ABORTED, 'Request aborted');
					}
					throw new ServiceError(ServiceErrorCode.NETWORK_ERROR, `Fetch failed: ${String(err)}`);
				} finally {
					clearTimeout(timeoutId);
				}

				if (!res.ok) {
					throw new ServiceError(ServiceErrorCode.NETWORK_ERROR, `HTTP ${res.status} from ${url}`);
				}

				const body = (await res.json()) as { data: DistributionApiRow[] };
				return new Map(
					body.data.map((row) => [row.code, typeof row.count === 'number' ? Number(row.count) : 1])
				);
			},
			{
				shouldLogError: (error) =>
					!(error instanceof ServiceError && error.code === ServiceErrorCode.ABORTED)
			}
		);

		return distribution;
	}

	clearCache(): void {
		// Distribution requests intentionally do not use a client-side cache.
	}
}
