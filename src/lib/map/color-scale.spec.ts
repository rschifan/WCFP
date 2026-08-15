import { describe, expect, it } from 'vitest';
import { classFillColor, classColors, computeQuantileBreaks } from './color-scale';

const RAMP = { low: '#ffffff', mid: '#ff8080', high: '#ff0000' };

describe('quantile classification', () => {
	it('splits the values into equal-count classes', () => {
		const values = Array.from({ length: 100 }, (_, i) => i + 1);
		const breaks = computeQuantileBreaks(values, 5);

		expect(breaks).toHaveLength(4);
		const palette = classColors(RAMP, 5);
		const counts = new Map<string, number>();
		for (const v of values) {
			const fill = classFillColor(v, breaks, palette, '#eee');
			counts.set(fill, (counts.get(fill) ?? 0) + 1);
		}

		// Every class is used, and none holds more than a fifth plus rounding.
		expect(counts.size).toBe(5);
		for (const n of counts.values()) expect(n).toBeGreaterThanOrEqual(19);
	});

	it('puts the extremes at the ends of the ramp and keeps missing values out', () => {
		const breaks = computeQuantileBreaks([1, 2, 3, 4, 100], 3);
		const palette = classColors(RAMP, 3);

		expect(classFillColor(1, breaks, palette, '#eee')).toBe(palette[0]);
		expect(classFillColor(100, breaks, palette, '#eee')).toBe(palette[2]);
		expect(classFillColor(null, breaks, palette, '#eee')).toBe('#eee');
		expect(classFillColor(0, breaks, palette, '#eee')).toBe('#eee');
		expect(classFillColor(0, breaks, palette, '#eee', true)).toBe(palette[0]);
	});
});
