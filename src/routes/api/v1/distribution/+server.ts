/**
 * GET /api/v1/distribution
 *
 * Returns region identifiers for a taxonomy node's distribution.
 * This is the critical query powering the choropleth map.
 *
 * Query params:
 *   rank     - 'species' | 'genus' | 'family' | 'order' | 'class' | 'phylum' | 'kingdom'
 *   name     - taxon name at that rank (required for non-species ranks)
 *   wcfp_id  - WCFP ID (required when rank=species)
 *
 * Response:
 *   rank=species    -> [{ code, name, occurrenceStatus }]
 *   other ranks     -> [{ code, name, count }]
 */

import { json, error } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getDistributionForRank } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

const VALID_RANKS = new Set(['species', 'genus', 'family', 'order', 'class', 'phylum', 'kingdom']);

export const GET = async ({ url }) => {
	const rank = url.searchParams.get('rank')?.trim().toLowerCase();
	if (!rank || !VALID_RANKS.has(rank)) {
		error(400, { message: `rank must be one of: ${[...VALID_RANKS].join(', ')}` });
	}

	const name = url.searchParams.get('name')?.trim();
	const wcfpIdParam = url.searchParams.get('wcfp_id');
	const wcfpId = wcfpIdParam ? parseInt(wcfpIdParam, 10) : undefined;

	if (rank === 'species') {
		if (!wcfpId || isNaN(wcfpId)) {
			error(400, { message: 'wcfp_id is required when rank=species' });
		}
	} else {
		if (!name) {
			error(400, { message: 'name is required for non-species ranks' });
		}
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const distribution = await getDistributionForRank(conn, rank, name ?? '', wcfpId);
		const payload = { data: distribution };
		const serialized = JSON.stringify(payload);
		return new Response(serialized, {
			headers: {
				'content-type': 'application/json',
				'cache-control': 'no-store'
			}
		});
	} finally {
		if (conn) releaseConnection(conn);
	}
};
