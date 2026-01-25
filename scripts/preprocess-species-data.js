#!/usr/bin/env node

/**
 * Pre-processing script: CSV + XLSX → JSON files
 *
 * Converts the large species CSV into individual JSON files per region,
 * enriched with additional data from WCFP.xlsx (genus, lifeform, uses, etc.)
 *
 * Usage:
 *   node scripts/preprocess-species-data.js
 *
 * Input:
 *   - data/1.geo_distr_taxa.csv (55 MB, 376K rows)
 *   - data/3.WCFP.xlsx (for enrichment: genus, lifeform, uses, cwr, cultivated)
 * Output: static/data/species/*.json (238 files, ~50-200 KB each)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_CSV = path.join(__dirname, '../data/1.geo_distr_taxa.csv');
const INPUT_XLSX = path.join(__dirname, '../data/3.WCFP.xlsx');
const OUTPUT_DIR = path.join(__dirname, '../static/data/species');
const INDEX_FILE = path.join(OUTPUT_DIR, 'wcfp-ids-index.json');

// WCFP.xlsx column mapping for uses (columns C-F, H-M)
// Note: Column G (HumanFood) is intentionally excluded
const USE_COLUMNS = {
	AnimalFood: 'C',
	EnvironmentalUses: 'D',
	Fuels: 'E',
	GeneSources: 'F',
	// G = HumanFood (excluded)
	InvertebrateFood: 'H',
	Materials: 'I',
	Medicines: 'J',
	Poisons: 'K',
	SocialUses: 'L',
	Total: 'M'
};

// Statistics
let totalRows = 0;
let regionsProcessed = 0;
const regionMap = new Map();
const wcfpIdsSet = new Set();

console.log('🌱 Starting species data preprocessing...\n');
console.log(`📂 Input CSV:  ${INPUT_CSV}`);
console.log(`📂 Input XLSX: ${INPUT_XLSX}`);
console.log(`📁 Output: ${OUTPUT_DIR}\n`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	console.log(`✅ Created output directory`);
}

// ============================================================
// Step 1: Load WCFP.xlsx and build lookup map by WCFP_ID
// ============================================================
console.log('📖 Loading WCFP.xlsx for enrichment data...');
const workbook = XLSX.readFile(INPUT_XLSX);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const xlsxRows = XLSX.utils.sheet_to_json(worksheet);
console.log(`   Loaded ${xlsxRows.length.toLocaleString()} rows from XLSX`);

// Build lookup map: WCFP_ID -> enrichment data
const wcfpLookup = new Map();

for (const row of xlsxRows) {
	const wcfpIdRaw = row['WCFP_ID'];
	const wcfpId = typeof wcfpIdRaw === 'number' ? wcfpIdRaw : parseInt(wcfpIdRaw, 10);
	if (!Number.isFinite(wcfpId)) continue;

	// Extract genus from taxon_name_accepted (first word of binomial name)
	const taxonName = row['taxon_name_accepted'] || '';
	const genus = taxonName.split(' ')[0] || null;

	// Extract lifeform (actual column name in XLSX)
	const lifeform = row['lifeform'] || null;

	// Extract CWR (actual column name is 'CWR') - binary
	const cwrVal = row['CWR'];
	const cwr = cwrVal === 1 || cwrVal === '1' || cwrVal === true;

	// Note: No 'cultivated' column in XLSX - field not available

	// Extract uses (columns D-G, I-N based on actual headers)
	const total = parseInt(row['Total'] || 0, 10);
	let uses = null;

	if (total > 0) {
		uses = { total };

		// Only include non-zero/true use categories (using exact column names from XLSX)
		if (row['AnimalFood']) uses.animalFood = true;
		if (row['EnvironmentalUses']) uses.environmentalUses = true;
		if (row['Fuels']) uses.fuels = true;
		if (row['GeneSources']) uses.geneSources = true;
		if (row['InvertebrateFood']) uses.invertebrateFood = true;
		if (row['Materials']) uses.materials = true;
		if (row['Medicines']) uses.medicines = true;
		if (row['Poisons']) uses.poisons = true;
		if (row['SocialUses']) uses.socialUses = true;
	}

	wcfpLookup.set(wcfpId, { genus, lifeform, cwr, uses });
}

console.log(`   Built lookup map with ${wcfpLookup.size.toLocaleString()} entries\n`);

// ============================================================
// Step 2: Process CSV and enrich with XLSX data
// ============================================================

// Read and process CSV
fs.createReadStream(INPUT_CSV)
	.pipe(parse({ columns: true, skip_empty_lines: true }))
	.on('data', (row) => {
		totalRows++;

		const region = row.area;
		if (!region) return;

		// Initialize region array if needed
		if (!regionMap.has(region)) {
			regionMap.set(region, []);
		}

		// Validate and parse WCFP_ID
		const wcfpId = parseInt(row.WCFP_ID, 10);
		if (isNaN(wcfpId)) {
			console.warn(`Skipping row with invalid WCFP_ID: ${row.WCFP_ID}`);
			return;
		}

		wcfpIdsSet.add(wcfpId);

		// Build base species object
		const species = {
			wcfpId,
			name: row.taxon_name_accepted,
			authors: row.taxon_authors_accepted,
			family: row['family.x']
		};

		// Enrich with XLSX data (genus, lifeform, cwr, uses)
		const enrichment = wcfpLookup.get(wcfpId);
		if (enrichment) {
			// Only include non-null/non-false values to minimize JSON size
			if (enrichment.genus) species.genus = enrichment.genus;
			if (enrichment.lifeform) species.lifeform = enrichment.lifeform;
			if (enrichment.cwr) species.cwr = true;
			if (enrichment.uses) species.uses = enrichment.uses;
		}

		// Add species to region
		regionMap.get(region).push(species);
	})
	.on('end', () => {
		console.log(`\n📊 CSV Processing Complete:`);
		console.log(`   Total rows: ${totalRows.toLocaleString()}`);
		console.log(`   Unique regions: ${regionMap.size}`);

		console.log(`\n💾 Writing JSON files...`);

		// Write each region to its own JSON file
		for (const [region, species] of regionMap.entries()) {
			const filename = sanitizeFilename(region);
			const filepath = path.join(OUTPUT_DIR, `${filename}.json`);

			// Write JSON (no whitespace to minimize file size)
			fs.writeFileSync(filepath, JSON.stringify(species));

			regionsProcessed++;

			// Progress indicator
			if (regionsProcessed % 10 === 0) {
				process.stdout.write(`\r   Processed: ${regionsProcessed}/${regionMap.size} regions`);
			}
		}

		// Write WCFP_ID index (sorted for deterministic output)
		const indexArray = Array.from(wcfpIdsSet).sort((a, b) => a - b);
		fs.writeFileSync(INDEX_FILE, JSON.stringify(indexArray));
		const indexSizeKb = (fs.statSync(INDEX_FILE).size / 1024).toFixed(2);

		console.log(`\n\n✅ Success!`);
		console.log(`   Files created: ${regionsProcessed}`);
		console.log(
			`   Index: ${wcfpIdsSet.size.toLocaleString()} unique WCFP_IDs (${indexSizeKb} KB)`
		);

		// Calculate total output size
		const files = fs.readdirSync(OUTPUT_DIR);
		let totalSize = 0;
		files.forEach((file) => {
			const stats = fs.statSync(path.join(OUTPUT_DIR, file));
			totalSize += stats.size;
		});

		console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
		console.log(`   Average per file: ${(totalSize / files.length / 1024).toFixed(2)} KB`);

		// Show sample files
		console.log(`\n📝 Sample files created:`);
		files.slice(0, 5).forEach((file) => {
			const stats = fs.statSync(path.join(OUTPUT_DIR, file));
			console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
		});

		console.log(`\n🎉 Preprocessing complete!`);
	})
	.on('error', (err) => {
		console.error('\n❌ Error processing CSV:', err);
		process.exit(1);
	});

/**
 * Sanitize region name to valid filename.
 * IMPORTANT: Keep in sync with src/lib/utils/strings.ts sanitizeFilename()
 *
 * @example "Costa Rica" -> "Costa_Rica"
 */
function sanitizeFilename(regionName) {
	return regionName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}
