import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import XLSX from 'xlsx';
import { getConnection, query as runQuery } from './database';
import { mapTaxonomyNodeRow, queryTaxonomyRows, type TaxonomyNodeRow } from './queries';
import type { SpeciesUseKey } from '$lib/types/species';
import {
	USE_COLUMN_BY_KEY,
	WCFP_WORKSHEET_NAME
} from '../../../scripts/lib/wcfp-workbook.js';

// Sheet name and use-column mapping are imported, not re-declared: this suite exists to catch
// a source/database divergence, and a second copy of the mapping would drift silently past it.
const WORKBOOK_PATH = path.resolve(process.cwd(), 'data/WCFP.xlsx');
const DB_PATH = path.resolve(process.cwd(), 'data/wcfp.duckdb');
const HAS_RUNTIME_DATA = existsSync(WORKBOOK_PATH) && existsSync(DB_PATH);
const SAMPLE_SIZE = 10;
const SAMPLE_SEED = 'taxonomy-uses-db-vs-source-v1';
const WORKBOOK_USE_COLUMN_BY_KEY = USE_COLUMN_BY_KEY as Record<SpeciesUseKey, string>;

type WorkbookRow = Record<string, unknown>;

function normalizeTaxonomyValue(value: unknown): string {
	return String(value ?? '').trim() || 'Unknown';
}

function boolCell(value: unknown): boolean {
	return value === 1 || value === '1' || value === true || value === 'TRUE';
}

function readWorkbookRows(): WorkbookRow[] {
	const workbook = XLSX.readFile(WORKBOOK_PATH);
	const worksheet = workbook.Sheets[WCFP_WORKSHEET_NAME];

	if (!worksheet) {
		throw new Error(
			`Worksheet "${WCFP_WORKSHEET_NAME}" not found in ${WORKBOOK_PATH}. Available sheets: ${workbook.SheetNames.join(', ')}`
		);
	}

	return XLSX.utils.sheet_to_json<WorkbookRow>(worksheet);
}

function extractGenus(speciesName: string): string {
	const cleaned = speciesName.replace(/^[+×\s]+/, '').trim();
	return cleaned.split(/\s+/)[0] || 'Unknown';
}

function computeDeterministicHash(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function buildExpectedSpeciesUseIndex(): Map<string, Set<SpeciesUseKey>> {
	const index = new Map<string, Set<SpeciesUseKey>>();
	const rows = readWorkbookRows();

	for (const row of rows) {
		const name = String(row.taxon_name_accepted ?? '').trim();
		if (!name) {
			continue;
		}

		const useKeys = (Object.keys(WORKBOOK_USE_COLUMN_BY_KEY) as SpeciesUseKey[]).filter((useKey) =>
			boolCell(row[WORKBOOK_USE_COLUMN_BY_KEY[useKey]])
		);

		const family = normalizeTaxonomyValue(row.family);
		const genus = String(row.genus ?? '').trim() || extractGenus(name);
		const speciesPath = [
			'root',
			normalizeTaxonomyValue(row.kingdom),
			normalizeTaxonomyValue(row.phylum),
			normalizeTaxonomyValue(row.class),
			normalizeTaxonomyValue(row.order),
			family,
			genus,
			name
		].join('/');

		index.set(speciesPath, new Set(useKeys));
	}

	return index;
}

describe.runIf(HAS_RUNTIME_DATA)('taxonomy runtime data integration', () => {
	it(
		'matches workbook-derived uses for 10 deterministic random taxonomy species nodes',
		async () => {
			expect.assertions(2);

		const expectedIndex = buildExpectedSpeciesUseIndex();
		const candidatePaths = [...expectedIndex.keys()]
			.sort(
				(left, right) =>
					computeDeterministicHash(`${SAMPLE_SEED}:${left}`) -
					computeDeterministicHash(`${SAMPLE_SEED}:${right}`)
			)
			.slice(0, SAMPLE_SIZE);

		expect(candidatePaths).toHaveLength(SAMPLE_SIZE);

		const conn = await getConnection();
		const mismatches: Array<{
			pathKey: string;
			expectedUses: SpeciesUseKey[];
			actualUses: SpeciesUseKey[];
		}> = [];

		try {
			for (const pathKey of candidatePaths) {
				const rows = await runQuery<TaxonomyNodeRow>(
					conn,
					`SELECT
						node_id,
						parent_id,
						path,
						rank,
						depth,
						name,
						name_lower,
						count,
						child_count,
						wcfp_id,
						authors,
						has_distribution,
						distribution_area_count,
						has_cwr,
						lifeforms_json,
						use_mask
					FROM taxonomy_nodes
					WHERE path = ?`,
					[pathKey]
				);
				const actualUses = [...(rows[0] ? mapTaxonomyNodeRow(rows[0]).traits?.uses ?? [] : [])].sort();
				const expectedUses = [...(expectedIndex.get(pathKey) ?? new Set())].sort();

				if (JSON.stringify(actualUses) !== JSON.stringify(expectedUses)) {
					mismatches.push({ pathKey, expectedUses, actualUses });
				}
			}
		} finally {
			conn.close();
		}

		expect(mismatches).toEqual([]);
		},
		30_000
	);

	it('stores no trait payloads for non-species taxonomy rows', async () => {
		expect.assertions(1);

		const conn = await getConnection();

		try {
			const rows = await runQuery<{ non_species_trait_rows: number }>(
				conn,
				`SELECT COUNT(*) AS non_species_trait_rows
				 FROM taxonomy_nodes
				 WHERE rank != 'species'
				   AND (
					   has_cwr = TRUE
					   OR use_mask != 0
					   OR lifeforms_json != '[]'
				   )`
			);

			expect(Number(rows[0]?.non_species_trait_rows ?? 0)).toBe(0);
		} finally {
			conn.close();
		}
	});

	it(
		'applies taxonomy use filters against species truth and returns ancestors without traits',
		async () => {
			expect.assertions(4);

			const expectedIndex = buildExpectedSpeciesUseIndex();
			const conn = await getConnection();

			try {
				const rows = await queryTaxonomyRows(conn, { uses: ['humanFood'] });
				const nodes = rows.map((row) => mapTaxonomyNodeRow(row));
				const speciesNodes = nodes.filter((node) => node.rank === 'species');
				const higherRankNodes = nodes.filter((node) => node.rank !== 'species');

				expect(speciesNodes.length).toBeGreaterThan(0);
				expect(higherRankNodes.length).toBeGreaterThan(0);
				expect(
					speciesNodes.every((node) => expectedIndex.get(node.path ?? '')?.has('humanFood') === true)
				).toBe(true);
				expect(higherRankNodes.every((node) => node.traits === undefined)).toBe(true);
			} finally {
				conn.close();
			}
		},
		30_000
	);
});
