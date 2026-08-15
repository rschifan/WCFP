import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { PageLoad } from './$types';
import type { RegionFeatureCollection } from '$lib/stores/region-geometry';

export const load: PageLoad = async ({ params, parent }) => {
	const { regionsGeoJSON } = (await parent()) as {
		regionsGeoJSON: RegionFeatureCollection | null;
	};

	if (!regionsGeoJSON) return { regionCode: params.region };

	const code = params.region;
	const known = regionsGeoJSON.features.some((feature) => {
		const props = feature.properties ?? {};
		const featureCode =
			typeof props.LEVEL3_COD === 'string' ? props.LEVEL3_COD : (props.code as string | undefined);
		return featureCode === code;
	});

	if (!known) {
		throw redirect(307, `${base}/map`);
	}

	return { regionCode: code };
};
