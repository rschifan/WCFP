/**
 * GET /api/v1/regions
 * Returns all regions with pre-aggregated stats.
 */

import { json } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getAllRegionStats } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async () => {
	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const regions = await getAllRegionStats(conn);
		return json({ data: regions }, {
			headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' }
		});
	} finally {
		if (conn) releaseConnection(conn);
	}
};
