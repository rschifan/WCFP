#!/usr/bin/env node

/**
 * Verify the built database against the published dataset.
 *
 * The build script already refuses to produce a database whose per-area counts disagree with
 * the paper. This script is the independent second opinion: it re-reads the source files and
 * the database and asserts the figures the portal actually displays.
 *
 * Every assertion is fatal. A silent degradation is the failure mode that matters here — a
 * renamed workbook column yields `false`/`'Unknown'` rather than an error, so a build can
 * succeed while producing a portal with, say, no recorded uses at all.
 *
 * Usage:
 *   node scripts/verify-data.js
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { readWcfpRows, boolCell, USE_COLUMN_BY_KEY } from './lib/wcfp-workbook.js';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB = path.join(ROOT, 'data/wcfp.duckdb');
const COUNTS = path.join(ROOT, 'data/TDWG3_count_wcfp_ISO_R1.csv');
const DIST = path.join(ROOT, 'data/geo_distr_taxa_ISO_R1.csv');
const XLSX_PATH = path.join(ROOT, 'data/WCFP.xlsx');

/** Figures published in the paper and shown on the landing and About pages. */
const PUBLISHED = {
	taxa: 26622,
	species: 26419,
	hybrids: 203,
	genera: 5009,
	families: 412,
	areas: 367,
	distributionRows: 376373,
	occurrenceStatus: { native: 277848, introduced: 97799, doubtful: 449, extinct: 277 },
	spotCounts: { CHC: 3586, ZAI: 2530, CPP: 1709, ITA: 2074, ABT: 735 }
};

let failures = 0;

