#!/usr/bin/env node

/**
 * Pre-processing script: XLSX → taxonomy-full.json
 *
 * Builds a compact, schema-based taxonomy tree with WCFP_ID stored
 * directly on species nodes.
 *
 * Usage:
 *   node scripts/preprocess-taxonomy-tree.js
 *
 * Input:  data/3.WCFP.xlsx
 * Output: static/data/taxonomy/taxonomy-full.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_XLSX = path.join(__dirname, '../data/3.WCFP.xlsx');
const OUTPUT_DIR = path.join(__dirname, '../static/data/taxonomy');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'taxonomy-full.json');

// Rank hierarchy (schema) in order from root to species
const RANKS = ['root', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];

// Column names in 3.WCFP.xlsx for each taxonomic level (based on actual headers)
// We use the GBIF-derived hierarchy plus the aggregated family name column.
// Note: genus is not a column - it's extracted from the species name
const LEVEL_COLUMNS = [
	'kingdom_GBIF', // kingdom
	'phylum_GBIF', // phylum
	'class_GBIF', // class
	'order_GBIF', // order
	'ALL_families' // family
];

/**
 * Extract genus from a species name (first word of binomial name).
 * Handles special characters like + and × at the start.
 */
function extractGenus(speciesName) {
	if (!speciesName) return 'Unknown';
	// Remove leading special characters (+, ×, etc.) and whitespace
	const cleaned = speciesName.replace(/^[+×\s]+/, '').trim();
	// Get first word (the genus)
	const genus = cleaned.split(/\s+/)[0];
	return genus || 'Unknown';
}

console.log('🌳 Starting taxonomy tree preprocessing...\n');
console.log(`📂 Input:  ${INPUT_XLSX}`);
console.log(`📁 Output: ${OUTPUT_FILE}\n`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	console.log('✅ Created output directory');
}

// Read Excel file
console.log('📖 Reading XLSX file (this may take a moment)...');
const workbook = XLSX.readFile(INPUT_XLSX);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON rows
console.log('🔄 Converting sheet to JSON...');
/** @type {Array<Record<string, any>>} */
const rows = XLSX.utils.sheet_to_json(worksheet);
console.log(`   Total rows: ${rows.length.toLocaleString()}`);

// Helper: safely read a string cell, falling back to "Unknown"
function getCell(row, key, fallback = 'Unknown') {
	const value = row[key];
	if (value === null || value === undefined || value === '') return fallback;
	return String(value);
}

// Root node with schema and helper map
const root = {
	schema: { ranks: RANKS },
	name: 'root',
	children: [],
	count: 0,
	_childrenMap: new Map()
};

let processedRows = 0;
let skippedRows = 0;

for (const row of rows) {
	processedRows++;

	// Parse WCFP_ID
	const wcfpIdRaw = row['WCFP_ID'];
	const wcfpId = typeof wcfpIdRaw === 'number' ? wcfpIdRaw : parseInt(wcfpIdRaw, 10);
	if (!Number.isFinite(wcfpId)) {
		skippedRows++;
		continue;
	}

	const speciesName = getCell(row, 'taxon_name_accepted', '').trim();
	if (!speciesName) {
		skippedRows++;
		continue;
	}

	// Update root aggregate count
	root.count += 1;

	// Walk down the hierarchy: kingdom → phylum → class → order → family
	let node = root;
	for (const columnName of LEVEL_COLUMNS) {
		const key = getCell(row, columnName);

		if (!node._childrenMap) {
			node._childrenMap = new Map();
		}

		if (!node._childrenMap.has(key)) {
			const child = {
				name: key,
				children: [],
				count: 0,
				_childrenMap: new Map()
			};
			node._childrenMap.set(key, child);
			node.children.push(child);
		}

		node = node._childrenMap.get(key);
		node.count += 1;
	}

	// Now node is the family; add genus level (extracted from species name)
	const genusName = extractGenus(speciesName);
	if (!node._childrenMap) {
		node._childrenMap = new Map();
	}
	if (!node._childrenMap.has(genusName)) {
		const genusNode = {
			name: genusName,
			children: [],
			count: 0,
			_childrenMap: new Map()
		};
		node._childrenMap.set(genusName, genusNode);
		node.children.push(genusNode);
	}
	node = node._childrenMap.get(genusName);
	node.count += 1;

	// Now node is the genus; create a species leaf
	const speciesNode = {
		name: speciesName,
		// Rank is inferred from depth via schema.ranks, so we don't store it here
		wcfpId,
		children: [],
		count: 1
	};

	node.children.push(speciesNode);
}

console.log('\n📊 Processing complete:');
console.log(`   Processed rows: ${processedRows.toLocaleString()}`);
console.log(`   Skipped rows (missing WCFP_ID or name): ${skippedRows.toLocaleString()}`);

// Strip helper maps before writing
function stripHelpers(node, depth = 0) {
	if (node._childrenMap) {
		node._childrenMap.clear();
		delete node._childrenMap;
	}

	for (const child of node.children ?? []) {
		if (child && typeof child === 'object') {
			stripHelpers(child, depth + 1);
		}
	}
}

console.log('\n🧹 Stripping helper fields...');
stripHelpers(root);

// Write output JSON (pretty for readability; can be minified later if needed)
console.log('\n💾 Writing taxonomy-full.json...');
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(root, null, 2));

const fileSize = fs.statSync(OUTPUT_FILE).size;
console.log(`   File size: ${(fileSize / 1024).toFixed(2)} KB`);

console.log('\n🎉 Taxonomy tree preprocessing complete!');

