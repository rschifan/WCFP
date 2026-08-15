/**
 * GET /api/v1/species
 *
 * Full-text search across species.
 *
 * Query params:
 *   q      - BM25 search query (required)
 *   limit  - max results (default 50, max 200)
 */

import { json, error } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { searchSpecies } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q) {
		error(400, { message: 'q parameter is required' });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const species = await searchSpecies(conn, q, limit);
		return json({ data: species });
	} finally {
		if (conn) releaseConnection(conn);
	}
};
