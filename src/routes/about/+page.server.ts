/**
 * The About page states the size and shape of the checklist, so it reads those figures from the
 * database rather than carrying them as literals that go stale the next time the data is corrected.
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
