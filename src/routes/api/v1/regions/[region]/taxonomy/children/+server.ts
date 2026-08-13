import { error, json } from '@sveltejs/kit';
import { getRegionTaxonomyChildren } from '$lib/server/region-taxonomy.js';

export const GET = async ({ params, url }) => {
	const area = decodeURIComponent(params.region).trim();
	const parentId = url.searchParams.get('parentId')?.trim();

	if (!area || area.length > 500) {
		error(400, { message: 'Invalid region name' });
	}

	if (!parentId) {
		error(400, { message: 'parentId is required' });
	}

	let data;

	try {
		data = await getRegionTaxonomyChildren(area, parentId);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load region taxonomy children';
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
