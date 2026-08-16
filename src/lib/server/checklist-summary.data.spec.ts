import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getConnection } from './database';
import { getChecklistSummary } from './queries';

/**
 * The figures the portal displays, pinned to the submitted manuscript rather than to themselves.
 *
 * These are the counts in the Data Records section of `references/wcfp_ms_R1_clean.pdf`
 * (ll. 292-300, 423). The portal once displayed 26,632 taxa against a corrected 26,622 and nothing
 * caught it, because the numbers were literals in the markup agreeing only with each other. Asserting
 * against the paper means a data refresh that moves a published figure fails here first.
 */
const PAPER = {
	taxa: 26622,
	species: 26419,
	hybrids: 201,
	graftChimaerae: 2,
	genera: 5009,
	families: 412,
	orders: 109,
	classes: 17,
	phyla: 5,
	cwr: 1825,
	areas: 367,
	distributionRecords: 376373,
	occurrenceRecords: { native: 277848, introduced: 97799, extinct: 277, doubtful: 449 }
};

const DB_PATH = path.resolve(process.cwd(), 'data/wcfp.duckdb');
const HAS_RUNTIME_DATA = existsSync(DB_PATH);

describe.runIf(HAS_RUNTIME_DATA)('getChecklistSummary', () => {
	it('reports the figures published in the paper', async () => {
		expect.assertions(2);

		const conn = await getConnection({ spatial: false });
		try {
			const summary = await getChecklistSummary(conn);

			expect(summary).toMatchObject(PAPER);
			// Stated separately because it is a claim about the data, not a published count: the
			// checklist admitted only taxa with a documented human food use, so the category is the
			// inclusion criterion and the About page must not present it as one facet among ten.
			expect(summary.uses.humanFood).toBe(summary.taxa);
		} finally {
			conn.close();
		}
	});

	it('splits taxa from species on the hybrid and graft-chimaera markers', async () => {
		expect.assertions(2);

		const conn = await getConnection({ spatial: false });
		try {
			const summary = await getChecklistSummary(conn);

			expect(summary.species + summary.hybrids + summary.graftChimaerae).toBe(summary.taxa);
			expect(summary.occurrenceRecords.native + summary.occurrenceRecords.introduced).toBeLessThan(
				summary.distributionRecords
			);
		} finally {
			conn.close();
		}
	});
});
