/**
 * Choropleth colour scale, shared by every map.
 *
 * A three-stop linear RGB ramp over `low → mid → high`, where `mid` is the arithmetic midpoint
 * of the extent rather than a median — so the scale is sensitive to a single outlier region.
 * That is the behaviour the portal has always had; it is preserved here deliberately.
 *
 * This lived as two verbatim copies in ChoroplethMap and TaxonomyDistributionMap. A third was
 * about to appear for the flora-share layer, so it moved here instead.
 */

export interface ValueRange {
	min: number;
	max: number;
	mid: number;
}

export interface RampColors {
	low: string;
	mid: string;
	high: string;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function hexToRgb(hex: string): [number, number, number] {
	const normalized = hex.replace('#', '');
	const full =
		normalized.length === 3
			? normalized
					.split('')
					.map((c) => `${c}${c}`)
					.join('')
			: normalized;
	const value = Number.parseInt(full, 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function interpolateColor(from: string, to: string, ratio: number): string {
	const t = clamp(ratio, 0, 1);
	const [r1, g1, b1] = hexToRgb(from);
	const [r2, g2, b2] = hexToRgb(to);
	return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

/**
 * Extent of the values that count as data, plus its midpoint.
 *
 * `zeroIsData` decides whether a zero is a real measurement or an absence. For taxon counts a
 * zero means "nothing recorded here", which should render as no-data grey. For a ratio such as
 * share of flora a zero is a genuine reading and belongs on the ramp.
 */
export function computeRange(values: readonly number[], zeroIsData = false): ValueRange {
	const usable = values.filter((v) => Number.isFinite(v) && (zeroIsData ? v >= 0 : v > 0));
	if (usable.length === 0) return { min: 0, max: 0, mid: 0 };
	const min = Math.min(...usable);
	const max = Math.max(...usable);
	return { min, max, mid: (min + max) / 2 };
}

/**
 * Fill for one value. Returns `noDataColor` when the value is absent, or when it is zero and
 * zero does not count as data for this metric.
 */
export function computeFillColor(
	value: number | null | undefined,
	range: ValueRange,
	colors: RampColors,
	noDataColor: string,
	zeroIsData = false
): string {
	const missing = value === null || value === undefined || !Number.isFinite(value);
	if (missing || (zeroIsData ? (value as number) < 0 : (value as number) <= 0)) return noDataColor;
	if (range.max <= 0 && !zeroIsData) return noDataColor;
	if (range.min === range.max) return colors.mid;

	const v = value as number;
	if (v <= range.mid) {
		return interpolateColor(
			colors.low,
			colors.mid,
			(v - range.min) / Math.max(range.mid - range.min, Number.EPSILON)
		);
	}
	return interpolateColor(
		colors.mid,
		colors.high,
		(v - range.mid) / Math.max(range.max - range.mid, Number.EPSILON)
	);
}
