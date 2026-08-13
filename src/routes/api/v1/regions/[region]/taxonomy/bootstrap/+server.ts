import { error, json } from '@sveltejs/kit';
import { getRegionTaxonomyBootstrap } from '$lib/server/region-taxonomy.js';

export const GET = async ({ params }) => {
	const area = decodeURIComponent(params.region).trim();

	if (!area || area.length > 500) {
		error(400, { message: 'Invalid region name' });
	}

	let data;

	try {
		data = await getRegionTaxonomyBootstrap(area);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load region taxonomy';
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
