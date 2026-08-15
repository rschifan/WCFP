import { error, json } from '@sveltejs/kit';
import { queryRegionTaxonomy } from '$lib/server/region-taxonomy.js';
import type { SpeciesUseKey } from '$lib/types/species';

export const GET = async ({ params, url }) => {
	const code = decodeURIComponent(params.region).trim().toUpperCase();
	const q = url.searchParams.get('q')?.trim() ?? '';
	const geographicOnly = url.searchParams.get('geographicOnly') === 'true';
	const lifeforms = url.searchParams
		.getAll('lifeform')
		.map((value) => value.trim())
		.filter(Boolean);
	const uses = url.searchParams
		.getAll('use')
		.map((value) => value.trim())
		.filter(Boolean) as SpeciesUseKey[];

	if (!/^[A-Z]{3}$/.test(code)) {
		error(400, { message: 'Region must be a three-letter TDWG Level-3 code' });
	}

	if (!q && !geographicOnly && lifeforms.length === 0 && uses.length === 0) {
		error(400, {
			message: 'At least one of q, geographicOnly, lifeform, or use is required'
		});
	}

	let data;

	try {
		data = await queryRegionTaxonomy(code, {
			q,
			geographicOnly,
			lifeforms,
			uses
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to query region taxonomy';
		error(500, { message });
	}

	return json(
		{ data },
		{
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
};
