/**
 * The landing hero quotes the headline figures. They come from the same query the About page uses,
 * so the two pages cannot disagree with each other or with the database.
 */

import { borrowConnection, releaseConnection } from '$lib/server/database.js';
import { getChecklistSummary } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	let conn: Connection | undefined;
	try {
		conn = borrowConnection();
		return { summary: await getChecklistSummary(conn) };
	} finally {
		if (conn) releaseConnection(conn);
	}
};
