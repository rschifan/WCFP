/**
 * GET /api/v1/regions/counts?status=native
 *
 * Per-region taxon counts restricted to one occurrence status, for recolouring the choropleth.
 * Small payload (367 rows at most) — the unfiltered counts already ship embedded in
 * /api/v1/regions/geojson, so the default map view makes no request here at all.
 */

import { error, json } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import {
	getRegionCountsByStatus,
	OCCURRENCE_STATUSES,
	type OccurrenceStatus
} from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ url }: { url: URL }) => {
	const status = (url.searchParams.get('status') ?? '').trim().toLowerCase();

	if (!(OCCURRENCE_STATUSES as readonly string[]).includes(status)) {
		error(400, {
			message: `status must be one of: ${OCCURRENCE_STATUSES.join(', ')}`
		});
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const data = await getRegionCountsByStatus(conn, status as OccurrenceStatus);
		return json(
			{ status, data },
			{ headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } }
		);
	} finally {
		if (conn) releaseConnection(conn);
	}
};
