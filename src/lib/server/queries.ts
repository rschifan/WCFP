/**
 * Typed SQL query functions for DuckDB.
 *
 * All functions accept a Connection as the first argument.
 * Callers are responsible for opening and closing connections.
 */

import { query } from './database.js';
import type { Connection } from 'duckdb';
import type { Species, SpeciesUseKey } from '$lib/types/species';
import type {
	OccurrenceStatusFilter,
	TaxonomicRank,
	TaxonomyNodeNormalized,
	TaxonomyTraitEntry
} from '$lib/types/taxonomy';
import { SPECIES_USE_ORDER } from '$lib/constants/portal-help';
import { buildSpeciesUsesFromFlags, parseReferencesAll } from '$lib/utils/species/metadata';

// ── FTS index name (matches PRAGMA create_fts_index('species', ...)) ─────────
const FTS_INDEX = 'fts_main_species';
const FTS_FIELDS = 'taxon_name,family,genus,authors';

// ── Rank column whitelist (never interpolated from user input) ────────────────
const RANK_COLUMN: Record<string, string> = {
	kingdom: 'kingdom',
	phylum: 'phylum',
	class: 'class',
	order: '"order"',
	family: 'family',
	genus: 'genus'
};

// ── Use column whitelist ──────────────────────────────────────────────────────
const USE_COLS: Record<string, string> = {
	humanFood: 'use_human_food',
	animalFood: 'use_animal_food',
	environmentalUses: 'use_environmental',
	fuels: 'use_fuels',
	geneSources: 'use_gene_sources',
	invertebrateFood: 'use_invertebrate_food',
	materials: 'use_materials',
	medicines: 'use_medicines',
	poisons: 'use_poisons',
	socialUses: 'use_social_uses'
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegionStats {
	area: string;
	code: string;
	total_species: number;
	family_count: number;
}

export interface TopFamily {
	code: string;
	family: string;
	cnt: number;
	rank: number;
}

export interface RegionTaxonomyFamilyRow {
	family: string;
	species_count: number;
	genus_count: number;
}

export interface RegionTaxonomyGenusRow {
	family: string;
	genus: string;
	species_count: number;
}

export interface SpeciesRow {
	wcfp_id: number;
	taxon_name: string;
	authors: string;
	family: string;
	genus: string;
	/** Ranks above family, selected only by `getSpeciesById`. */
	kingdom?: string;
	phylum?: string;
	class?: string;
	order?: string;
	lifeform: string | null;
	cwr: boolean;
	use_human_food: boolean;
	use_animal_food: boolean;
	use_environmental: boolean;
	use_fuels: boolean;
	use_gene_sources: boolean;
	use_invertebrate_food: boolean;
	use_materials: boolean;
	use_medicines: boolean;
	use_poisons: boolean;
	use_social_uses: boolean;
	source_link: string;
	references_all: string;
	uses_total: number;
	/** Present only for region-scoped queries: this taxon's status in that region. */
	occurrence_status?: OccurrenceStatus;
	/**
	 * Areas worldwide, not in this region — a per-region count would always be 1. Region-scoped
	 * queries join it from `taxonomy_nodes` so the species row can offer its distribution map.
	 */
	distribution_area_count?: number;
}

export interface TaxonomyNodeRow {
	node_id: string;
	parent_id: string | null;
	path: string;
	rank: TaxonomicRank;
	depth: number;
	name: string;
	name_lower: string;
	count: number;
	child_count: number;
	wcfp_id: number | null;
	authors: string;
	has_distribution: boolean;
	distribution_area_count: number;
	has_cwr: boolean;
	lifeforms_json: string;
	use_mask: number;
}

export interface GeoFeatureRow {
	area: string;
	code: string;
	geometry: string;
	unique_count: number;
	family_count: number;
	flora_richness: number;
	pct_of_flora: number;
}

export interface DistributionRow {
	code: string;
	name: string;
	count?: number;
	/** Species rows only. Higher ranks aggregate many species, so no single status applies. */
	occurrenceStatus?: OccurrenceStatusFilter;
}

export function mapSpeciesRow(row: SpeciesRow): Species {
	const uses = buildSpeciesUsesFromFlags({
		total: row.uses_total,
		humanFood: row.use_human_food,
		animalFood: row.use_animal_food,
		environmentalUses: row.use_environmental,
		fuels: row.use_fuels,
		geneSources: row.use_gene_sources,
		invertebrateFood: row.use_invertebrate_food,
		materials: row.use_materials,
		medicines: row.use_medicines,
		poisons: row.use_poisons,
		socialUses: row.use_social_uses
	});

	return {
		wcfpId: row.wcfp_id,
		name: row.taxon_name,
		authors: row.authors,
		family: row.family,
		genus: row.genus,
		...(row.kingdom ? { kingdom: row.kingdom } : {}),
		...(row.phylum ? { phylum: row.phylum } : {}),
		...(row.class ? { class: row.class } : {}),
		...(row.order ? { order: row.order } : {}),
		...(row.lifeform ? { lifeform: row.lifeform } : {}),
		...(row.cwr ? { cwr: true } : {}),
		...(uses ? { uses } : {}),
		...(row.source_link ? { sourceLink: row.source_link } : {}),
		...(row.references_all ? { referencesAll: parseReferencesAll(row.references_all) } : {}),
		...(row.occurrence_status ? { occurrenceStatus: row.occurrence_status } : {})
	};
}

function decodeUseMask(useMask: number): SpeciesUseKey[] {
	return SPECIES_USE_ORDER.filter((useKey, index) => (useMask & (1 << index)) !== 0);
}

function parseLifeformsJson(value: string): string[] {
	if (!value) return [];

	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? parsed.filter(
					(entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
				)
			: [];
	} catch {
		return [];
	}
}

export function mapTaxonomyNodeRow(
	row: TaxonomyNodeRow,
	options: { childrenLoaded?: boolean } = {}
): TaxonomyNodeNormalized {
	const traits: TaxonomyTraitEntry = {
		lifeforms: parseLifeformsJson(row.lifeforms_json),
		uses: decodeUseMask(row.use_mask),
		hasCwr: row.has_cwr || undefined
	};

	return {
		id: row.node_id,
		name: row.name,
		nameLower: row.name_lower,
		rank: row.rank,
		count: row.count,
		childCount: row.child_count,
		childrenIds: [],
		childrenLoaded: options.childrenLoaded ?? row.child_count === 0,
		parentId: row.parent_id,
		path: row.path,
		depth: row.depth,
		...(typeof row.wcfp_id === 'number' ? { wcfpId: row.wcfp_id } : {}),
		...(row.authors ? { authors: row.authors } : {}),
		...(row.has_distribution ? { hasDistribution: true } : {}),
		...(row.distribution_area_count > 0
			? { distributionAreaCount: row.distribution_area_count }
			: {}),
		...(traits.lifeforms.length > 0 || traits.uses.length > 0 || traits.hasCwr ? { traits } : {})
	};
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Enriched GeoJSON features — geometry + live species counts.
 * ST_Simplify reduces geometry size ~60% while preserving visual quality.
 */
export async function getGeoFeatures(conn: Connection): Promise<GeoFeatureRow[]> {
	return query<GeoFeatureRow>(
		conn,
		`SELECT
			r.area,
			r.code,
			ST_AsGeoJSON(ST_Simplify(r.geom, 0.01)) AS geometry,
			COALESCE(rs.total_species, 0)            AS unique_count,
			COALESCE(rs.family_count,  0)            AS family_count,
			r.flora_richness                         AS flora_richness,
			r.pct_of_flora                           AS pct_of_flora
		FROM regions r
		LEFT JOIN region_stats rs USING (code)`
	);
}

export interface ChecklistSummary {
	/** Every accepted record: species, hybrids and graft-chimaerae together. */
	taxa: number;
	/** Species-rank records only. */
	species: number;
	hybrids: number;
	graftChimaerae: number;
	genera: number;
	families: number;
	orders: number;
	classes: number;
	phyla: number;
	/** Edible crop wild relatives. */
	cwr: number;
	/**
	 * Cultivated taxa. Independent of `cwr` — the two GRIN fields are separate, so a taxon may be
	 * either, both or neither, and the counts deliberately do not sum to the total.
	 */
	cultivated: number;
	/** TDWG Level 3 areas the checklist covers. */
	areas: number;
	/** Taxa carrying at least one distribution record. */
	taxaWithDistribution: number;
	/** One row per (taxon, area) pair. */
	distributionRecords: number;
	/** Distribution records per occurrence status — records, not taxa. */
	occurrenceRecords: Record<OccurrenceStatus, number>;
	/** Taxa recorded in each use category. `humanFood` is every taxon; see below. */
	uses: Record<SpeciesUseKey, number>;
}

/**
 * The headline figures, straight from the data.
 *
 * These were literals in the markup until a post-submission audit found ten taxa entered twice and
 * the published total moved from 26,632 to 26,622 — which the pages went on displaying. Deriving
 * them means the site cannot disagree with the database it is serving.
 *
 * Two conventions come from the paper rather than from a column:
 *
 * - **Taxa versus species.** There is no rank column; the workbook does not carry one. A record is
 *   a hybrid or a graft-chimaera when its accepted name carries the `×` or `+` marker, which is how
 *   the paper defines the split. It yields the paper's own 201 and 2.
 *
 *   The marker is matched **anywhere in the name, deliberately**. Nothospecies carry it between
 *   genus and epithet — `Achillea × serrata` — not at the front, so anchoring the match to the
 *   first character finds 10 of the 201. Do not "tighten" this to a prefix.
 * - **Human food is the inclusion criterion, not a facet.** Only taxa with a documented human food
 *   use entered the checklist, so `uses.humanFood` equals `taxa` by construction. The other nine
 *   categories are additional uses, and presenting them as a distribution alongside human food
 *   would invite a comparison the data does not support.
 *
 * Rank counts are `COUNT(DISTINCT …)` over `species`, not a tally of `taxonomy_nodes`. Those nodes
 * are path-scoped, so a name reachable by more than one lineage becomes more than one node: the tree
 * holds 419 family and 5,015 genus nodes against the published 412 and 5,009.
 */
export async function getChecklistSummary(conn: Connection): Promise<ChecklistSummary> {
	const [totals] = await query<{
		taxa: number;
		hybrids: number;
		graft_chimaerae: number;
		genera: number;
		families: number;
		orders: number;
		classes: number;
		phyla: number;
		cwr: number;
		cultivated: number;
		use_human_food: number;
		use_animal_food: number;
		use_environmental: number;
		use_fuels: number;
		use_gene_sources: number;
		use_invertebrate_food: number;
		use_materials: number;
		use_medicines: number;
		use_poisons: number;
		use_social_uses: number;
	}>(
		conn,
		`SELECT
			COUNT(*)                                             AS taxa,
			COUNT(*) FILTER (WHERE taxon_name LIKE '%×%')        AS hybrids,
			COUNT(*) FILTER (WHERE taxon_name LIKE '%+%')        AS graft_chimaerae,
			COUNT(DISTINCT genus)                                AS genera,
			COUNT(DISTINCT family)                               AS families,
			COUNT(DISTINCT "order")                              AS orders,
			COUNT(DISTINCT class)                                AS classes,
			COUNT(DISTINCT phylum)                               AS phyla,
			COUNT(*) FILTER (WHERE cwr)                          AS cwr,
			COUNT(*) FILTER (WHERE cultivated)                   AS cultivated,
			COUNT(*) FILTER (WHERE use_human_food)               AS use_human_food,
			COUNT(*) FILTER (WHERE use_animal_food)              AS use_animal_food,
			COUNT(*) FILTER (WHERE use_environmental)            AS use_environmental,
			COUNT(*) FILTER (WHERE use_fuels)                    AS use_fuels,
			COUNT(*) FILTER (WHERE use_gene_sources)             AS use_gene_sources,
			COUNT(*) FILTER (WHERE use_invertebrate_food)        AS use_invertebrate_food,
			COUNT(*) FILTER (WHERE use_materials)                AS use_materials,
			COUNT(*) FILTER (WHERE use_medicines)                AS use_medicines,
			COUNT(*) FILTER (WHERE use_poisons)                  AS use_poisons,
			COUNT(*) FILTER (WHERE use_social_uses)              AS use_social_uses
		 FROM species`
	);

	const [coverage] = await query<{
		areas: number;
		taxa_with_distribution: number;
		distribution_records: number;
	}>(
		conn,
		`SELECT
			(SELECT COUNT(*) FROM regions)                     AS areas,
			(SELECT COUNT(DISTINCT wcfp_id) FROM distribution) AS taxa_with_distribution,
			(SELECT COUNT(*) FROM distribution)                AS distribution_records`
	);

	// Records rather than taxa: `getStatusFacets` counts distinct taxa per status, which is the
	// right figure for a filter rail and the wrong one here — a taxon native in one area and
	// introduced in another belongs to both buckets, so those counts do not sum to the total.
	const statusRows = await query<{ occurrence_status: OccurrenceStatus; count: number }>(
		conn,
		`SELECT occurrence_status, COUNT(*) AS count FROM distribution GROUP BY occurrence_status`
	);
	const occurrenceRecords = { native: 0, introduced: 0, extinct: 0, doubtful: 0 };
	for (const row of statusRows) {
		if (row.occurrence_status in occurrenceRecords) {
			occurrenceRecords[row.occurrence_status] = row.count;
		}
	}

	const markers = totals.hybrids + totals.graft_chimaerae;

	return {
		taxa: totals.taxa,
		species: totals.taxa - markers,
		hybrids: totals.hybrids,
		graftChimaerae: totals.graft_chimaerae,
		genera: totals.genera,
		families: totals.families,
		orders: totals.orders,
		classes: totals.classes,
		phyla: totals.phyla,
		cwr: totals.cwr,
		cultivated: totals.cultivated,
		areas: coverage.areas,
		taxaWithDistribution: coverage.taxa_with_distribution,
		distributionRecords: coverage.distribution_records,
		occurrenceRecords,
		uses: {
			humanFood: totals.use_human_food,
			animalFood: totals.use_animal_food,
			environmentalUses: totals.use_environmental,
			fuels: totals.use_fuels,
			geneSources: totals.use_gene_sources,
			invertebrateFood: totals.use_invertebrate_food,
			materials: totals.use_materials,
			medicines: totals.use_medicines,
			poisons: totals.use_poisons,
			socialUses: totals.use_social_uses
		}
	};
}

/**
 * All region stats, keyed by TDWG3 code.
 */
export async function getAllRegionStats(conn: Connection): Promise<RegionStats[]> {
	return query<RegionStats>(
		conn,
		`SELECT r.area, r.code, rs.total_species, rs.family_count
		 FROM region_stats rs
		 JOIN regions r USING (code)`
	);
}

/**
 * Stats for a single region.
 */
export async function getRegionStats(conn: Connection, code: string): Promise<RegionStats | null> {
	const rows = await query<RegionStats>(
		conn,
		`SELECT r.area, r.code, rs.total_species, rs.family_count
		 FROM region_stats rs
		 JOIN regions r USING (code)
		 WHERE rs.code = ?`,
		[code]
	);
	return rows[0] ?? null;
}

/**
 * Occurrence statuses the map can filter by. These are the values of the published
 * `occurrence_status` field, which is a single resolved classification per (area, taxon).
 *
 * Deliberately filtered on that field rather than on the raw `introduced` flag: 27 records are
 * flagged both introduced and location-doubtful, and the paper resolves them to `doubtful`. The
 * paper is the authority, so `introduced` here means "what the paper calls introduced" (97,799
 * records), not "has the introduced flag set" (97,826).
 */
export const OCCURRENCE_STATUSES = ['native', 'introduced', 'extinct', 'doubtful'] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export interface RegionCount {
	code: string;
	count: number;
}

/**
 * Per-region taxon counts restricted to one occurrence status.
 *
 * Regions with no records of that status are omitted rather than returned as zero, so the map
 * greys them out instead of colouring them at the bottom of the scale.
 */
export async function getRegionCountsByStatus(
	conn: Connection,
	status: OccurrenceStatus
): Promise<RegionCount[]> {
	return query<RegionCount>(
		conn,
		`SELECT code, COUNT(DISTINCT wcfp_id) AS count
		 FROM distribution
		 WHERE occurrence_status = ?
		 GROUP BY code
		 ORDER BY code`,
		[status]
	);
}

export interface StatusFacet {
	occurrence_status: OccurrenceStatus;
	count: number;
}

/**
 * Taxa per occurrence status, for one region or across all of them.
 *
 * Drives the facet counts in the filter rail. Showing the size of each bucket before it is
 * clicked is what turns the filter into a finding, and it costs one grouped scan.
 */
export async function getStatusFacets(
	conn: Connection,
	code?: string | null
): Promise<StatusFacet[]> {
	const scoped = typeof code === 'string' && code.length > 0;
	return query<StatusFacet>(
		conn,
		`SELECT occurrence_status, COUNT(DISTINCT wcfp_id) AS count
		 FROM distribution
		 ${scoped ? 'WHERE code = ?' : ''}
		 GROUP BY occurrence_status`,
		scoped ? [code] : []
	);
}

/**
 * Top 10 families for a region.
 */
export async function getRegionTopFamilies(conn: Connection, code: string): Promise<TopFamily[]> {
	return query<TopFamily>(
		conn,
		`SELECT code, family, cnt, rank FROM region_top_families WHERE code = ? ORDER BY rank`,
		[code]
	);
}

export async function getRegionTaxonomyAvailableLifeforms(
	conn: Connection,
	code: string
): Promise<string[]> {
	const rows = await query<{ lifeform: string }>(
		conn,
		`SELECT DISTINCT s.lifeform AS lifeform
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
		 WHERE d.code = ?
		   AND s.lifeform IS NOT NULL
		   AND TRIM(s.lifeform) != ''
		 ORDER BY s.lifeform`,
		[code]
	);

	return rows.map((row) => row.lifeform);
}

export async function getRegionTaxonomyFamilyRows(
	conn: Connection,
	code: string,
	status?: OccurrenceStatus | null
): Promise<RegionTaxonomyFamilyRow[]> {
	if (!status) {
		return query<RegionTaxonomyFamilyRow>(
			conn,
			`SELECT family, species_count, genus_count
			 FROM region_family_taxonomy
			 WHERE code = ?
			 ORDER BY species_count DESC, family`,
			[code]
		);
	}

	return query<RegionTaxonomyFamilyRow>(
		conn,
		`SELECT
			COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown') AS family,
			COUNT(DISTINCT d.wcfp_id) AS species_count,
			COUNT(DISTINCT COALESCE(NULLIF(TRIM(s.genus), ''), 'Unknown')) AS genus_count
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
		 WHERE d.code = ? AND d.occurrence_status = ?
		 GROUP BY family
		 ORDER BY species_count DESC, family`,
		[code, status]
	);
}

export async function getRegionTaxonomyGenusRows(
	conn: Connection,
	code: string,
	family: string
): Promise<RegionTaxonomyGenusRow[]> {
	return query<RegionTaxonomyGenusRow>(
		conn,
		`SELECT family, genus, species_count
		 FROM region_genus_taxonomy
		 WHERE code = ? AND family = ?
		 ORDER BY species_count DESC, genus`,
		[code, family]
	);
}

export async function getRegionTaxonomyGenusRowsByStatus(
	conn: Connection,
	code: string,
	family: string,
	status: OccurrenceStatus
): Promise<RegionTaxonomyGenusRow[]> {
	return query<RegionTaxonomyGenusRow>(
		conn,
		`SELECT
			COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown') AS family,
			COALESCE(NULLIF(TRIM(s.genus), ''), 'Unknown') AS genus,
			COUNT(DISTINCT d.wcfp_id) AS species_count
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
		 WHERE d.code = ? AND d.occurrence_status = ?
		   AND COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown') = ?
		 GROUP BY family, genus
		 ORDER BY species_count DESC, genus`,
		[code, status, family]
	);
}

export async function getRegionTaxonomySpeciesRows(
	conn: Connection,
	code: string,
	family: string,
	genus: string,
	status?: OccurrenceStatus | null
): Promise<SpeciesRow[]> {
	return query<SpeciesRow>(
		conn,
		`SELECT s.wcfp_id, s.taxon_name, s.authors, s.family, s.genus,
				s.lifeform, s.cwr, s.use_human_food,
				s.use_animal_food, s.use_environmental, s.use_fuels, s.use_gene_sources,
				s.use_invertebrate_food, s.use_materials, s.use_medicines,
				s.use_poisons, s.use_social_uses, s.source_link, s.references_all, s.uses_total,
				d.occurrence_status, n.distribution_area_count
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
		 LEFT JOIN taxonomy_nodes n ON n.wcfp_id = s.wcfp_id AND n.rank = 'species'
		 WHERE d.code = ?
		   AND COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown') = ?
		   AND COALESCE(NULLIF(TRIM(s.genus), ''), 'Unknown') = ?
		   ${status ? 'AND d.occurrence_status = ?' : ''}
		 ORDER BY s.taxon_name`,
		status ? [code, family, genus, status] : [code, family, genus]
	);
}

export async function queryRegionTaxonomyMatchedFamilies(
	conn: Connection,
	code: string,
	searchQuery: string
): Promise<RegionTaxonomyFamilyRow[]> {
	const substring = `%${searchQuery.trim().toLowerCase()}%`;

	return query<RegionTaxonomyFamilyRow>(
		conn,
		`SELECT family, species_count, genus_count
		 FROM region_family_taxonomy
		 WHERE code = ?
		   AND LOWER(family) LIKE ?
		 ORDER BY species_count DESC, family
		 LIMIT 500`,
		[code, substring]
	);
}

export async function queryRegionTaxonomyMatchedGenera(
	conn: Connection,
	code: string,
	searchQuery: string
): Promise<RegionTaxonomyGenusRow[]> {
	const substring = `%${searchQuery.trim().toLowerCase()}%`;

	return query<RegionTaxonomyGenusRow>(
		conn,
		`SELECT family, genus, species_count
		 FROM region_genus_taxonomy
		 WHERE code = ?
		   AND LOWER(genus) LIKE ?
		 ORDER BY species_count DESC, genus
		 LIMIT 500`,
		[code, substring]
	);
}

export async function queryRegionTaxonomyMatchedSpecies(
	conn: Connection,
	code: string,
	params: {
		q?: string;
		geographicOnly?: boolean;
		lifeforms?: string[];
		uses?: SpeciesUseKey[];
		includeTaxonomyNameMatches?: boolean;
		occurrenceStatus?: OccurrenceStatus | null;
	}
): Promise<SpeciesRow[]> {
	const conditions: string[] = ['d.code = ?'];
	const queryParams: unknown[] = [code];

	if (params.occurrenceStatus) {
		conditions.push('d.occurrence_status = ?');
		queryParams.push(params.occurrenceStatus);
	}
	const searchQuery = params.q?.trim().toLowerCase() ?? '';

	if (params.lifeforms?.length) {
		const placeholders = params.lifeforms.map(() => '?').join(', ');
		conditions.push(`s.lifeform IN (${placeholders})`);
		queryParams.push(...params.lifeforms);
	}

	for (const useKey of params.uses ?? []) {
		const column = USE_COLS[useKey];
		if (column) {
			conditions.push(`s.${column} = TRUE`);
		}
	}

	if (searchQuery) {
		const substring = `%${searchQuery}%`;
		if (params.includeTaxonomyNameMatches === false) {
			conditions.push(`(LOWER(s.taxon_name) LIKE ? OR LOWER(s.authors) LIKE ?)`);
			queryParams.push(substring, substring);
		} else {
			conditions.push(
				`(
					LOWER(s.taxon_name) LIKE ?
					OR LOWER(s.authors) LIKE ?
					OR LOWER(COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown')) LIKE ?
					OR LOWER(COALESCE(NULLIF(TRIM(s.genus), ''), 'Unknown')) LIKE ?
				)`
			);
			queryParams.push(substring, substring, substring, substring);
		}
	}

	return query<SpeciesRow>(
		conn,
		`SELECT s.wcfp_id, s.taxon_name, s.authors, s.family, s.genus,
				s.lifeform, s.cwr, s.use_human_food,
				s.use_animal_food, s.use_environmental, s.use_fuels, s.use_gene_sources,
				s.use_invertebrate_food, s.use_materials, s.use_medicines,
				s.use_poisons, s.use_social_uses, s.source_link, s.references_all, s.uses_total,
				d.occurrence_status, n.distribution_area_count
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
		 LEFT JOIN taxonomy_nodes n ON n.wcfp_id = s.wcfp_id AND n.rank = 'species'
		 WHERE ${conditions.join(' AND ')}
		 ORDER BY s.family, s.genus, s.taxon_name
		 LIMIT 500`,
		queryParams
	);
}

/**
 * All species in a region, optionally filtered.
 *
 * Column names in WHERE clauses are resolved from closed whitelists (USE_COLS)
 * before being interpolated — they are never derived from user input.
 */
export async function getSpeciesForRegion(
	conn: Connection,
	code: string,
	filters: {
		lifeforms?: string[];
		cwr?: boolean;
		uses?: string[];
		limit?: number;
		offset?: number;
	} = {}
): Promise<Species[]> {
	const conditions: string[] = ['d.code = ?'];
	const params: unknown[] = [code];

	if (filters.lifeforms?.length) {
		const placeholders = filters.lifeforms.map(() => '?').join(', ');
		conditions.push(`s.lifeform IN (${placeholders})`);
		params.push(...filters.lifeforms);
	}

	if (filters.cwr === true) {
		conditions.push(`s.cwr = TRUE`);
	}

	// Column names come from a closed whitelist — never user-supplied
	for (const use of filters.uses ?? []) {
		const col = USE_COLS[use];
		if (col) conditions.push(`s.${col} = TRUE`);
	}

	// limit/offset are validated integers from the caller; parameterized here
	const limit = filters.limit ?? 5000;
	const offset = filters.offset ?? 0;
	params.push(limit, offset);

	const rows = await query<SpeciesRow>(
		conn,
		`SELECT s.wcfp_id, s.taxon_name, s.authors, s.family, s.genus,
				s.lifeform, s.cwr, s.use_human_food,
				s.use_animal_food, s.use_environmental, s.use_fuels, s.use_gene_sources,
				s.use_invertebrate_food, s.use_materials, s.use_medicines,
				s.use_poisons, s.use_social_uses, s.source_link, s.references_all, s.uses_total
		 FROM distribution d JOIN species s USING (wcfp_id)
		 WHERE ${conditions.join(' AND ')}
		 ORDER BY s.taxon_name
		 LIMIT ? OFFSET ?`,
		params
	);

	return rows.map(mapSpeciesRow);
}

/**
 * Distribution for a taxonomy node at a given rank.
 *
 * Species carry an occurrence status per area (native, introduced, extinct, doubtful) and no
 * count; higher ranks aggregate many species into a count and have no single status.
 *
 * @param rank    'species' | 'genus' | 'family' | 'order' | 'class' | 'phylum' | 'kingdom'
 * @param name    taxon name at that rank
 * @param wcfpId  required when rank === 'species'
 */
export async function getDistributionForRank(
	conn: Connection,
	rank: string,
	name: string,
	wcfpId?: number
): Promise<DistributionRow[]> {
	const tq0 = Date.now();
	let rows: DistributionRow[];

	if (rank === 'species') {
		if (wcfpId === undefined) return [];
		rows = await query<DistributionRow>(
			conn,
			// No GROUP BY: (wcfp_id, code) is unique in `distribution`, so grouping only
			// masked occurrence_status. Native and introduced ranges must stay distinguishable.
			`SELECT r.code, r.area AS name, d.occurrence_status AS "occurrenceStatus"
			 FROM distribution d
			 JOIN regions r USING (code)
			 WHERE d.wcfp_id = ?
			 ORDER BY r.code`,
			[wcfpId]
		);
	} else {
		// Column name from closed whitelist — not user-supplied
		const col = RANK_COLUMN[rank];
		if (!col) return [];

		rows = await query<DistributionRow>(
			conn,
			`SELECT r.code, r.area AS name, COUNT(DISTINCT d.wcfp_id) AS count
			 FROM distribution d
			 JOIN species s USING (wcfp_id)
			 JOIN regions r USING (code)
			 WHERE s.${col} = ?
			 GROUP BY r.code, r.area
			 HAVING count > 0
			 ORDER BY r.code`,
			[name]
		);
	}

	console.log(
		`[getDistributionForRank] rank=${rank} sql=${Date.now() - tq0}ms rows=${rows.length}`
	);
	return rows;
}

/**
 * A single species by wcfp_id.
 */
export async function getSpeciesById(conn: Connection, wcfpId: number): Promise<Species | null> {
	const rows = await query<SpeciesRow>(
		conn,
		// The lineage columns are selected here and nowhere else: this is the record the scheda
		// renders, and list queries have no use for ranks above family.
		`SELECT wcfp_id, taxon_name, authors, family, genus,
				kingdom, phylum, class, "order",
				lifeform, cwr, use_human_food,
				use_animal_food, use_environmental, use_fuels, use_gene_sources,
				use_invertebrate_food, use_materials, use_medicines,
				use_poisons, use_social_uses, source_link, references_all, uses_total
		 FROM species WHERE wcfp_id = ?`,
		[wcfpId]
	);
	return rows[0] ? mapSpeciesRow(rows[0]) : null;
}

/**
 * Full-text search on species (taxon_name, family, genus, authors).
 * Returns BM25-ranked results.
 *
 * BM25 score is computed once in a CTE to avoid double-evaluation.
 */
export async function searchSpecies(conn: Connection, q: string, limit = 50): Promise<Species[]> {
	const rows = await query<SpeciesRow>(
		conn,
		`WITH scored AS (
			SELECT wcfp_id,
				   ${FTS_INDEX}.match_bm25(wcfp_id, ?, fields := '${FTS_FIELDS}') AS score
			FROM species
			WHERE score IS NOT NULL
		)
		SELECT s.wcfp_id, s.taxon_name, s.authors, s.family, s.genus, s.lifeform, s.cwr, s.use_human_food,
			   s.use_animal_food, s.use_environmental, s.use_fuels, s.use_gene_sources,
			   s.use_invertebrate_food, s.use_materials, s.use_medicines,
			   s.use_poisons, s.use_social_uses, s.source_link, s.references_all, s.uses_total
		FROM scored
		JOIN species s USING (wcfp_id)
		ORDER BY scored.score DESC
		LIMIT ?`,
		[q, limit]
	);

	return rows.map(mapSpeciesRow);
}

export async function getTaxonomyAvailableLifeforms(conn: Connection): Promise<string[]> {
	const rows = await query<{ lifeform: string }>(
		conn,
		`SELECT DISTINCT lifeform
		 FROM species
		 WHERE lifeform IS NOT NULL AND TRIM(lifeform) != ''
		 ORDER BY lifeform`
	);

	return rows.map((row) => row.lifeform);
}

export async function getTaxonomyStartNodeId(conn: Connection): Promise<string> {
	const rows = await query<{ node_id: string }>(
		conn,
		`SELECT node_id
		 FROM taxonomy_nodes
		 WHERE rank = 'kingdom' AND name = 'Plantae'
		 ORDER BY node_id
		 LIMIT 1`
	);

	if (rows[0]?.node_id) {
		return rows[0].node_id;
	}

	const fallbackRows = await query<{ node_id: string }>(
		conn,
		`SELECT node_id
		 FROM taxonomy_nodes
		 WHERE parent_id = 'root'
		 ORDER BY sort_key, name
		 LIMIT 1`
	);

	return fallbackRows[0]?.node_id ?? 'root';
}

export async function getInitialTaxonomyRows(
	conn: Connection,
	initialDepth = 3
): Promise<TaxonomyNodeRow[]> {
	return query<TaxonomyNodeRow>(
		conn,
		`SELECT
			node_id,
			parent_id,
			path,
			rank,
			depth,
			name,
			name_lower,
			count,
			child_count,
			wcfp_id,
			authors,
			has_distribution,
			distribution_area_count,
			has_cwr,
			lifeforms_json,
			use_mask
		FROM taxonomy_nodes
		WHERE depth <= ?
		ORDER BY depth, sort_key, name`,
		[initialDepth]
	);
}

export async function getTaxonomyChildrenRows(
	conn: Connection,
	parentId: string
): Promise<TaxonomyNodeRow[]> {
	return query<TaxonomyNodeRow>(
		conn,
		`SELECT
			node_id,
			parent_id,
			path,
			rank,
			depth,
			name,
			name_lower,
			count,
			child_count,
			wcfp_id,
			authors,
			has_distribution,
			distribution_area_count,
			has_cwr,
			lifeforms_json,
			use_mask
		FROM taxonomy_nodes
		WHERE parent_id = ?
		ORDER BY sort_key, name`,
		[parentId]
	);
}

export async function queryTaxonomyRows(
	conn: Connection,
	params: {
		q?: string;
		geographicOnly?: boolean;
		lifeforms?: string[];
		uses?: SpeciesUseKey[];
	}
): Promise<TaxonomyNodeRow[]> {
	const searchQuery = params.q?.trim().toLowerCase() ?? '';
	const queryParams: unknown[] = [];
	const hasSpeciesTraitFilters =
		Boolean(params.geographicOnly) ||
		Boolean(params.lifeforms?.length) ||
		Boolean(params.uses?.length);

	if (!searchQuery && !hasSpeciesTraitFilters) {
		return [];
	}

	const ctes: string[] = [];

	if (searchQuery) {
		const substring = `%${searchQuery}%`;
		queryParams.push(substring, substring);
		ctes.push(`
			search_matches AS (
				SELECT n.node_id
				FROM taxonomy_nodes n
				WHERE n.name_lower LIKE ?
				UNION
				SELECT n.node_id
				FROM taxonomy_nodes n
				WHERE LOWER(n.authors) LIKE ?
			)
		`);
	}

	if (hasSpeciesTraitFilters) {
		const speciesConditions = [`n.rank = 'species'`];
		const speciesParams: unknown[] = [];

		if (params.geographicOnly) {
			speciesConditions.push(`n.has_distribution = TRUE`);
		}

		if (params.lifeforms?.length) {
			const placeholders = params.lifeforms.map(() => '?').join(', ');
			speciesConditions.push(`s.lifeform IN (${placeholders})`);
			speciesParams.push(...params.lifeforms);
		}

		for (const useKey of params.uses ?? []) {
			const column = USE_COLS[useKey];
			if (column) {
				speciesConditions.push(`s.${column} = TRUE`);
			}
		}

		queryParams.push(...speciesParams);
		ctes.push(`
			matched AS (
				SELECT n.node_id
				FROM taxonomy_nodes n
				JOIN species s ON s.wcfp_id = n.wcfp_id
				WHERE ${speciesConditions.join(' AND ')}
				${
					searchQuery
						? `AND EXISTS (
							SELECT 1
							FROM taxonomy_closure closure
							JOIN search_matches ON search_matches.node_id = closure.ancestor_id
							WHERE closure.descendant_id = n.node_id
						)`
						: ''
				}
				ORDER BY n.sort_key, n.name
				LIMIT 500
			)
		`);
	} else {
		ctes.push(`
			matched AS (
				SELECT node_id
				FROM search_matches
				LIMIT 500
			)
		`);
	}

	return query<TaxonomyNodeRow>(
		conn,
		`WITH ${ctes.join(',')},
			projected AS (
				SELECT DISTINCT closure.ancestor_id AS node_id
				FROM taxonomy_closure closure
			JOIN matched ON matched.node_id = closure.descendant_id
		)
		SELECT
			n.node_id,
			n.parent_id,
			n.path,
			n.rank,
			n.depth,
			n.name,
			n.name_lower,
			n.count,
			n.child_count,
			n.wcfp_id,
			n.authors,
			n.has_distribution,
			n.distribution_area_count,
			n.has_cwr,
			n.lifeforms_json,
			n.use_mask
		FROM taxonomy_nodes n
		JOIN projected p ON p.node_id = n.node_id
		ORDER BY n.depth, n.sort_key, n.name`,
		queryParams
	);
}
