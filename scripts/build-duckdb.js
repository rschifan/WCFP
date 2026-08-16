#!/usr/bin/env node

/**
 * Build DuckDB database from source data files.
 *
 * The R1 files deposited with the paper are the single source of truth. Regions are keyed by
 * TDWG Level-3 code, never by name: names are display labels that change between dataset
 * vintages, and joining on them silently dropped 15 populated areas.
 *
 * Input:
 *   - data/WCFP.xlsx                    (26,622 taxa, sheet "WCFP", with taxonomy + uses)
 *   - data/geo_distr_taxa_ISO_R1.csv    (376,373 distribution rows, with occurrence_status)
 *   - data/TDWG3_count_wcfp_ISO_R1.csv  (367 areas: codes, names, ISO, published counts,
 *                                        flora_richness, pct_of_flora)
 *   - data/wgsrpd-master/level3/level3.shp  (TDWG Level-3 geometries — geometry only)
 *
 * Output:
 *   - data/wcfp.duckdb
 *
 * Usage:
 *   node scripts/build-duckdb.js
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync, statSync } from 'fs';
import { buildSpeciesRecordFromRow, readWcfpRows } from './lib/wcfp-workbook.js';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const INPUT_XLSX = path.join(ROOT, 'data/WCFP.xlsx');
const INPUT_CSV = path.join(ROOT, 'data/geo_distr_taxa_ISO_R1.csv');
const INPUT_COUNTS = path.join(ROOT, 'data/TDWG3_count_wcfp_ISO_R1.csv');
const INPUT_SHP = path.join(ROOT, 'data/wgsrpd-master/level3/level3.shp');
const OUTPUT_DB = path.join(ROOT, 'data/wcfp.duckdb');
const TAXONOMY_USE_KEYS = [
	'humanFood',
	'animalFood',
	'medicines',
	'materials',
	'fuels',
	'geneSources',
	'poisons',
	'invertebrateFood',
	'environmentalUses',
	'socialUses'
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function run(conn, sql) {
	return new Promise((resolve, reject) => {
		conn.run(sql, (err) => (err ? reject(err) : resolve()));
	});
}

function exec(conn, sql, params = []) {
	return new Promise((resolve, reject) => {
		conn.all(sql, ...params, (err, rows) => (err ? reject(err) : resolve(rows)));
	});
}

function prepare(conn, sql) {
	return new Promise((resolve, reject) => {
		const stmt = conn.prepare(sql, (err) => (err ? reject(err) : resolve(stmt)));
	});
}

function stmtRun(stmt, params) {
	return new Promise((resolve, reject) => {
		stmt.run(...params, (err) => (err ? reject(err) : resolve()));
	});
}

function stmtFinalize(stmt) {
	return new Promise((resolve, reject) => {
		stmt.finalize((err) => (err ? reject(err) : resolve()));
	});
}

async function loadExtension(conn, name) {
	try {
		await run(conn, `LOAD ${name}`);
	} catch {
		await run(conn, `INSTALL ${name}`);
		await run(conn, `LOAD ${name}`);
	}
}

function normalizeTaxonomyValue(value) {
	return String(value ?? '').trim() || 'Unknown';
}

function buildUseMask(uses) {
	let mask = 0;

	for (const [index, key] of TAXONOMY_USE_KEYS.entries()) {
		if (uses?.[key]) {
			mask |= 1 << index;
		}
	}

	return mask;
}

function createTaxonomyNodeAggregate({ nodeId, parentId, path, rank, depth, name }) {
	return {
		nodeId,
		parentId,
		path,
		rank,
		depth,
		name,
		nameLower: name.toLowerCase(),
		sortKey: name.toLowerCase(),
		count: 0,
		childIds: new Set(),
		wcfpId: null,
		authors: '',
		hasDistribution: false,
		distributionAreaCount: 0,
		hasCwr: false,
		lifeforms: new Set(),
		useMask: 0
	};
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
	console.log('🦆 Building DuckDB database...\n');
	console.log(`   XLSX:   ${INPUT_XLSX}`);
	console.log(`   CSV:    ${INPUT_CSV}`);
	console.log(`   COUNTS: ${INPUT_COUNTS}`);
	console.log(`   SHP:    ${INPUT_SHP}`);
	console.log(`   Output: ${OUTPUT_DB}\n`);

	// Verify input files exist before starting
	for (const [label, p] of [
		['XLSX', INPUT_XLSX],
		['CSV', INPUT_CSV],
		['COUNTS', INPUT_COUNTS],
		['SHP', INPUT_SHP]
	]) {
		if (!existsSync(p)) throw new Error(`Input file not found: ${label} → ${p}`);
	}

	// Remove existing DB to start fresh
	if (existsSync(OUTPUT_DB)) {
		unlinkSync(OUTPUT_DB);
		console.log('   Removed existing database\n');
	}

	const db = new duckdb.Database(OUTPUT_DB);
	const conn = db.connect();

	// ── Load extensions ──────────────────────────────────────────────────────
	console.log('📦 Loading extensions...');
	await loadExtension(conn, 'spatial');
	await loadExtension(conn, 'fts');
	console.log('   spatial ✓  fts ✓\n');

	// ── Create schema ────────────────────────────────────────────────────────
	console.log('🏗️  Creating schema...');
	await run(
		conn,
		`
		CREATE TABLE species (
			wcfp_id               INTEGER  PRIMARY KEY,
			taxon_name            VARCHAR  NOT NULL,
			authors               VARCHAR  NOT NULL DEFAULT '',
			family                VARCHAR  NOT NULL DEFAULT 'Unknown',
			genus                 VARCHAR  NOT NULL DEFAULT 'Unknown',
			kingdom               VARCHAR  NOT NULL DEFAULT 'Unknown',
			phylum                VARCHAR  NOT NULL DEFAULT 'Unknown',
			class                 VARCHAR  NOT NULL DEFAULT 'Unknown',
			"order"               VARCHAR  NOT NULL DEFAULT 'Unknown',
			lifeform              VARCHAR,
			cwr                   BOOLEAN  NOT NULL DEFAULT FALSE,
			cultivated            BOOLEAN  NOT NULL DEFAULT FALSE,
			use_human_food        BOOLEAN  NOT NULL DEFAULT FALSE,
			use_animal_food       BOOLEAN  NOT NULL DEFAULT FALSE,
			use_environmental     BOOLEAN  NOT NULL DEFAULT FALSE,
			use_fuels             BOOLEAN  NOT NULL DEFAULT FALSE,
			use_gene_sources      BOOLEAN  NOT NULL DEFAULT FALSE,
			use_invertebrate_food BOOLEAN  NOT NULL DEFAULT FALSE,
			use_materials         BOOLEAN  NOT NULL DEFAULT FALSE,
			use_medicines         BOOLEAN  NOT NULL DEFAULT FALSE,
			use_poisons           BOOLEAN  NOT NULL DEFAULT FALSE,
			use_social_uses       BOOLEAN  NOT NULL DEFAULT FALSE,
			source_link           VARCHAR  NOT NULL DEFAULT '',
			references_all        VARCHAR  NOT NULL DEFAULT '',
			uses_total            SMALLINT NOT NULL DEFAULT 0
		)
	`
	);
	await run(
		conn,
		`
		CREATE TABLE distribution (
			code              VARCHAR NOT NULL,
			wcfp_id           INTEGER NOT NULL REFERENCES species(wcfp_id),
			occurrence_status VARCHAR NOT NULL,
			introduced        BOOLEAN NOT NULL DEFAULT FALSE,
			extinct           BOOLEAN NOT NULL DEFAULT FALSE,
			location_doubtful BOOLEAN NOT NULL DEFAULT FALSE,
			PRIMARY KEY (code, wcfp_id)
		)
	`
	);
	console.log('   species, distribution tables created ✓\n');

	// ── Step 1: Load species from XLSX ───────────────────────────────────────
	console.log('📖 Loading species from XLSX...');
	const xlsxRows = readWcfpRows(INPUT_XLSX);
	console.log(`   ${xlsxRows.length.toLocaleString()} rows loaded`);

	const stmt = await prepare(
		conn,
		`INSERT OR IGNORE INTO species (
			wcfp_id,
			taxon_name,
			authors,
			family,
			genus,
			kingdom,
			phylum,
			class,
			"order",
			lifeform,
			cwr,
			cultivated,
			use_human_food,
			use_animal_food,
			use_environmental,
			use_fuels,
			use_gene_sources,
			use_invertebrate_food,
			use_materials,
			use_medicines,
			use_poisons,
			use_social_uses,
			source_link,
			references_all,
			uses_total
		) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
	);

	let speciesInserted = 0;
	let speciesSkipped = 0;

	for (const row of xlsxRows) {
		const speciesRecord = buildSpeciesRecordFromRow(row);
		if (!speciesRecord) {
			speciesSkipped++;
			continue;
		}

		await stmtRun(stmt, [
			speciesRecord.wcfpId,
			speciesRecord.name,
			speciesRecord.authors,
			speciesRecord.family,
			speciesRecord.genus || 'Unknown',
			String(row['kingdom'] || '').trim() || 'Unknown',
			String(row['phylum'] || '').trim() || 'Unknown',
			String(row['class'] || '').trim() || 'Unknown',
			String(row['order'] || '').trim() || 'Unknown',
			speciesRecord.lifeform ?? null,
			Boolean(speciesRecord.cwr),
			Boolean(speciesRecord.cultivated),
			Boolean(speciesRecord.uses?.humanFood),
			Boolean(speciesRecord.uses?.animalFood),
			Boolean(speciesRecord.uses?.environmentalUses),
			Boolean(speciesRecord.uses?.fuels),
			Boolean(speciesRecord.uses?.geneSources),
			Boolean(speciesRecord.uses?.invertebrateFood),
			Boolean(speciesRecord.uses?.materials),
			Boolean(speciesRecord.uses?.medicines),
			Boolean(speciesRecord.uses?.poisons),
			Boolean(speciesRecord.uses?.socialUses),
			speciesRecord.sourceLink ?? '',
			speciesRecord.referencesAllRaw ?? '',
			speciesRecord.uses?.total ?? 0
		]);
		speciesInserted++;
	}

	await stmtFinalize(stmt);
	console.log(`   Inserted: ${speciesInserted.toLocaleString()}  Skipped: ${speciesSkipped}\n`);

	// ── Step 2: Load distribution from CSV ───────────────────────────────────
	console.log('📊 Loading distribution from CSV...');
	// Normalize path separators and escape single quotes for SQL string literal
	const csvPathSql = INPUT_CSV.replace(/\\/g, '/').replace(/'/g, "''");
	await run(
		conn,
		`
		INSERT INTO distribution (code, wcfp_id, occurrence_status, introduced, extinct, location_doubtful)
		SELECT
			TRIM(area_code_l3)                      AS code,
			TRY_CAST(WCFP_ID AS INTEGER)            AS wcfp_id,
			TRIM(occurrence_status)                 AS occurrence_status,
			COALESCE(introduced, 0) = 1             AS introduced,
			COALESCE(extinct, 0) = 1                AS extinct,
			COALESCE(location_doubtful, 0) = 1      AS location_doubtful
		FROM read_csv_auto(
			'${csvPathSql}',
			delim=',',
			quote='"',
			header=true
		)
		WHERE TRY_CAST(WCFP_ID AS INTEGER) IS NOT NULL
		  AND TRIM(area_code_l3) != ''
		  AND TRY_CAST(WCFP_ID AS INTEGER) IN (SELECT wcfp_id FROM species)
		ON CONFLICT DO NOTHING
	`
	);
	const [{ dist_count }] = await exec(conn, `SELECT COUNT(*) AS dist_count FROM distribution`);
	console.log(`   ${dist_count.toLocaleString()} distribution rows inserted ✓`);

	// Every source row must survive. ON CONFLICT DO NOTHING and the wcfp_id membership test can
	// both drop rows silently, and a partial distribution still produces a plausible database.
	const [{ source_rows }] = await exec(
		conn,
		`SELECT COUNT(*) AS source_rows FROM read_csv_auto('${csvPathSql}', delim=',', quote='"', header=true)`
	);
	if (Number(dist_count) !== Number(source_rows)) {
		throw new Error(
			`INTEGRITY ERROR: distribution has ${dist_count} rows but the source CSV has ${source_rows}. ` +
				`Rows were dropped by the wcfp_id membership test or a primary-key conflict.`
		);
	}
	console.log(`   all ${source_rows.toLocaleString()} source rows accounted for ✓\n`);

	// ── Step 3: Create regions from the published counts file + shapefile geometry ──
	// The paper is the source of identity, names and reference figures; the shapefile
	// contributes geometry only. Keyed by TDWG3 code — names are labels, not identifiers.
	console.log('🗺️  Loading regions (paper identity + shapefile geometry)...');
	const shpPathSql = INPUT_SHP.replace(/\\/g, '/').replace(/'/g, "''");
	const countsPathSql = INPUT_COUNTS.replace(/\\/g, '/').replace(/'/g, "''");
	await run(
		conn,
		`
		CREATE TABLE shapefile_geom AS
		SELECT LEVEL3_COD AS code, LEVEL3_NAM AS shapefile_name, geom
		FROM ST_Read('${shpPathSql}')
	`
	);
	const shpCols = (await exec(conn, `PRAGMA table_info(shapefile_geom)`)).map((c) => c.name);
	for (const required of ['code', 'shapefile_name', 'geom']) {
		if (!shpCols.includes(required)) {
			throw new Error(
				`Shapefile is missing expected column "${required}". Got: ${shpCols.join(', ')}`
			);
		}
	}

	// WGSRPD Level 1 (continent) and Level 2 (region) are attributes of the AREA, not of the
	// distribution record — verified: 367 areas yield exactly 367 distinct (L3, L2, L1) triples,
	// so they live here on 367 rows rather than being repeated across 376k distribution rows.
	await run(
		conn,
		`
		CREATE TABLE area_hierarchy AS
		SELECT DISTINCT
			TRIM(area_code_l3)            AS code,
			CAST(continent_code_l1 AS INTEGER) AS continent_code,
			TRIM(continent)               AS continent,
			CAST(region_code_l2 AS INTEGER)    AS region_code,
			TRIM(region)                  AS region
		FROM read_csv_auto('${csvPathSql}', delim=',', quote='"', header=true)
		WHERE TRIM(area_code_l3) != ''
	`
	);
	const [{ hierarchy_rows }] = await exec(
		conn,
		`SELECT COUNT(*) AS hierarchy_rows FROM area_hierarchy`
	);
	const [{ hierarchy_codes }] = await exec(
		conn,
		`SELECT COUNT(DISTINCT code) AS hierarchy_codes FROM area_hierarchy`
	);
	if (Number(hierarchy_rows) !== Number(hierarchy_codes)) {
		throw new Error(
			`INTEGRITY ERROR: an area maps to more than one Level 1/Level 2 unit ` +
				`(${hierarchy_rows} rows for ${hierarchy_codes} codes). The hierarchy is not per-area.`
		);
	}

	await run(
		conn,
		`
		CREATE TABLE regions AS
		SELECT
			TRIM(c.area_code_l3)                        AS code,
			TRIM(c.area)                                AS area,
			COALESCE(TRIM(c.country), '')               AS country,
			COALESCE(TRIM(c.ISO_alpha2), '')            AS iso_alpha2,
			COALESCE(TRIM(c.ISO_alpha3), '')            AS iso_alpha3,
			h.continent_code                            AS continent_code,
			h.continent                                 AS continent,
			h.region_code                               AS region_code,
			h.region                                    AS region,
			CAST(c.unique_count AS INTEGER)             AS unique_count_published,
			CAST(c.Percentage AS DOUBLE)                AS percentage,
			CAST(c.flora_richness AS INTEGER)           AS flora_richness,
			CAST(c.pct_of_flora AS DOUBLE)              AS pct_of_flora,
			g.geom                                      AS geom
		FROM read_csv_auto('${countsPathSql}', delim=',', quote='"', header=true) c
		JOIN shapefile_geom g ON g.code = TRIM(c.area_code_l3)
		JOIN area_hierarchy h ON h.code = TRIM(c.area_code_l3)
	`
	);
	await run(conn, `DROP TABLE shapefile_geom`);
	await run(conn, `DROP TABLE area_hierarchy`);

	// Every published area must have geometry. A code present in the paper but absent from the
	// shapefile would vanish from the map with no error at all.
	const [{ published_areas }] = await exec(
		conn,
		`SELECT COUNT(*) AS published_areas
		 FROM read_csv_auto('${countsPathSql}', delim=',', quote='"', header=true)`
	);
	const [{ region_count }] = await exec(conn, `SELECT COUNT(*) AS region_count FROM regions`);
	if (Number(region_count) !== Number(published_areas)) {
		throw new Error(
			`INTEGRITY ERROR: ${published_areas} published areas but only ${region_count} matched a ` +
				`shapefile geometry by TDWG3 code. Every published area must be mappable.`
		);
	}
	const [{ dup_codes }] = await exec(
		conn,
		`SELECT COUNT(*) AS dup_codes FROM (SELECT code FROM regions GROUP BY code HAVING COUNT(*) > 1)`
	);
	if (Number(dup_codes) > 0) {
		throw new Error(`INTEGRITY ERROR: ${dup_codes} duplicate TDWG3 code(s) in regions.`);
	}
	console.log(`   ${region_count.toLocaleString()} regions loaded, all with geometry ✓\n`);

	// ── Step 4: Pre-aggregate region_stats ───────────────────────────────────
	console.log('📈 Pre-aggregating region_stats...');
	await run(
		conn,
		`
		CREATE TABLE region_stats AS
		SELECT
			d.code,
			COUNT(DISTINCT d.wcfp_id) AS total_species,
			COUNT(DISTINCT s.family)  AS family_count
		FROM distribution d
		JOIN species s USING (wcfp_id)
		GROUP BY d.code
	`
	);
	const [{ stats_count }] = await exec(conn, `SELECT COUNT(*) AS stats_count FROM region_stats`);
	console.log(`   ${stats_count.toLocaleString()} region stats rows ✓\n`);

	// ── Step 5: Pre-aggregate region_top_families ────────────────────────────
	console.log('🏆 Pre-aggregating top families per region...');
	await run(
		conn,
		`
		CREATE TABLE region_top_families AS
		SELECT code, family, cnt,
			   ROW_NUMBER() OVER (PARTITION BY code ORDER BY cnt DESC) AS rank
		FROM (
			SELECT d.code, s.family, COUNT(DISTINCT d.wcfp_id) AS cnt
			FROM distribution d JOIN species s USING (wcfp_id)
			GROUP BY d.code, s.family
		) t
		QUALIFY rank <= 10
	`
	);
	console.log('   region_top_families ✓\n');

	// ── Step 6: Pre-aggregate region taxonomy tables ────────────────────────
	console.log('🌱 Pre-aggregating region taxonomy tables...');
	await run(
		conn,
		`
		CREATE TABLE region_family_taxonomy AS
		SELECT
			d.code,
			COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown') AS family,
			COUNT(DISTINCT d.wcfp_id) AS species_count,
			COUNT(DISTINCT COALESCE(NULLIF(TRIM(s.genus), ''), 'Unknown')) AS genus_count
		FROM distribution d
		JOIN species s USING (wcfp_id)
		GROUP BY d.code, family
	`
	);
	await run(
		conn,
		`
		CREATE TABLE region_genus_taxonomy AS
		SELECT
			d.code,
			COALESCE(NULLIF(TRIM(s.family), ''), 'Unknown') AS family,
			COALESCE(NULLIF(TRIM(s.genus), ''), 'Unknown') AS genus,
			COUNT(DISTINCT d.wcfp_id) AS species_count
		FROM distribution d
		JOIN species s USING (wcfp_id)
		GROUP BY d.code, family, genus
	`
	);
	console.log('   region_family_taxonomy, region_genus_taxonomy ✓\n');

	// ── Step 7: Build incremental taxonomy runtime tables ────────────────────
	console.log('🌿 Building taxonomy runtime tables...');
	const distributionAreaCountRows = await exec(
		conn,
		`SELECT wcfp_id, COUNT(DISTINCT code) AS distribution_area_count
		 FROM distribution
		 GROUP BY wcfp_id`
	);
	const distributionAreaCountBySpecies = new Map(
		distributionAreaCountRows.map((row) => [
			Number(row.wcfp_id),
			Number(row.distribution_area_count)
		])
	);

	await run(
		conn,
		`
		CREATE TABLE taxonomy_nodes (
			node_id                  VARCHAR  PRIMARY KEY,
			parent_id                VARCHAR,
			path                     VARCHAR  NOT NULL,
			rank                     VARCHAR  NOT NULL,
			depth                    SMALLINT NOT NULL,
			name                     VARCHAR  NOT NULL,
			name_lower               VARCHAR  NOT NULL,
			sort_key                 VARCHAR  NOT NULL,
			count                    INTEGER  NOT NULL,
			child_count              INTEGER  NOT NULL DEFAULT 0,
			wcfp_id                  INTEGER,
			authors                  VARCHAR  NOT NULL DEFAULT '',
			has_distribution         BOOLEAN  NOT NULL DEFAULT FALSE,
			distribution_area_count  INTEGER  NOT NULL DEFAULT 0,
			has_cwr                  BOOLEAN  NOT NULL DEFAULT FALSE,
			lifeforms_json           VARCHAR  NOT NULL DEFAULT '[]',
			use_mask                 INTEGER  NOT NULL DEFAULT 0
		)
	`
	);
	await run(
		conn,
		`
		CREATE TABLE taxonomy_closure (
			ancestor_id   VARCHAR NOT NULL,
			descendant_id VARCHAR NOT NULL,
			depth         SMALLINT NOT NULL,
			PRIMARY KEY (ancestor_id, descendant_id)
		)
	`
	);
	const taxonomyNodes = new Map();

	function getOrCreateTaxonomyNode(descriptor) {
		const existing = taxonomyNodes.get(descriptor.nodeId);
		if (existing) {
			return existing;
		}

		const node = createTaxonomyNodeAggregate(descriptor);
		taxonomyNodes.set(descriptor.nodeId, node);
		return node;
	}

	getOrCreateTaxonomyNode({
		nodeId: 'root',
		parentId: null,
		path: 'root',
		rank: 'root',
		depth: 0,
		name: 'root'
	});

	for (const row of xlsxRows) {
		const speciesRecord = buildSpeciesRecordFromRow(row);
		if (!speciesRecord) {
			continue;
		}

		const distributionAreaCount = distributionAreaCountBySpecies.get(speciesRecord.wcfpId) ?? 0;
		const hasDistribution = distributionAreaCount > 0;
		const lifeform = speciesRecord.lifeform ?? '';
		const useMask = buildUseMask(speciesRecord.uses);
		const hasCwr = Boolean(speciesRecord.cwr);
		const lineage = [
			{ name: 'root', rank: 'root' },
			{ name: normalizeTaxonomyValue(row['kingdom']), rank: 'kingdom' },
			{ name: normalizeTaxonomyValue(row['phylum']), rank: 'phylum' },
			{ name: normalizeTaxonomyValue(row['class']), rank: 'class' },
			{ name: normalizeTaxonomyValue(row['order']), rank: 'order' },
			{ name: normalizeTaxonomyValue(speciesRecord.family), rank: 'family' },
			{ name: normalizeTaxonomyValue(speciesRecord.genus), rank: 'genus' },
			{ name: speciesRecord.name, rank: 'species' }
		];

		let parentId = null;

		for (const [depth, part] of lineage.entries()) {
			const nodeId = depth === 0 ? 'root' : `${parentId}/${part.name}`;
			const node = getOrCreateTaxonomyNode({
				nodeId,
				parentId,
				path: nodeId,
				rank: part.rank,
				depth,
				name: part.name
			});

			if (parentId) {
				const parent = taxonomyNodes.get(parentId);
				parent?.childIds.add(nodeId);
			}

			node.count += 1;
			node.hasDistribution = node.hasDistribution || hasDistribution;

			if (part.rank === 'species') {
				node.wcfpId = speciesRecord.wcfpId;
				node.authors = speciesRecord.authors ?? '';
				node.distributionAreaCount = distributionAreaCount;
				node.useMask = useMask;
				node.hasCwr = hasCwr;
				if (lifeform) {
					node.lifeforms.add(lifeform);
				}
			}

			parentId = nodeId;
		}
	}

	const taxonomyNodeStmt = await prepare(
		conn,
		`INSERT INTO taxonomy_nodes (
			node_id,
			parent_id,
			path,
			rank,
			depth,
			name,
			name_lower,
			sort_key,
			count,
			child_count,
			wcfp_id,
			authors,
			has_distribution,
			distribution_area_count,
			has_cwr,
			lifeforms_json,
			use_mask
		) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
	);
	const taxonomyClosureStmt = await prepare(
		conn,
		`INSERT INTO taxonomy_closure (ancestor_id, descendant_id, depth) VALUES (?,?,?)`
	);
	for (const node of taxonomyNodes.values()) {
		await stmtRun(taxonomyNodeStmt, [
			node.nodeId,
			node.parentId,
			node.path,
			node.rank,
			node.depth,
			node.name,
			node.nameLower,
			node.sortKey,
			node.rank === 'root' ? speciesInserted : node.count,
			node.childIds.size,
			node.wcfpId,
			node.authors,
			node.hasDistribution,
			node.distributionAreaCount,
			node.hasCwr,
			JSON.stringify([...node.lifeforms].sort((left, right) => left.localeCompare(right))),
			node.useMask
		]);

		let ancestorId = node.nodeId;
		let closureDepth = 0;
		while (ancestorId) {
			await stmtRun(taxonomyClosureStmt, [ancestorId, node.nodeId, closureDepth]);
			const ancestor = taxonomyNodes.get(ancestorId);
			ancestorId = ancestor?.parentId ?? null;
			closureDepth += 1;
		}
	}

	await stmtFinalize(taxonomyNodeStmt);
	await stmtFinalize(taxonomyClosureStmt);

	const [{ taxonomy_node_count }] = await exec(
		conn,
		`SELECT COUNT(*) AS taxonomy_node_count FROM taxonomy_nodes`
	);
	console.log(`   ${Number(taxonomy_node_count).toLocaleString()} taxonomy nodes ✓\n`);

	// ── Step 8: Indexes ───────────────────────────────────────────────────────
	console.log('🔍 Creating indexes...');
	const indexes = [
		`CREATE INDEX idx_dist_code    ON distribution(code)`,
		`CREATE INDEX idx_dist_wcfp    ON distribution(wcfp_id)`,
		`CREATE INDEX idx_spe_family   ON species(family)`,
		`CREATE INDEX idx_spe_genus    ON species(genus)`,
		`CREATE INDEX idx_spe_order    ON species("order")`,
		`CREATE INDEX idx_spe_class    ON species(class)`,
		`CREATE INDEX idx_spe_phylum   ON species(phylum)`,
		`CREATE INDEX idx_spe_kingdom  ON species(kingdom)`,
		`CREATE INDEX idx_spe_lifeform ON species(lifeform)`,
		`CREATE INDEX idx_spe_cwr      ON species(cwr)`,
		`CREATE INDEX idx_stats_code   ON region_stats(code)`,
		`CREATE INDEX idx_region_family_code ON region_family_taxonomy(code, family)`,
		`CREATE INDEX idx_region_genus_code_family ON region_genus_taxonomy(code, family, genus)`,
		`CREATE INDEX idx_tax_nodes_parent_sort ON taxonomy_nodes(parent_id, sort_key)`,
		`CREATE INDEX idx_tax_nodes_path ON taxonomy_nodes(path)`,
		`CREATE INDEX idx_tax_nodes_name_lower ON taxonomy_nodes(name_lower)`,
		`CREATE INDEX idx_tax_nodes_rank_name ON taxonomy_nodes(rank, name_lower)`,
		`CREATE INDEX idx_tax_nodes_wcfp ON taxonomy_nodes(wcfp_id)`,
		`CREATE INDEX idx_tax_nodes_distribution ON taxonomy_nodes(has_distribution)`,
		`CREATE INDEX idx_tax_closure_ancestor ON taxonomy_closure(ancestor_id, descendant_id)`,
		`CREATE INDEX idx_tax_closure_descendant ON taxonomy_closure(descendant_id, ancestor_id)`
	];
	for (const idx of indexes) {
		await run(conn, idx);
	}
	console.log(`   ${indexes.length} indexes created ✓\n`);

	// ── Step 9: FTS index ─────────────────────────────────────────────────────
	console.log('📝 Building FTS indexes...');
	await run(
		conn,
		`PRAGMA create_fts_index('species', 'wcfp_id', 'taxon_name', 'family', 'genus', 'authors')`
	);
	await run(conn, `PRAGMA create_fts_index('taxonomy_nodes', 'node_id', 'name', 'authors')`);
	console.log('   FTS indexes on species and taxonomy_nodes ✓\n');

	// ── Step 10: Build-time verification ─────────────────────────────────────
	//
	// The check that matters: every area's computed count must equal the figure published in
	// the paper. Comparing region_stats against distribution instead — as this step used to —
	// is a tautology, since both are derived from the same CSV column.
	console.log('✅ Running build-time integrity checks...');

	const mismatches = await exec(
		conn,
		`SELECT r.code, r.area, r.unique_count_published AS published,
		        COALESCE(rs.total_species, 0)           AS computed
		 FROM regions r
		 LEFT JOIN region_stats rs USING (code)
		 WHERE COALESCE(rs.total_species, 0) != r.unique_count_published
		 ORDER BY r.code`
	);
	if (mismatches.length > 0) {
		const detail = mismatches
			.map((m) => `      ${m.code} ${m.area}: computed ${m.computed}, published ${m.published}`)
			.join('\n');
		throw new Error(
			`INTEGRITY ERROR: ${mismatches.length} of ${region_count} areas do not match the ` +
				`published counts.\n${detail}\n` +
				`The portal must not display figures that disagree with the paper.`
		);
	}
	console.log(`   all ${region_count} areas match the published counts exactly ✓`);

	// Every area with published data must have stats; every stats row must be a known region.
	const [{ orphan_stats }] = await exec(
		conn,
		`SELECT COUNT(*) AS orphan_stats FROM region_stats rs
		 WHERE rs.code NOT IN (SELECT code FROM regions)`
	);
	if (Number(orphan_stats) > 0) {
		throw new Error(
			`INTEGRITY ERROR: ${orphan_stats} region_stats row(s) reference an unknown TDWG3 code.`
		);
	}
	console.log('   no orphaned region_stats rows ✓');

	// The taxonomy root is seeded from a counter of *attempted* inserts; assert it against the
	// table it claims to summarise.
	const [{ root_count }] = await exec(
		conn,
		`SELECT count AS root_count FROM taxonomy_nodes WHERE rank = 'root'`
	);
	const [{ species_total }] = await exec(conn, `SELECT COUNT(*) AS species_total FROM species`);
	if (Number(root_count) !== Number(species_total)) {
		throw new Error(
			`INTEGRITY ERROR: taxonomy root count (${root_count}) ≠ species rows (${species_total}).`
		);
	}
	console.log(`   taxonomy root count = ${Number(root_count).toLocaleString()} species ✓`);

	// ── Summary ───────────────────────────────────────────────────────────────
	const [summary] = await exec(
		conn,
		`SELECT
			(SELECT COUNT(*) FROM species)          AS species_count,
			(SELECT COUNT(*) FROM distribution)     AS dist_count,
			(SELECT COUNT(*) FROM regions)          AS region_count,
			(SELECT COUNT(*) FROM region_stats)     AS stats_count,
			(SELECT COUNT(*) FROM taxonomy_nodes)   AS taxonomy_node_count
		`
	);
	console.log('\n📊 Database summary:');
	console.log(`   species:         ${Number(summary.species_count).toLocaleString()}`);
	console.log(`   distribution:    ${Number(summary.dist_count).toLocaleString()}`);
	console.log(`   regions:         ${Number(summary.region_count).toLocaleString()}`);
	console.log(`   region_stats:    ${Number(summary.stats_count).toLocaleString()}`);
	console.log(`   taxonomy_nodes:  ${Number(summary.taxonomy_node_count).toLocaleString()}`);

	conn.close();
	db.close();

	const dbSize = (statSync(OUTPUT_DB).size / 1024 / 1024).toFixed(1);
	console.log(`\n🎉 Done! ${OUTPUT_DB} (${dbSize} MB)`);
}

main().catch((err) => {
	console.error('\n❌ Build failed:', err.message || err);
	process.exit(1);
});
