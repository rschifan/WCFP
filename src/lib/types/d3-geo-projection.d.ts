/**
 * `d3-geo-projection` ships no types and DefinitelyTyped has no `@types/d3-geo-projection`.
 *
 * Rather than widen the whole module to `any`, this declares only the projection the portal
 * actually uses, with d3-geo's own `GeoProjection` as the return type so `fitExtent`, `scale`
 * and `translate` stay checked at the call sites.
 */
declare module 'd3-geo-projection' {
	import type { GeoProjection } from 'd3-geo';

	/** Winkel Tripel: the compromise projection used for the portal's world maps. */
	export function geoWinkel3(): GeoProjection;
}
