/**
 * Format utilities for consistent number display
 */

/**
 * Format a count for display — exact number with thousands separators.
 */
export function formatCount(count: number): string {
	return count.toLocaleString();
}

/**
 * Format a number with a maximum digit count. If exceeded, compact it (k/M/B).
 */
export function formatCountMaxDigits(count: number, maxDigits = 4): string {
	const absValue = Math.abs(count);
	if (absValue < 10 ** maxDigits) {
		return count.toLocaleString();
	}

	const units = [
		{ value: 1_000_000_000, suffix: 'B' },
		{ value: 1_000_000, suffix: 'M' },
		{ value: 1_000, suffix: 'k' }
	];

	for (const unit of units) {
		if (absValue >= unit.value) {
			const compact = (count / unit.value).toFixed(1);
			return `${Number(compact)}${unit.suffix}`;
		}
	}

	return count.toLocaleString();
}
