import { error, json } from '@sveltejs/kit';
import { getTaxonomyBootstrap } from '$lib/server/taxonomy-bootstrap.js';

/**
 * GET /api/v1/taxonomy/bootstrap
 * Returns the DB-backed taxonomy bootstrap payload for the taxonomy view.
 */
export const GET = async () => {
	let data;

	try {
		data = await getTaxonomyBootstrap();
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load taxonomy bootstrap';
		error(500, { message });
	}

	return json(
		{ data },
		{
			headers: {
				'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
			}
		}
	);
};
