#!/usr/bin/env node

/**
 * Pre-processing script: XLSX → families.json
 *
 * Extracts taxonomy hierarchy from WCFP data and creates a single
 * lookup file for both visualization and merging with species data.
 *
 * Usage:
 *   node scripts/preprocess-taxonomy.js
 *
 * Input:  data/3.WCFP.xlsx
 * Output: static/data/taxonomy/families.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_XLSX = path.join(__dirname, '../data/3.WCFP.xlsx');
const OUTPUT_DIR = path.join(__dirname, '../static/data/taxonomy');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'families.json');

console.log('🌳 Starting taxonomy preprocessing...\n');
console.log(`📂 Input:  ${INPUT_XLSX}`);
console.log(`📁 Output: ${OUTPUT_FILE}\n`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	console.log(`✅ Created output directory`);
}

// Read Excel file
console.log('📖 Reading XLSX file (this may take a moment)...');
const workbook = XLSX.readFile(INPUT_XLSX);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
console.log('🔄 Converting to JSON...');
const rows = XLSX.utils.sheet_to_json(worksheet);
console.log(`   Total rows: ${rows.length.toLocaleString()}`);

// Extract unique families with taxonomy
const familyMap = new Map();
let processedRows = 0;
let skippedRows = 0;

for (const row of rows) {
	processedRows++;

	const family = row['ALL_families'];
	const kingdom = row['kingdom_GBIF'];
	const phylum = row['phylum_GBIF'];
	const classRank = row['class_GBIF'];
	const order = row['order_GBIF'];

	// Skip rows without family
	if (!family) {
		skippedRows++;
		continue;
	}

	// Initialize or update family entry
	if (!familyMap.has(family)) {
		familyMap.set(family, {
			kingdom: kingdom || 'Unknown',
			phylum: phylum || 'Unknown',
			class: classRank || 'Unknown',
			order: order || 'Unknown',
			speciesCount: 1
		});
	} else {
		// Increment species count
		familyMap.get(family).speciesCount++;
	}

	// Progress indicator
	if (processedRows % 5000 === 0) {
		process.stdout.write(`\r   Processed: ${processedRows.toLocaleString()} rows`);
	}
}

console.log(`\n\n📊 Processing Complete:`);
console.log(`   Total rows: ${processedRows.toLocaleString()}`);
console.log(`   Skipped (no family): ${skippedRows.toLocaleString()}`);
console.log(`   Unique families: ${familyMap.size.toLocaleString()}`);

// Convert Map to sorted object
const families = {};
const sortedFamilies = Array.from(familyMap.entries()).sort((a, b) =>
	a[0].localeCompare(b[0])
);

for (const [family, data] of sortedFamilies) {
	families[family] = data;
}

// Calculate statistics
const stats = {
	kingdoms: new Set(),
	phyla: new Set(),
	classes: new Set(),
	orders: new Set()
};

for (const data of Object.values(families)) {
	stats.kingdoms.add(data.kingdom);
	stats.phyla.add(data.phylum);
	stats.classes.add(data.class);
	stats.orders.add(data.order);
}

console.log(`\n📈 Taxonomy Statistics:`);
console.log(`   Kingdoms: ${stats.kingdoms.size}`);
console.log(`   Phyla: ${stats.phyla.size}`);
console.log(`   Classes: ${stats.classes.size}`);
console.log(`   Orders: ${stats.orders.size}`);
console.log(`   Families: ${familyMap.size}`);

// Write output
console.log(`\n💾 Writing ${OUTPUT_FILE}...`);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(families, null, 2));

const fileSize = fs.statSync(OUTPUT_FILE).size;
console.log(`   File size: ${(fileSize / 1024).toFixed(2)} KB`);

// Show sample entries
console.log(`\n📝 Sample entries:`);
const sampleFamilies = Object.entries(families).slice(0, 3);
for (const [family, data] of sampleFamilies) {
	console.log(`   ${family}:`);
	console.log(`     Path: ${data.kingdom} → ${data.phylum} → ${data.class} → ${data.order}`);
	console.log(`     Species: ${data.speciesCount}`);
}

console.log(`\n🎉 Taxonomy preprocessing complete!`);
