#!/usr/bin/env node

/**
 * Assert that a DuckDB file carries the columns this release queries.
 *
 * A release whose SQL names a column the database lacks does not fail at deploy time. It fails on
 * the first request that runs that query, as a 500 on a page nobody thought to reload — which is
 * exactly what would have happened the first time the About page asked for `species.cultivated`
 * against a database built before that column existed.
 *
 * Uses the `duckdb` npm package rather than the CLI, because the package is already a runtime
 * dependency of the app and is therefore present wherever a release has been installed. The CLI is
 * not installed on the deployment host and would be one more thing to provision and keep current.
 *
 * Usage:  node scripts/check-db-schema.js [path/to/wcfp.duckdb]
 * Exits non-zero, naming the first missing column, if the schema does not satisfy the release.
 */

import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

/**
 * Extend these when a query starts depending on a new column. The point of the list is that it is
 * maintained by hand: a column added here is a column someone decided the deployed database must
 * have before the release goes live.
 */
const REQUIRED = {
	species: [
		'wcfp_id',
		'taxon_name',
		'family',
		'genus',
		'cwr',
		'cultivated',
		'use_human_food',
		'source_link',
		'uses_total'
	],
	regions: [
		'code',
		'area',
		'iso_alpha3',
		'unique_count_published',
		'flora_richness',
		'pct_of_flora'
	],
	distribution: ['code', 'wcfp_id', 'occurrence_status']
};

const dbPath = path.resolve(process.argv[2] ?? 'data/wcfp.duckdb');

const duckdb = require('duckdb');
const db = new duckdb.Database(dbPath, { access_mode: 'READ_ONLY' });
const conn = db.connect();

const all = (sql) =>
	new Promise((resolve, reject) =>
		conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)))
	);

const missing = [];

for (const [table, columns] of Object.entries(REQUIRED)) {
	let present;
	try {
		const rows = await all(
			`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`
		);
		present = new Set(rows.map((row) => row.column_name));
	} catch (error) {
		missing.push(`${table} (table unreadable: ${error.message})`);
		continue;
	}

	if (present.size === 0) {
		missing.push(`${table} (table absent)`);
		continue;
	}

	for (const column of columns) {
		if (!present.has(column)) missing.push(`${table}.${column}`);
	}
}

conn.close();

if (missing.length > 0) {
	console.error(`Schema check FAILED for ${dbPath}`);
	for (const item of missing) console.error(`  missing: ${item}`);
	console.error('\nRebuild the database (pnpm refresh:data) and ship it before this release.');
	process.exit(1);
}

console.log(`Schema check passed: ${dbPath} satisfies this release.`);
