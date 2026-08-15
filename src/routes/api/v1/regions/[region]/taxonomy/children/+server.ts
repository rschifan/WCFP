import { error, json } from '@sveltejs/kit';
import { getRegionTaxonomyChildren } from '$lib/server/region-taxonomy.js';

export const GET = async ({ params, url }) => {
	const code = decodeURIComponent(params.region).trim().toUpperCase();
	const parentId = url.searchParams.get('parentId')?.trim();

	if (!/^[A-Z]{3}$/.test(code)) {
		error(400, { message: 'Region must be a three-letter TDWG Level-3 code' });
	}

	if (!parentId) {
		error(400, { message: 'parentId is required' });
	}

	let data;

	try {
		data = await getRegionTaxonomyChildren(code, parentId);
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
