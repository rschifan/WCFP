/**
 * Minimal GeoJSON type definitions
 * Avoids needing @types/geojson package
 */

declare module 'geojson' {
	export interface FeatureCollection<G = any, P = any> {
		type: 'FeatureCollection';
		features: Feature<G, P>[];
	}

	export interface Feature<G = any, P = any> {
		type: 'Feature';
		geometry: G;
		properties: P;
		id?: string | number;
	}
}
