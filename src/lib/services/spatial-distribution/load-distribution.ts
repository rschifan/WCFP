/**
 * Loading a taxon's distribution, for whichever host needs it.
 *
 * The dialog fetches this in the browser and the `/species/[wcfpId]` route fetches it during
 * `load`, so the URL shape and the row-to-map conversion live here once rather than being
 * rewritten per caller.
 *
 * Species and higher taxa return genuinely different things. A species is present in an area
 * with a status — native, introduced, extinct, doubtful — and every area counts the same. A
 * genus or family is present with a count of its species. Callers get whichever applies.
 */

import { base } from '$app/paths';
import type { OccurrenceStatusFilter, TaxonomyNodeNormalized } from '$lib/types/taxonomy';

/** Ranks with an indexed column on the species table. Closed list — never user input. */
const VALID_API_RANKS = new Set(['kingdom', 'phylum', 'class', 'order', 'family', 'genus']);

export interface DistributionApiRow {
	code: string;
	name?: string;
	count?: number;
	occurrenceStatus?: OccurrenceStatusFilter;
}

export type OccurrenceCounts = Record<OccurrenceStatusFilter, number>;

export interface DistributionArea {
	/** TDWG3 code — the identifier `/map/[region]` takes. */
	code: string;
	name: string;
}

export interface TaxonDistribution {
	/** Region code → count. For a species every value is 1: presence, not magnitude. */
	distributionData: Map<string, number>;
	/** Species only. Absent for higher taxa, which aggregate many species per area. */
	occurrenceData?: Map<string, OccurrenceStatusFilter>;
	/** Species only. Every class is present; the caller decides whether to show empty ones. */
	occurrenceCounts?: OccurrenceCounts;
	/**
	 * Species only: the areas per status, each sorted by name. The code travels with the name so
	 * a listed area can link straight to that region on the main map.
	 */
	areasByStatus?: Record<OccurrenceStatusFilter, DistributionArea[]>;
	areaCount: number;
}

export function buildDistributionUrl(node: TaxonomyNodeNormalized): string | null {
	if (node.rank === 'species' && typeof node.wcfpId === 'number') {
		return `${base}/api/v1/distribution?rank=species&wcfp_id=${node.wcfpId}`;
	}

	if (VALID_API_RANKS.has(node.rank)) {
		return `${base}/api/v1/distribution?rank=${encodeURIComponent(node.rank)}&name=${encodeURIComponent(node.name)}`;
	}

	return null;
}

export function speciesDistributionUrl(wcfpId: number): string {
	return `${base}/api/v1/distribution?rank=species&wcfp_id=${wcfpId}`;
}

const EMPTY_COUNTS: OccurrenceCounts = { native: 0, introduced: 0, extinct: 0, doubtful: 0 };

/** Shape API rows for the map, splitting the species and higher-taxon cases. */
export function buildTaxonDistribution(
	rows: readonly DistributionApiRow[],
	isSpecies: boolean
): TaxonDistribution {
	if (!isSpecies) {
		return {
			distributionData: new Map(
				rows.map((row) => [row.code, typeof row.count === 'number' ? Number(row.count) : 1])
			),
			areaCount: rows.length
		};
	}

	const distributionData = new Map<string, number>();
	const occurrenceData = new Map<string, OccurrenceStatusFilter>();
	const occurrenceCounts: OccurrenceCounts = { ...EMPTY_COUNTS };
	const areasByStatus: Record<OccurrenceStatusFilter, DistributionArea[]> = {
		native: [],
		introduced: [],
		extinct: [],
		doubtful: []
	};

	for (const row of rows) {
		distributionData.set(row.code, 1);
		const status = row.occurrenceStatus;
		if (!status) continue;

		occurrenceData.set(row.code, status);
		occurrenceCounts[status] += 1;
		if (row.name) areasByStatus[status].push({ code: row.code, name: row.name });
	}

	for (const areas of Object.values(areasByStatus)) {
		areas.sort((a, b) => a.name.localeCompare(b.name));
	}

	return {
		distributionData,
		occurrenceData,
		occurrenceCounts,
		areasByStatus,
		areaCount: rows.length
	};
}

type FetchLike = typeof globalThis.fetch;

/** Fetch and shape a taxon's distribution. Throws on a non-OK response. */
export async function loadTaxonDistribution(
	node: TaxonomyNodeNormalized,
	options: { fetch?: FetchLike; signal?: AbortSignal } = {}
): Promise<TaxonDistribution> {
	const url = buildDistributionUrl(node);
	if (!url) return { distributionData: new Map(), areaCount: 0 };

	const doFetch = options.fetch ?? globalThis.fetch;
	const response = await doFetch(url, { signal: options.signal, cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`Failed to load distribution: ${response.status}`);
	}

	const body = (await response.json()) as { data: DistributionApiRow[] };
	return buildTaxonDistribution(body.data ?? [], node.rank === 'species');
}
