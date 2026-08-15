import { error, json } from '@sveltejs/kit';
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from '$lib/server/queries.js';
import { getRegionTaxonomyBootstrap } from '$lib/server/region-taxonomy.js';

export const GET = async ({ params, url }) => {
	const code = decodeURIComponent(params.region).trim().toUpperCase();
	const statusParam = (url.searchParams.get('status') ?? '').trim().toLowerCase();
	const status = OCCURRENCE_STATUSES.includes(statusParam as OccurrenceStatus)
		? (statusParam as OccurrenceStatus)
		: null;

	if (!/^[A-Z]{3}$/.test(code)) {
		error(400, { message: 'Region must be a three-letter TDWG Level-3 code' });
	}

	let data;

	try {
		data = await getRegionTaxonomyBootstrap(code, status);
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
