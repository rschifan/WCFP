/**
 * GET /api/v1/regions/:region/stats
 * Returns stats + top families for a single region.
 */

import { json, error } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getRegionStats, getRegionTopFamilies } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ params }) => {
	const area = decodeURIComponent(params.region).trim();
	if (!area || area.length > 500) {
		error(400, { message: 'Invalid region name' });
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const [stats, topFamilies] = await Promise.all([
			getRegionStats(conn, area),
			getRegionTopFamilies(conn, area)
		]);

		if (!stats) {
			error(404, { message: `Region "${area}" not found` });
		}

		return json({
			data: {
				...stats,
				top_families: topFamilies.map((f) => ({ family: f.family, count: f.cnt }))
			}
		}, {
			headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' }
		});
	} finally {
		if (conn) releaseConnection(conn);
	}
};
