#!/usr/bin/env node
/**
 * Derive TDWG3 <-> political country mappings from the Level 4 WGSRPD shapefile.
 *
 * Input:  data/wgsrpd-master/geojson/level4.geojson
 *         scripts/data/iso-country-names.json
 * Output: static/data/region-countries.json
 *
 * DETERMINISTIC BY DESIGN. The output is a pure function of its two inputs, so
 * `pnpm build:geo-aliases && git diff --exit-code static/data/region-countries.json`
 * is a meaningful check. Three things previously made it non-reproducible:
 *
 *   1. a `generatedAt` timestamp        -> removed
 *   2. Intl.DisplayNames for names      -> replaced by the pinned table below
 *   3. localeCompare for BOTH sorts     -> replaced by collationKey()
 *
 * (2) and (3) drew on the running Node's bundled ICU tables, so the same source
 * could yield "Turkey" on one Node and "Türkiye" on another, silently changing
 * what the region search box matches. The pinned names are exactly those the
 * portal served on 2026-08-13; changing one is a deliberate, reviewable edit.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const SOURCE = resolve(repoRoot, 'data/wgsrpd-master/geojson/level4.geojson');
const NAMES = resolve(__dirname, 'data/iso-country-names.json');
const OUT = resolve(repoRoot, 'static/data/region-countries.json');

/**
 * Sort key reproducing ICU's `en` collation for this dataset without ICU:
 * strip diacritics, lowercase, then compare by code point. Handles the two
 * cases a naive sort gets wrong — "Côte d'Ivoire" before "Croatia" (o folds),
 * and "U.S. Outlying Islands" before "Uganda" (punctuation precedes letters).
 */
function collationKey(value) {
	return value
		.normalize('NFD')
		.replace(/\p{Mn}/gu, '')
		.toLowerCase();
}

/** Code-point comparison — deterministic, unlike String.prototype.localeCompare. */
function byCodePoint(a, b) {
	return a < b ? -1 : a > b ? 1 : 0;
}

// TDWG3 codes to exclude (mirrors queries.ts filter for 'ANT').
const EXCLUDED_L3 = new Set(['ANT']);

let raw;
try {
	raw = JSON.parse(readFileSync(SOURCE, 'utf8'));
} catch (err) {
	if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
		console.error(
			`build-region-countries: source file not found at ${SOURCE}.\n` +
				`Populate data/wgsrpd-master/ before running this script (see README).`
		);
		process.exit(1);
	}
	throw err;
}

/** @type {Record<string, string>} ISO 3166-1 alpha-2 -> display name. Pinned, not derived. */
const regionNames = JSON.parse(readFileSync(NAMES, 'utf8'));

/** @type {Map<string, Set<string>>} */
const l3ToIso = new Map();
/** @type {Map<string, Set<string>>} */
const isoToL3 = new Map();

for (const f of raw.features) {
	const iso = f.properties?.ISO_Code;
	const l3 = f.properties?.Level3_cod;
	if (!iso || !l3 || EXCLUDED_L3.has(l3)) continue;
	if (!l3ToIso.has(l3)) l3ToIso.set(l3, new Set());
	l3ToIso.get(l3).add(iso);
	if (!isoToL3.has(iso)) isoToL3.set(iso, new Set());
	isoToL3.get(iso).add(l3);
}

const regionCountries = Object.fromEntries(
	[...l3ToIso.entries()]
		.sort(([a], [b]) => byCodePoint(a, b))
		.map(([l3, isos]) => [l3, [...isos].sort(byCodePoint)])
);

const missingNames = [...isoToL3.keys()].filter((iso) => !(iso in regionNames)).sort(byCodePoint);
if (missingNames.length > 0) {
	console.error(
		`build-region-countries: no pinned name for ${missingNames.join(', ')}.\n` +
			`Add them to scripts/data/iso-country-names.json. Falling back to ICU here would\n` +
			`reintroduce the version-dependent naming this script exists to avoid.`
	);
	process.exit(1);
}

const countries = [...isoToL3.entries()]
	.map(([iso, l3s]) => ({
		iso,
		name: regionNames[iso],
		regions: [...l3s].sort(byCodePoint)
	}))
	.filter((c) => c.regions.length > 0)
	.sort((a, b) => byCodePoint(collationKey(a.name), collationKey(b.name)) || byCodePoint(a.iso, b.iso));

// No `generatedAt`: a timestamp would make every run differ and defeat the
// regeneration check. Nothing consumes it — see src/lib/stores/region-search-data.ts.
const output = {
	version: 1,
	source: 'data/wgsrpd-master/geojson/level4.geojson',
	regionCountries,
	countries
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(output));

const bytes = Buffer.byteLength(JSON.stringify(output));
console.log(
	`region-countries: ${countries.length} countries, ${Object.keys(regionCountries).length} TDWG3 regions -> ${OUT} (${(bytes / 1024).toFixed(1)} KB)`
);
