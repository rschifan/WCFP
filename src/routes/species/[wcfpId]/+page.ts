import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import {
	buildTaxonDistribution,
	speciesDistributionUrl,
	type DistributionApiRow,
	type TaxonDistribution
} from '$lib/services/spatial-distribution/load-distribution';
import type { Species } from '$lib/types/species';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url, fetch }) => {
	const wcfpId = Number.parseInt(params.wcfpId, 10);
	if (!Number.isInteger(wcfpId) || wcfpId <= 0) {
		error(400, 'A WCFP ID is a positive integer.');
	}

	// Both requests are independent, and the map is as much the point as the record.
	const [speciesResponse, distributionResponse] = await Promise.all([
		fetch(`${base}/api/v1/species/${wcfpId}`),
		fetch(speciesDistributionUrl(wcfpId))
	]);

	if (speciesResponse.status === 404) {
		error(404, `No species with WCFP ID ${wcfpId}.`);
	}
	if (!speciesResponse.ok) {
		error(speciesResponse.status, 'Could not load this species.');
	}

	const speciesBody = (await speciesResponse.json()) as { data: Species };

	// A missing distribution is a thinner page, not a broken one.
	let distribution: TaxonDistribution = { distributionData: new Map(), areaCount: 0 };
	if (distributionResponse.ok) {
		const body = (await distributionResponse.json()) as { data: DistributionApiRow[] };
		distribution = buildTaxonDistribution(body.data ?? [], true);
	}

	return {
		species: speciesBody.data,
		distribution,
		view: url.searchParams.get('view') === 'distribution' ? 'distribution' : 'overview'
	} as const;
};
