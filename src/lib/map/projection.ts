/**
 * The portal's map projection, in one place so every map agrees.
 *
 * Winkel Tripel is the compromise projection the National Geographic Society adopted for world
 * maps, and the usual choice for showing distributions: it holds area, direction and distance
 * distortion to a low combined minimum rather than optimising one at the others' expense. That
 * matters here because a reader is comparing how much of the world a taxon covers.
 */

import { geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { geoWinkel3 } from 'd3-geo-projection';

export interface ProjectionBox {
	width: number;
	height: number;
	padding: number;
}

/**
 * How far a map is allowed to zoom into the areas it is highlighting.
 *
 * Fitting tightly to the highlighted areas is right for a taxon spread over continents and wrong
 * for one recorded in a single region: that fills the frame with one polygon and strands the
 * reader with no idea where on Earth they are looking. Capping the scale relative to a whole-world
 * fit keeps surrounding land in frame in every case.
 */
export const MAX_ZOOM_OVER_WORLD = 2.5;

/** A Winkel Tripel projection fitted to the whole world inside `box`. */
export function fitWorld(box: ProjectionBox) {
	return geoWinkel3().fitExtent(
		[
			[box.padding, box.padding],
			[box.width - box.padding, box.height - box.padding]
		],
		{ type: 'Sphere' }
	);
}
/**
 * A Winkel Tripel projection fitted to `focus`, but never zoomed more than
 * `MAX_ZOOM_OVER_WORLD` beyond a whole-world view. When the cap bites, the projection stays
 * centred on the focus so the highlighted areas remain the subject.
 *
 * Passing no focus — or an empty one — yields the whole world.
 */
export function fitFocus(box: ProjectionBox, focus: GeoPermissibleObjects | null) {
	const projection = fitWorld(box);
	if (!focus) return projection;

	const worldScale = projection.scale();
	const extent: [[number, number], [number, number]] = [
		[box.padding, box.padding],
		[box.width - box.padding, box.height - box.padding]
	];

	projection.fitExtent(extent, focus);

	const maxScale = worldScale * MAX_ZOOM_OVER_WORLD;
	if (projection.scale() <= maxScale) return projection;

	// Too tight. Pull back to the cap, then slide the focus back to the middle of the frame —
	// scaling alone moves it off centre.
	projection.scale(maxScale);

	const [focusX, focusY] = geoPath(projection).centroid(focus);
	const [translateX, translateY] = projection.translate();
	projection.translate([
		translateX + (box.width / 2 - focusX),
		translateY + (box.height / 2 - focusY)
	]);

	return projection;
}
