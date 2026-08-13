import { error, json } from '@sveltejs/kit';
import { getTaxonomyChildren } from '$lib/server/taxonomy-bootstrap.js';

export const GET = async ({ url }) => {
	const parentId = url.searchParams.get('parentId')?.trim();

	if (!parentId) {
		error(400, { message: 'parentId is required' });
	}

	let data;

	try {
		data = await getTaxonomyChildren(parentId);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load taxonomy children';
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
