/**
 * GET /api/v1/regions/:region
 * Returns stats for a single region.
 */

import { json, error } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getRegionStats } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ params }) => {
	const area = decodeURIComponent(params.region).trim();
	if (!area || area.length > 500) {
		error(400, { message: 'Invalid region name' });
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const stats = await getRegionStats(conn, area);
		if (!stats) {
			error(404, { message: `Region "${area}" not found` });
		}
		return json({ data: stats }, {
			headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' }
		});
	} finally {
		if (conn) releaseConnection(conn);
	}
};
