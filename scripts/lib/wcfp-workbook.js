import XLSX from 'xlsx';

export const WCFP_WORKSHEET_NAME = 'WCFP_260120';

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

export const USE_COLUMN_BY_KEY = {
	humanFood: 'HumanFood',
	animalFood: 'AnimalFood',
	medicines: 'Medicines',
	materials: 'Materials',
	fuels: 'Fuels',
	geneSources: 'GeneSources',
	poisons: 'Poisons',
	invertebrateFood: 'InvertebrateFood',
	environmentalUses: 'EnvironmentalUses',
	socialUses: 'SocialUses'
};

export function readWcfpRows(inputPath) {
	const workbook = XLSX.readFile(inputPath);
	const worksheet = workbook.Sheets[WCFP_WORKSHEET_NAME];

	if (!worksheet) {
		throw new Error(
			`Worksheet "${WCFP_WORKSHEET_NAME}" not found in ${inputPath}. Available sheets: ${workbook.SheetNames.join(', ')}`
		);
	}

	return XLSX.utils.sheet_to_json(worksheet);
}

export function parseWcfpId(value) {
	const parsed = typeof value === 'number' ? value : parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

export function boolCell(value) {
	return value === 1 || value === '1' || value === true || value === 'TRUE';
}

export function stringCell(value, fallback = '') {
	return String(value ?? '').trim() || fallback;
}

export function extractGenus(speciesName) {
	if (!speciesName) return 'Unknown';
	const cleaned = String(speciesName)
		.replace(/^[+×\s]+/, '')
		.trim();
	return cleaned.split(/\s+/)[0] || 'Unknown';
}

export function parseReferencesAll(value) {
	const raw = stringCell(value, '');
	if (!raw) return [];
	if (!raw.includes(';')) return [raw];

	return raw
		.split(';')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function buildSpeciesUses(row) {
	const uses = {};
	let selectedCount = 0;

	for (const useKey of SPECIES_USE_KEYS) {
		const columnName = USE_COLUMN_BY_KEY[useKey];
		if (!boolCell(row[columnName])) continue;
		uses[useKey] = true;
		selectedCount += 1;
	}

	const totalFromSheet = parseInt(row['Total'], 10);
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

export function buildSpeciesRecordFromRow(row) {
	const wcfpId = parseWcfpId(row['WCFP_ID']);
	const name = stringCell(row['taxon_name_accepted'], '');

	if (!wcfpId || !name) {
		return null;
	}

	const authors = stringCell(row['taxon_authors_accepted'], '');
	const family = stringCell(row['family'], 'Unknown');
	const genus = stringCell(row['genus'], extractGenus(name));
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
		...(boolCell(row['CWR']) ? { cwr: true } : {}),
		...(uses ? { uses } : {}),
		...(sourceLink ? { sourceLink } : {}),
		...(referencesAll.length > 0 ? { referencesAll } : {}),
		referencesAllRaw
	};
}
