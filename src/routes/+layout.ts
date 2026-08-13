import { base } from '$app/paths';
import type { LayoutLoad } from './$types';
import type { RegionFeatureCollection } from '$lib/stores/region-geometry';
import { REGION_GEOJSON_VERSION } from '$lib/stores/region-geometry';

export const load: LayoutLoad = async ({ fetch }) => {
	const response = await fetch(
		`${base}/api/v1/regions/geojson?v=${encodeURIComponent(REGION_GEOJSON_VERSION)}`
	);

	if (!response.ok) {
		throw new Error(`Failed to load shared region geometry: ${response.status}`);
	}

	return {
		regionsGeoJSON: (await response.json()) as RegionFeatureCollection
	};
};
