import { describe, expect, it } from 'vitest';
import { getSourceLinkLabel, getSourceName } from './source-link';

describe('taxonomic source links', () => {
	it('names each registry present in the workbook', () => {
		expect.assertions(4);

		expect(getSourceName('https://www.ipni.org/n/600841-1')).toBe('IPNI');
		expect(getSourceName('https://www.algaebase.org/search/species/detail/?species_id=3309')).toBe(
			'AlgaeBase'
		);
		expect(getSourceName('https://www.tropicos.org/name/22101619')).toBe('Tropicos');
		expect(getSourceName('https://www.gbif.org/species/5420084')).toBe('GBIF');
	});

	it('returns null for a host it does not recognise, rather than guessing', () => {
		expect.assertions(3);

		expect(getSourceName('https://example.org/taxon/1')).toBeNull();
		expect(getSourceName('')).toBeNull();
		expect(getSourceName(undefined)).toBeNull();
	});

	it('falls back to generic link text when the registry is unknown', () => {
		expect.assertions(2);

		expect(getSourceLinkLabel('https://www.ipni.org/n/600841-1')).toBe('View on IPNI');
		expect(getSourceLinkLabel('https://example.org/taxon/1')).toBe('Open source link');
	});
});
