import { get, writable, type Readable } from 'svelte/store';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export const REGION_GEOJSON_VERSION = '2026-08-15-flora-share';

export type RegionFeatureProperties = Record<string, unknown> & {
	LEVEL3_COD?: string;
	LEVEL3_NAM?: string;
	code?: string;
	area?: string;
	unique_count?: number;
	family_count?: number;
	/** Total accepted vascular flora of the area, per WCVP. */
	flora_richness?: number;
	/** WCFP taxa as a percentage of that flora — the paper's Fig. 4 measure. */
	pct_of_flora?: number;
};

export type RegionFeature = Feature<Geometry | null, RegionFeatureProperties>;
export type RegionFeatureCollection = FeatureCollection<Geometry | null, RegionFeatureProperties>;

export interface RegionGeometryState {
	geoJSON: RegionFeatureCollection | null;
	featuresByCode: Map<string, RegionFeature>;
}

const EMPTY_STATE: RegionGeometryState = {
	geoJSON: null,
	featuresByCode: new Map()
};

const store = writable<RegionGeometryState>(EMPTY_STATE);

function getFeatureCode(properties: RegionFeatureProperties | null | undefined): string | null {
	if (!properties || typeof properties !== 'object') {
		return null;
	}

	if (typeof properties.LEVEL3_COD === 'string' && properties.LEVEL3_COD) {
		return properties.LEVEL3_COD;
	}

	if (typeof properties.code === 'string' && properties.code) {
		return properties.code;
	}

	return null;
}

function buildFeatureIndex(geoJSON: RegionFeatureCollection): Map<string, RegionFeature> {
	return new Map(
		geoJSON.features.flatMap((feature) => {
			const code = getFeatureCode(feature.properties);
			return code ? [[code, feature as RegionFeature] as const] : [];
		})
	);
}

export const regionGeometryStore: Readable<RegionGeometryState> = {
	subscribe: store.subscribe
};

export function primeRegionGeometryStore(geoJSON: RegionFeatureCollection): void {
	store.set({
		geoJSON,
		featuresByCode: buildFeatureIndex(geoJSON)
	});
}

export function clearRegionGeometryStore(): void {
	store.set(EMPTY_STATE);
}

export function getRegionGeometrySnapshot(): RegionGeometryState {
	return get(store);
}
