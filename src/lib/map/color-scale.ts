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

import type { OccurrenceStatusFilter } from '$lib/types/taxonomy';
import type { OccurrencePalette } from '$lib/constants/palette';

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

/** Legend order for occurrence status: how a taxon got there, commonest first. */
export const OCCURRENCE_ORDER: readonly OccurrenceStatusFilter[] = [
	'native',
	'introduced',
	'extinct',
	'doubtful'
];

export const OCCURRENCE_LABELS: Record<OccurrenceStatusFilter, string> = {
	native: 'Native',
	introduced: 'Introduced',
	extinct: 'Extinct',
	doubtful: 'Doubtful'
};

/**
 * Fill for one area on a single-species map.
 *
 * Unlike `computeFillColor` there is no ramp to interpolate: the four statuses are unordered
 * categories, so an unrecognised or absent status falls through to no-data rather than to an
 * endpoint colour.
 */
export function occurrenceFillColor(
	status: OccurrenceStatusFilter | null | undefined,
	colors: OccurrencePalette,
	noDataColor: string
): string {
	if (!status) return noDataColor;
	return colors[status] ?? noDataColor;
}

/**
 * Quantile (equal-count) classification — the standard choropleth scheme when a distribution is
 * skewed enough that a linear ramp wastes most of its range.
 *
 * The flora share is exactly that case: its extremes are micro-islands whose whole flora is a
 * few dozen useful species (Marcus I. reaches 81%), so a linear ramp puts four fifths of the
 * world in its pale half and paints the dark end onto polygons a pixel wide. Equal-count classes
 * spend the colours where the areas actually are.
 *
 * Returns the `classCount - 1` interior break values, ascending.
 */
export function computeQuantileBreaks(
	values: readonly number[],
	classCount: number,
	zeroIsData = false
): number[] {
	const usable = values
		.filter((v) => Number.isFinite(v) && (zeroIsData ? v >= 0 : v > 0))
		.sort((a, b) => a - b);
	if (usable.length === 0 || classCount < 2) return [];

	const breaks: number[] = [];
	for (let i = 1; i < classCount; i += 1) {
		// Linear interpolation between order statistics — the same definition R calls type 7.
		const position = (usable.length - 1) * (i / classCount);
		const lower = Math.floor(position);
		const upper = Math.min(lower + 1, usable.length - 1);
		breaks.push(usable[lower] + (usable[upper] - usable[lower]) * (position - lower));
	}
	return breaks;
}

/**
 * ColorBrewer's sequential Reds, the classes it publishes for 3–7.
 *
 * Sampling the portal's own ramp at even intervals looks even in RGB and is not: the top two
 * classes came out as near-identical reds. These steps are chosen for even perceived spacing —
 * with the classed layer drawn at full opacity, every step separates by at least 18 in CIE Lab —
 * and the lightest class is a pale pink rather than white, which reads as no-data.
 */
const BREWER_REDS: Record<number, string[]> = {
	3: ['#fee0d2', '#fc9272', '#de2d26'],
	4: ['#fee5d9', '#fcae91', '#fb6a4a', '#cb181d'],
	5: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
	6: ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'],
	7: ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d']
};

/** One colour per class. Falls back to sampling the given ramp outside the published sets. */
export function classColors(colors: RampColors, classCount: number): string[] {
	if (classCount <= 1) return [colors.mid];

	const published = BREWER_REDS[classCount];
	if (published) return published;

	return Array.from({ length: classCount }, (_, i) => {
		const t = i / (classCount - 1);
		return t <= 0.5
			? interpolateColor(colors.low, colors.mid, t * 2)
			: interpolateColor(colors.mid, colors.high, (t - 0.5) * 2);
	});
}

/** Fill for one value under a quantile classification. */
export function classFillColor(
	value: number | null | undefined,
	breaks: readonly number[],
	palette: readonly string[],
	noDataColor: string,
	zeroIsData = false
): string {
	const missing = value === null || value === undefined || !Number.isFinite(value);
	if (missing || (zeroIsData ? (value as number) < 0 : (value as number) <= 0)) return noDataColor;
	if (palette.length === 0) return noDataColor;

	const v = value as number;
	let index = 0;
	while (index < breaks.length && v > breaks[index]) index += 1;
	return palette[Math.min(index, palette.length - 1)];
}
