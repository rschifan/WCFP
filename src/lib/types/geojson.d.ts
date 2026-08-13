/**
 * Minimal GeoJSON type definitions
 * Avoids needing @types/geojson package
 */

declare module 'geojson' {
	export interface Geometry {
		type: string;
		coordinates?: unknown;
		geometries?: Geometry[];
		[key: string]: unknown;
	}

	export type GeoJsonProperties = Record<string, unknown> | null;

	export interface FeatureCollection<
		G extends Geometry | null = Geometry,
		P extends GeoJsonProperties = GeoJsonProperties
	> {
		type: 'FeatureCollection';
		features: Feature<G, P>[];
	}

	export interface Feature<
		G extends Geometry | null = Geometry,
		P extends GeoJsonProperties = GeoJsonProperties
	> {
		type: 'Feature';
		geometry: G;
		properties: P;
		id?: string | number;
	}
}
