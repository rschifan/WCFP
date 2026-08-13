/**
 * GET /api/v1/species/:wcfpId
 * Returns a single species by WCFP ID.
 */

import { json, error } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getSpeciesById } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ params }) => {
	const wcfpId = parseInt(params.wcfpId, 10);
	if (isNaN(wcfpId)) {
		error(400, { message: 'wcfpId must be an integer' });
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const species = await getSpeciesById(conn, wcfpId);
		if (!species) {
			error(404, { message: `Species ${wcfpId} not found` });
		}
		return json({ data: species }, {
			headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' }
		});
	} finally {
		if (conn) releaseConnection(conn);
	}
};
