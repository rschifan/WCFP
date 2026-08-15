/**
 * GET /api/v1/regions/facets            — taxa per occurrence status, worldwide
 * GET /api/v1/regions/facets?region=ITA — the same, scoped to one region
 *
 * Feeds the counts beside each option in the filter rail. Showing how large a bucket is before
 * it is clicked is what makes the filter answer a question rather than just narrow a list.
 */

import { error, json } from '@sveltejs/kit';
import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getStatusFacets } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';

export const GET = async ({ url }: { url: URL }) => {
	const raw = (url.searchParams.get('region') ?? '').trim().toUpperCase();

	if (raw && !/^[A-Z]{3}$/.test(raw)) {
		error(400, { message: 'region must be a three-letter TDWG Level-3 code' });
	}

	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		const facets = await getStatusFacets(conn, raw || null);
		return json(
			{ region: raw || null, data: facets },
			{ headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } }
		);
	} finally {
		if (conn) releaseConnection(conn);
	}
};
