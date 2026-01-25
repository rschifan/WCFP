import type { PageLoad } from './$types';
import type { TaxonomyNode, FamilyLookup } from '$lib/types/taxonomy';
import type { FeatureCollection } from 'geojson';

/**
 * Load data for the taxonomy map route.
 * Fetches taxonomy tree, families lookup, and GeoJSON in parallel.
 */
export const load: PageLoad = async ({ fetch }) => {
	// Fetch all data in parallel for better performance
	const [taxonomyResponse, familiesResponse, geoJSONResponse, indexResponse] = await Promise.all([
		fetch('/data/taxonomy/taxonomy-full.json'),
		fetch('/data/taxonomy/families.json'),
		fetch('/data/level3_merged_wcfp.geojson'),
		fetch('/data/species/wcfp-ids-index.json')
	]);

	// Check all responses
	if (!taxonomyResponse.ok) {
		throw new Error(`Failed to load taxonomy data: ${taxonomyResponse.status}`);
	}
	if (!familiesResponse.ok) {
		throw new Error(`Failed to load families data: ${familiesResponse.status}`);
	}
	if (!geoJSONResponse.ok) {
		throw new Error(`Failed to load GeoJSON data: ${geoJSONResponse.status}`);
	}
	if (!indexResponse.ok) {
		throw new Error(`Failed to load WCFP_ID index: ${indexResponse.status}`);
	}

	// Parse all data
	const [taxonomyTree, families, geoJSON, indexArray] = await Promise.all([
		taxonomyResponse.json() as Promise<TaxonomyNode>,
		familiesResponse.json() as Promise<FamilyLookup>,
		geoJSONResponse.json() as Promise<FeatureCollection>,
		indexResponse.json() as Promise<number[]>
	]);

	return {
		taxonomyTree,
		families,
		geoJSON,
		wcfpIdsWithSpatialData: new Set(indexArray)
	};
};
