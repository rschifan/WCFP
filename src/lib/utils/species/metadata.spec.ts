import { describe, expect, it } from 'vitest';
import { buildSpeciesUsesFromFlags, getSpeciesUseCategories } from './metadata';

describe('species metadata helpers', () => {
	it('reconstructs specific use flags in canonical order', () => {
		expect.assertions(1);

		expect(
			buildSpeciesUsesFromFlags({
				total: 2,
				humanFood: true,
				medicines: true
			})
		).toEqual({
			total: 2,
			humanFood: true,
			medicines: true
		});
	});

	it('returns ordered use categories for DB-derived species data', () => {
		expect.assertions(1);

		const categories = getSpeciesUseCategories({
			uses: {
				total: 2,
				humanFood: true,
				medicines: true
			}
		});

		expect(categories.map((category) => category.key)).toEqual(['humanFood', 'medicines']);
	});
});