function check(label, actual, expected) {
	const ok = String(actual) === String(expected);
	if (!ok) failures++;
	console.log(`   ${ok ? '✓' : '✗'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
}

function sql(conn, text) {
	return new Promise((resolve, reject) => {
		conn.all(text, (err, rows) => (err ? reject(err) : resolve(rows)));
	});
}

async function one(conn, text) {
	const rows = await sql(conn, text);
	return Object.values(rows[0])[0];
}

function sqlPath(p) {
	return p.replace(/\\/g, '/').replace(/'/g, "''");
}

async function main() {
	const db = new duckdb.Database(DB, { access_mode: 'READ_ONLY' });
	const conn = db.connect();

	console.log('🔍 Verifying database against the published dataset\n');

	console.log('Taxa and ranks');
	check('species rows', await one(conn, `SELECT COUNT(*) FROM species`), PUBLISHED.taxa);
	check(
		'distinct wcfp_id',
		await one(conn, `SELECT COUNT(DISTINCT wcfp_id) FROM species`),
		PUBLISHED.taxa
	);
	check(
		'duplicate IPNI ids',
		await one(
			conn,
			`SELECT COUNT(*) FROM (
			   SELECT regexp_extract(source_link, 'ipni\\.org/n/([0-9]+-[0-9]+)', 1) AS ipni
			   FROM species WHERE source_link LIKE '%ipni.org/n/%'
			   GROUP BY ipni HAVING COUNT(*) > 1)`
		),
		0
	);
	check(
		'hybrid names',
		await one(
			conn,
			`SELECT COUNT(*) FROM species WHERE contains(taxon_name, '×') OR contains(taxon_name, '+')`
		),
		PUBLISHED.hybrids
	);
	check(
		'species (non-hybrid taxa)',
		await one(
			conn,
			`SELECT COUNT(*) FROM species WHERE NOT (contains(taxon_name, '×') OR contains(taxon_name, '+'))`
		),
		PUBLISHED.species
	);
	check(
		'genera',
		await one(conn, `SELECT COUNT(DISTINCT genus) FROM species`),
		PUBLISHED.genera
	);
	check(
		'families',
		await one(conn, `SELECT COUNT(DISTINCT family) FROM species`),
		PUBLISHED.families
	);
	check(
		'taxonomy root count',
		await one(conn, `SELECT count FROM taxonomy_nodes WHERE rank = 'root'`),
		PUBLISHED.taxa
	);

	// Use flags are the check that catches a silent workbook column rename: an unmapped column
	// yields `false` for every row, which no other assertion here would notice.
	console.log('\nUse flags (source workbook vs database)');
	const rows = readWcfpRows(XLSX_PATH);
	const dbColumnByKey = {
		humanFood: 'use_human_food',
		animalFood: 'use_animal_food',
		medicines: 'use_medicines',
		materials: 'use_materials',
		fuels: 'use_fuels',
		geneSources: 'use_gene_sources',
		poisons: 'use_poisons',
		invertebrateFood: 'use_invertebrate_food',
		environmentalUses: 'use_environmental',
		socialUses: 'use_social_uses'
	};
	for (const [key, workbookColumn] of Object.entries(USE_COLUMN_BY_KEY)) {
		const fromSource = rows.filter((row) => boolCell(row[workbookColumn])).length;
		const fromDb = await one(
			conn,
			`SELECT COUNT(*) FROM species WHERE ${dbColumnByKey[key]} = TRUE`
		);
		check(`${key}`, fromDb, fromSource);
		if (fromSource === 0) {
			failures++;
			console.log(`     ✗ ${workbookColumn} is empty in the workbook — column likely renamed`);
		}
	}
	const cwrSource = rows.filter((row) => boolCell(row['CWR_GRIN'])).length;
	check('cwr', await one(conn, `SELECT COUNT(*) FROM species WHERE cwr = TRUE`), cwrSource);

	console.log('\nDistribution');
	check(
		'distribution rows',
		await one(conn, `SELECT COUNT(*) FROM distribution`),
		PUBLISHED.distributionRows
	);
	for (const [status, expected] of Object.entries(PUBLISHED.occurrenceStatus)) {
		check(
			`occurrence_status = ${status}`,
			await one(conn, `SELECT COUNT(*) FROM distribution WHERE occurrence_status = '${status}'`),
			expected
		);
	}
	check(
		'distribution codes not in regions',
		await one(
			conn,
			`SELECT COUNT(DISTINCT code) FROM distribution WHERE code NOT IN (SELECT code FROM regions)`
		),
		0
	);

	console.log('\nRegions and counts');
	check('regions', await one(conn, `SELECT COUNT(*) FROM regions`), PUBLISHED.areas);
	check(
		'regions joined to stats',
		await one(conn, `SELECT COUNT(*) FROM region_stats rs JOIN regions r USING (code)`),
		PUBLISHED.areas
	);
	check(
		'areas whose count differs from the paper',
		await one(
			conn,
			`SELECT COUNT(*) FROM regions r
			 LEFT JOIN region_stats rs USING (code)
			 WHERE COALESCE(rs.total_species, 0) != r.unique_count_published`
		),
		0
	);
	for (const [code, expected] of Object.entries(PUBLISHED.spotCounts)) {
		check(
			`${code} count`,
			await one(conn, `SELECT total_species FROM region_stats WHERE code = '${code}'`),
			expected
		);
	}

	// Independent re-derivation: recompute the counts straight from the source CSV rather than
	// from the database, so a shared bug in the ingest cannot make both sides agree.
	console.log('\nWGSRPD hierarchy (Level 1 / Level 2)');
	check('continents', await one(conn, `SELECT COUNT(DISTINCT continent) FROM regions`), 9);
	check('Level 2 regions', await one(conn, `SELECT COUNT(DISTINCT region) FROM regions`), 51);
	check(
		'areas missing a continent or region',
		await one(
			conn,
			`SELECT COUNT(*) FROM regions
			 WHERE continent IS NULL OR continent = '' OR region IS NULL OR region = ''`
		),
		0
	);
	check(
		'areas whose hierarchy disagrees with the source CSV',
		await one(
			conn,
			`WITH src AS (
			   SELECT DISTINCT TRIM(area_code_l3) AS code,
			          CAST(continent_code_l1 AS INTEGER) AS continent_code,
			          CAST(region_code_l2 AS INTEGER)    AS region_code
			   FROM read_csv_auto('${sqlPath(DIST)}', header=true)
			 )
			 SELECT COUNT(*) FROM regions r
			 LEFT JOIN src ON src.code = r.code
			  AND src.continent_code = r.continent_code
			  AND src.region_code = r.region_code
			 WHERE src.code IS NULL`
		),
		0
	);

	// The search box must offer exactly the regions the portal can serve, with the paper's
	// country names -- not the shapefile's, which disagreed on 24 dependent territories.
	console.log('\nRegion search mapping (must come from the paper)');
	const searchPayload = JSON.parse(
		readFileSync(path.join(ROOT, 'static/data/region-countries.json'), 'utf8')
	);
	check('payload source', searchPayload.source, 'data/TDWG3_count_wcfp_ISO_R1.csv');
	check(
		'searchable regions',
		Object.keys(searchPayload.regionCountries).length,
		PUBLISHED.areas
	);
	const dbCodes = new Set(
		(await sql(conn, `SELECT code FROM regions`)).map((r) => r.code)
	);
	check(
		'search regions absent from the database',
		Object.keys(searchPayload.regionCountries).filter((c) => !dbCodes.has(c)).length,
		0
	);
	check(
		'country entries whose name is a bare code placeholder',
		searchPayload.countries.filter((c) => c.name === c.iso).length,
		0
	);
	check(
		'non-ISO country codes (e.g. UK for GB)',
		searchPayload.countries.filter((c) => c.iso && !/^[A-Z]{2}$/.test(c.iso)).length,
		0
	);
	const multi = await sql(
		conn,
		`SELECT code, country FROM regions WHERE iso_alpha2 = '' ORDER BY code`
	);
	check(
		'multi-country areas listed with every constituent',
		multi.filter(
			(r) =>
				(searchPayload.regionCountries[r.code] ?? []).length ===
				r.country.split('/').map((n) => n.trim()).filter(Boolean).length
		).length,
		multi.length
	);

	console.log('\nSource CSV re-derivation (independent of the database)');
	check(
		'areas where source CSV disagrees with the published counts',
		await one(
			conn,
			`WITH c AS (SELECT * FROM read_csv_auto('${sqlPath(COUNTS)}', header=true)),
			      d AS (SELECT * FROM read_csv_auto('${sqlPath(DIST)}', header=true))
			 SELECT COUNT(*) FROM c
			 WHERE c.unique_count != (
			   SELECT COUNT(DISTINCT d.WCFP_ID) FROM d WHERE d.area_code_l3 = c.area_code_l3)`
		),
		0
	);

	conn.close();
	db.close();

	console.log('');
	if (failures > 0) {
		console.error(`❌ ${failures} check(s) failed — the portal would display figures that do not
   match the published dataset. Do not deploy.`);
		process.exit(1);
	}
	console.log('✅ All checks passed. Displayed figures match the published dataset.');
}

main().catch((err) => {
	console.error('\n❌ Verification failed:', err.message || err);
	process.exit(1);
});
