/**
 * GET /api/v1/regions/:region/stats
 * Returns stats + top families for a single region.
 */

import { json, error } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getRegionStats, getRegionTopFamilies } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ params }) => {
	const code = decodeURIComponent(params.region).trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(code)) {
		error(400, { message: 'Region must be a three-letter TDWG Level-3 code' });
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const [stats, topFamilies] = await Promise.all([
			getRegionStats(conn, code),
			getRegionTopFamilies(conn, code)
		]);

		if (!stats) {
			error(404, { message: `Region "${code}" not found` });
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
