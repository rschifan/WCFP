/**
 * GET /api/v1/regions/geojson
 * Returns a GeoJSON FeatureCollection with region geometries and live species counts.
 * Geometry is simplified with ST_Simplify(geom, 0.01) — ~60% smaller than raw.
 */

import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/database.js';
import { getGeoFeatures } from '$lib/server/queries.js';
import type { Connection } from 'duckdb';
import type { FeatureCollection } from 'geojson';

let cachedGeoJSON: FeatureCollection | null = null;
let geoJSONPromise: Promise<FeatureCollection> | null = null;

async function loadGeoJSON(): Promise<FeatureCollection> {
	let conn: Connection | undefined;
	try {
		conn = await getConnection();
		const features = await getGeoFeatures(conn);

		return {
			type: 'FeatureCollection',
			features: features.map((f) => ({
				type: 'Feature' as const,
				geometry: JSON.parse(f.geometry),
				properties: {
					LEVEL3_NAM: f.area,
					LEVEL3_COD: f.code,
					code: f.code,
					area: f.area,
					unique_count: f.unique_count,
					family_count: f.family_count,
					flora_richness: f.flora_richness,
					pct_of_flora: f.pct_of_flora
				}
			}))
		};
	} finally {
		conn?.close();
	}
}

async function getCachedGeoJSON(): Promise<FeatureCollection> {
	if (cachedGeoJSON) {
		return cachedGeoJSON;
	}

	if (geoJSONPromise) {
		return geoJSONPromise;
	}

	geoJSONPromise = loadGeoJSON()
		.then((geoJSON) => {
			cachedGeoJSON = geoJSON;
			return geoJSON;
		})
		.finally(() => {
			geoJSONPromise = null;
		});

	return geoJSONPromise;
}

export const GET = async () => {
	return json(await getCachedGeoJSON(), {
		headers: {
			'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
