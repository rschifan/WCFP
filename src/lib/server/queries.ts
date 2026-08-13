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
	area: string;
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
}

export interface DistributionRow {
	code: string;
	name: string;
	count?: number;
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
		...(row.lifeform ? { lifeform: row.lifeform } : {}),
		...(row.cwr ? { cwr: true } : {}),
		...(uses ? { uses } : {}),
		...(row.source_link ? { sourceLink: row.source_link } : {}),
		...(row.references_all ? { referencesAll: parseReferencesAll(row.references_all) } : {})
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
			COALESCE(rs.family_count,  0)            AS family_count
		FROM regions r
		LEFT JOIN region_stats rs USING (area)
		WHERE r.code != 'ANT'`
	);
}

/**
 * All region stats (area, total_species, family_count).
 */
export async function getAllRegionStats(conn: Connection): Promise<RegionStats[]> {
	return query<RegionStats>(
		conn,
		`SELECT rs.area, r.code, rs.total_species, rs.family_count
		 FROM region_stats rs
		 JOIN regions r USING (area)`
	);
}

/**
 * Stats for a single region.
 */
export async function getRegionStats(conn: Connection, area: string): Promise<RegionStats | null> {
	const rows = await query<RegionStats>(
		conn,
		`SELECT rs.area, r.code, rs.total_species, rs.family_count
		 FROM region_stats rs
		 JOIN regions r USING (area)
		 WHERE rs.area = ?`,
		[area]
	);
	return rows[0] ?? null;
}

/**
 * Top 10 families for a region.
 */
export async function getRegionTopFamilies(conn: Connection, area: string): Promise<TopFamily[]> {
	return query<TopFamily>(
		conn,
		`SELECT area, family, cnt, rank FROM region_top_families WHERE area = ? ORDER BY rank`,
		[area]
	);
}

export async function getRegionTaxonomyAvailableLifeforms(
	conn: Connection,
	area: string
): Promise<string[]> {
	const rows = await query<{ lifeform: string }>(
		conn,
		`SELECT DISTINCT s.lifeform AS lifeform
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
		 WHERE d.area = ?
		   AND s.lifeform IS NOT NULL
		   AND TRIM(s.lifeform) != ''
		 ORDER BY s.lifeform`,
		[area]
	);

	return rows.map((row) => row.lifeform);
}

export async function getRegionTaxonomyFamilyRows(
	conn: Connection,
	area: string
): Promise<RegionTaxonomyFamilyRow[]> {
	return query<RegionTaxonomyFamilyRow>(
		conn,
		`SELECT family, species_count, genus_count
		 FROM region_family_taxonomy
		 WHERE area = ?
		 ORDER BY species_count DESC, family`,
		[area]
	);
}

export async function getRegionTaxonomyGenusRows(
	conn: Connection,
	area: string,
	family: string
): Promise<RegionTaxonomyGenusRow[]> {
	return query<RegionTaxonomyGenusRow>(
		conn,
		`SELECT family, genus, species_count
		 FROM region_genus_taxonomy
		 WHERE area = ? AND family = ?
		 ORDER BY species_count DESC, genus`,
		[area, family]
	);
}

export async function getRegionTaxonomySpeciesRows(
	conn: Connection,
	area: string,
	family: string,
	genus: string
): Promise<SpeciesRow[]> {
	return query<SpeciesRow>(
		conn,
		`SELECT s.wcfp_id, s.taxon_name, s.authors, s.family, s.genus,
				s.lifeform, s.cwr, s.use_human_food,
				s.use_animal_food, s.use_environmental, s.use_fuels, s.use_gene_sources,
				s.use_invertebrate_food, s.use_materials, s.use_medicines,
				s.use_poisons, s.use_social_uses, s.source_link, s.references_all, s.uses_total
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
		 WHERE d.area = ?
		   AND COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown') = ?
		   AND COALESCE(NULLIF(TRIM(s.genus), ''), 'Unknown') = ?
		 ORDER BY s.taxon_name`,
		[area, family, genus]
	);
}

export async function queryRegionTaxonomyMatchedFamilies(
	conn: Connection,
	area: string,
	searchQuery: string
): Promise<RegionTaxonomyFamilyRow[]> {
	const substring = `%${searchQuery.trim().toLowerCase()}%`;

	return query<RegionTaxonomyFamilyRow>(
		conn,
		`SELECT family, species_count, genus_count
		 FROM region_family_taxonomy
		 WHERE area = ?
		   AND LOWER(family) LIKE ?
		 ORDER BY species_count DESC, family
		 LIMIT 500`,
		[area, substring]
	);
}

export async function queryRegionTaxonomyMatchedGenera(
	conn: Connection,
	area: string,
	searchQuery: string
): Promise<RegionTaxonomyGenusRow[]> {
	const substring = `%${searchQuery.trim().toLowerCase()}%`;

	return query<RegionTaxonomyGenusRow>(
		conn,
		`SELECT family, genus, species_count
		 FROM region_genus_taxonomy
		 WHERE area = ?
		   AND LOWER(genus) LIKE ?
		 ORDER BY species_count DESC, genus
		 LIMIT 500`,
		[area, substring]
	);
}

export async function queryRegionTaxonomyMatchedSpecies(
	conn: Connection,
	area: string,
	params: {
		q?: string;
		geographicOnly?: boolean;
		lifeforms?: string[];
		uses?: SpeciesUseKey[];
		includeTaxonomyNameMatches?: boolean;
	}
): Promise<SpeciesRow[]> {
	const conditions: string[] = ['d.area = ?'];
	const queryParams: unknown[] = [area];
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
				s.use_poisons, s.use_social_uses, s.source_link, s.references_all, s.uses_total
		 FROM distribution d
		 JOIN species s USING (wcfp_id)
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
	area: string,
	filters: {
		lifeforms?: string[];
		cwr?: boolean;
		uses?: string[];
		limit?: number;
		offset?: number;
	} = {}
): Promise<Species[]> {
	const conditions: string[] = ['d.area = ?'];
	const params: unknown[] = [area];

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
 * Returns area → species count.
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
			`SELECT r.code, r.area AS name
			 FROM distribution d
			 JOIN regions r USING (area)
			 WHERE d.wcfp_id = ?
			 GROUP BY r.code, r.area
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
			 JOIN regions r USING (area)
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
		`SELECT wcfp_id, taxon_name, authors, family, genus, lifeform, cwr, use_human_food,
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
