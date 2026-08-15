/**
 * GET /api/v1/regions/:region/species
 *
 * Query params:
 *   lifeform   - comma-separated lifeform values (e.g. "tree,shrub")
 *   cwr        - "true" to filter for crop wild relatives only
 *   uses       - comma-separated use keys (e.g. "medicines,fuels")
 *   limit      - max rows (default 5000, max 10000)
 *   offset     - row offset (default 0)
 */

import { json, error } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getSpeciesForRegion } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ params, url }) => {
	const code = decodeURIComponent(params.region).trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(code)) {
		error(400, { message: 'Region must be a three-letter TDWG Level-3 code' });
	}

	const lifeformParam = url.searchParams.get('lifeform');
	const cwrParam = url.searchParams.get('cwr');
	const usesParam = url.searchParams.get('uses');
	const limit = parseInt(url.searchParams.get('limit') ?? '5000', 10);
	const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

	if (isNaN(limit) || limit < 1 || limit > 10000) {
		error(400, { message: 'limit must be between 1 and 10000' });
	}
	if (isNaN(offset) || offset < 0) {
		error(400, { message: 'offset must be >= 0' });
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const species = await getSpeciesForRegion(conn, code, {
			lifeforms: lifeformParam ? lifeformParam.split(',').map((s) => s.trim()) : undefined,
			cwr: cwrParam === 'true' ? true : undefined,
			uses: usesParam ? usesParam.split(',').map((s) => s.trim()) : undefined,
			limit,
			offset
		});

		return json({ data: species });
	} finally {
		if (conn) releaseConnection(conn);
	}
};
