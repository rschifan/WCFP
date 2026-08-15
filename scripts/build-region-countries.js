#!/usr/bin/env node
/**
 * Derive the TDWG3 <-> country mapping that powers the region search box.
 *
 * Input:  data/TDWG3_count_wcfp_ISO_R1.csv
 * Output: static/data/region-countries.json
 *
 * THE PAPER IS THE AUTHORITY. This used to be derived from the Level 4 WGSRPD shapefile's
 * ISO_Code field plus a pinned ISO->name table, which disagreed with the published dataset on
 * 24 dependent territories (the shapefile files Réunion under RE, the paper under France) and
 * carried defects the paper does not: it used the non-ISO code `UK` — mapped to FRA, GRB and
 * IRE, so searching "United Kingdom" surfaced France and Ireland — and two unresolved
 * placeholders `PI`/`SP` that rendered as country names for the South China Sea.
 *
 * Entries are keyed by country NAME, not ISO code, because the paper deliberately assigns no
 * ISO code to the 24 areas spanning more than one country; it lists the constituents separated
 * by "/" instead. Keying on ISO would collapse all 24 into one empty-string bucket. The name is
 * what the search box matches and displays; the ISO codes ride along as attributes.
 *
 * DETERMINISTIC BY DESIGN. The output is a pure function of its input, so
 * `pnpm build:geo-aliases && git diff --exit-code static/data/region-countries.json`
 * is a meaningful check. Sorting uses collationKey()/byCodePoint() rather than
 * localeCompare, which draws on the running Node's bundled ICU tables and so could order the
 * same input differently on different machines.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const COUNTS = resolve(repoRoot, 'data/TDWG3_count_wcfp_ISO_R1.csv');
const OUT = resolve(repoRoot, 'static/data/region-countries.json');

/**
 * Sort key reproducing ICU's `en` collation for this dataset without ICU:
 * strip diacritics, lowercase, then compare by code point. Handles the two
 * cases a naive sort gets wrong — "Côte d'Ivoire" before "Croatia" (o folds),
 * and "U.S. Outlying Islands" before "Uganda" (punctuation precedes letters).
 * @param {string} value
 */
function collationKey(value) {
	return value
		.normalize('NFD')
		.replace(/\p{Mn}/gu, '')
		.toLowerCase();
}

/**
 * Code-point comparison — deterministic, unlike String.prototype.localeCompare.
 * @param {string} a
 * @param {string} b
 */
function byCodePoint(a, b) {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Minimal RFC 4180 row splitter — the country column contains commas inside quotes
 * (e.g. "Antigua and Barbuda / Saint Kitts and Nevis" is safe, but names like
 * "Bosnia-Herz." are not guaranteed to stay comma-free in a future revision).
 * @param {string} line
 */
function splitCsvRow(line) {
	const out = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			out.push(field);
			field = '';
		} else {
			field += ch;
		}
	}
	out.push(field);
	return out.map((f) => f.trim());
}

let csv;
try {
	csv = readFileSync(COUNTS, 'utf8');
} catch (err) {
	if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
		console.error(
			`build-region-countries: source file not found at ${COUNTS}.\n` +
				`It is distributed on request; see README "Obtain source data files".`
		);
		process.exit(1);
	}
	throw err;
}

const lines = csv.trim().split(/\r?\n/);
const header = splitCsvRow(lines[0]);
const col = Object.fromEntries(header.map((name, index) => [name, index]));

for (const required of ['area_code_l3', 'country', 'ISO_alpha2', 'ISO_alpha3']) {
	if (!(required in col)) {
		console.error(
			`build-region-countries: ${COUNTS} has no "${required}" column. Got: ${header.join(', ')}`
		);
		process.exit(1);
	}
}

/** @type {Map<string, { name: string, iso: string, iso3: string, regions: Set<string> }>} */
const countryByName = new Map();
/** @type {Map<string, string[]>} */
const regionCountries = new Map();

for (const line of lines.slice(1)) {
	const cells = splitCsvRow(line);
	const code = cells[col['area_code_l3']];
	if (!code) continue;

	// One country, or several separated by "/" — with or without surrounding spaces.
	const names = cells[col['country']]
		.split('/')
		.map((n) => n.trim())
		.filter(Boolean);

	// The paper assigns ISO codes only where an area maps to exactly one country.
	const single = names.length === 1;
	const iso = single ? cells[col['ISO_alpha2']] : '';
	const iso3 = single ? cells[col['ISO_alpha3']] : '';

	regionCountries.set(code, names);

	for (const name of names) {
		let entry = countryByName.get(name);
		if (!entry) {
			entry = { name, iso: '', iso3: '', regions: new Set() };
			countryByName.set(name, entry);
		}
		entry.regions.add(code);
		// A country reached only through multi-country areas has no ISO code in the paper.
		if (iso && !entry.iso) {
			entry.iso = iso;
			entry.iso3 = iso3;
		}
	}
}

const output = {
	version: 2,
	source: 'data/TDWG3_count_wcfp_ISO_R1.csv',
	regionCountries: Object.fromEntries(
		[...regionCountries.entries()]
			.sort(([a], [b]) => byCodePoint(a, b))
			.map(([code, names]) => [code, [...names].sort((a, b) => byCodePoint(a, b))])
	),
	countries: [...countryByName.values()]
		.map((entry) => ({
			name: entry.name,
			iso: entry.iso,
			iso3: entry.iso3,
			regions: [...entry.regions].sort(byCodePoint)
		}))
		.sort(
			(a, b) =>
				byCodePoint(collationKey(a.name), collationKey(b.name)) || byCodePoint(a.name, b.name)
		)
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(output));

const withIso = output.countries.filter((c) => c.iso).length;
console.log(
	`region-countries: ${output.countries.length} countries (${withIso} with an ISO code), ` +
		`${Object.keys(output.regionCountries).length} TDWG3 regions -> ${OUT} ` +
		`(${(JSON.stringify(output).length / 1024).toFixed(1)} KB)`
);
