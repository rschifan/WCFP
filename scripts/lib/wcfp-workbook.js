import XLSX from 'xlsx';

export const WCFP_WORKSHEET_NAME = 'WCFP';

/**
 * Columns this module reads, other than the use flags. A missing column degrades silently —
 * `stringCell(…, 'Unknown')` and `boolCell(undefined)` never throw — so `readWcfpRows` asserts
 * the whole set is present rather than letting a rename produce a plausible-looking build.
 */
export const REQUIRED_COLUMNS = [
	'WCFP_ID',
	'taxon_name_accepted',
	'taxon_authors_accepted',
	'family',
	'kingdom',
	'phylum',
	'class',
	'order',
	'lifeform',
	'Link',
	'references_all',
	'CWR_GRIN',
	'cultivated_GRIN',
	'total_uses'
];

/** @typedef {Record<string, unknown>} WorkbookRow */

/** @type {readonly string[]} */
export const SPECIES_USE_KEYS = [
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

/** Use key → column name in the published workbook. @type {Record<string, string>} */
export const USE_COLUMN_BY_KEY = {
	humanFood: 'human_food',
	animalFood: 'animal_food',
	medicines: 'medicines',
	materials: 'materials',
	fuels: 'fuels',
	geneSources: 'gene_sources',
	poisons: 'poisons',
	invertebrateFood: 'invertebrate_food',
	environmentalUses: 'environmental_uses',
	socialUses: 'social_uses'
};

/**
 * @param {string} inputPath
 * @returns {WorkbookRow[]}
 */
export function readWcfpRows(inputPath) {
	const workbook = XLSX.readFile(inputPath);
	const worksheet = workbook.Sheets[WCFP_WORKSHEET_NAME];

	if (!worksheet) {
		throw new Error(
			`Worksheet "${WCFP_WORKSHEET_NAME}" not found in ${inputPath}. Available sheets: ${workbook.SheetNames.join(', ')}`
		);
	}

	const rows = /** @type {WorkbookRow[]} */ (XLSX.utils.sheet_to_json(worksheet));
	assertColumns(rows, inputPath);
	return rows;
}

/**
 * @param {WorkbookRow[]} rows
 * @param {string} inputPath
 */
function assertColumns(rows, inputPath) {
	const present = new Set();
	for (const row of rows) {
		for (const key of Object.keys(row)) present.add(key);
	}

	const expected = [...REQUIRED_COLUMNS, ...Object.values(USE_COLUMN_BY_KEY)];
	const missing = expected.filter((column) => !present.has(column));

	if (missing.length > 0) {
		throw new Error(
			`Worksheet "${WCFP_WORKSHEET_NAME}" in ${inputPath} is missing ${missing.length} expected ` +
				`column(s): ${missing.join(', ')}.\n` +
				`Present columns: ${[...present].sort().join(', ')}.\n` +
				`These columns degrade silently to 'Unknown'/false rather than failing, so the build ` +
				`stops here instead of producing a database with, say, no recorded uses.`
		);
	}
}

/** @param {unknown} value */
export function parseWcfpId(value) {
	const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
	return Number.isFinite(parsed) ? parsed : null;
}

/** @param {unknown} value */
export function boolCell(value) {
	return value === 1 || value === '1' || value === true || value === 'TRUE';
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
export function stringCell(value, fallback = '') {
	return String(value ?? '').trim() || fallback;
}

/** @param {unknown} speciesName */
export function extractGenus(speciesName) {
	if (!speciesName) return 'Unknown';
	const cleaned = String(speciesName)
		.replace(/^[+×\s]+/, '')
		.trim();
	return cleaned.split(/\s+/)[0] || 'Unknown';
}

/** @param {unknown} value */
export function parseReferencesAll(value) {
	const raw = stringCell(value, '');
	if (!raw) return [];
	if (!raw.includes(';')) return [raw];

	return raw
		.split(';')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

/**
 * @param {WorkbookRow} row
 * @returns {{ total: number } & Record<string, boolean|number> | null}
 */
export function buildSpeciesUses(row) {
	/** @type {Record<string, boolean>} */
	const uses = {};
	let selectedCount = 0;

	for (const useKey of SPECIES_USE_KEYS) {
		const columnName = USE_COLUMN_BY_KEY[useKey];
		if (!boolCell(row[columnName])) continue;
		uses[useKey] = true;
		selectedCount += 1;
	}

	const totalFromSheet = parseInt(String(row['total_uses'] ?? ''), 10);
	const total =
		Number.isFinite(totalFromSheet) && totalFromSheet > 0 ? totalFromSheet : selectedCount;

	if (total === 0) {
		return null;
	}

	return {
		total,
		...uses
	};
}

/**
 * @param {WorkbookRow} row
 */
export function buildSpeciesRecordFromRow(row) {
	const wcfpId = parseWcfpId(row['WCFP_ID']);
	const name = stringCell(row['taxon_name_accepted'], '');

	if (!wcfpId || !name) {
		return null;
	}

	const authors = stringCell(row['taxon_authors_accepted'], '');
	const family = stringCell(row['family'], 'Unknown');
	// The published workbook carries no genus column; it is the leading epithet of the accepted
	// name, with any hybrid marker stripped. Derived, not defaulted.
	const genus = extractGenus(name);
	const lifeform = stringCell(row['lifeform'], '');
	const sourceLink = stringCell(row['Link'], '');
	const referencesAllRaw = stringCell(row['references_all'], '');
	const referencesAll = parseReferencesAll(referencesAllRaw);
	const uses = buildSpeciesUses(row);

	return {
		wcfpId,
		name,
		authors,
		family,
		genus,
		...(lifeform ? { lifeform } : {}),
		// Two independent GRIN fields: a taxon may be cultivated, an edible crop wild relative,
		// both, or neither. The glossary explains the distinction, so the portal has to carry it.
		...(boolCell(row['CWR_GRIN']) ? { cwr: true } : {}),
		...(boolCell(row['cultivated_GRIN']) ? { cultivated: true } : {}),
		...(uses ? { uses } : {}),
		...(sourceLink ? { sourceLink } : {}),
		...(referencesAll.length > 0 ? { referencesAll } : {}),
		referencesAllRaw
	};
}
