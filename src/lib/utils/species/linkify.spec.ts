import { describe, expect, it } from 'vitest';
import { linkifyReference } from './linkify';

describe('linkifying references', () => {
	it('resolves a DOI against doi.org', () => {
		expect.assertions(1);

		expect(linkifyReference('Smith, 2010, A paper. doi:10.5063/F1CV4G34')).toEqual([
			{ text: 'Smith, 2010, A paper. ', href: null },
			{ text: 'doi:10.5063/F1CV4G34', href: 'https://doi.org/10.5063/F1CV4G34' }
		]);
	});

	it('links a full URL and gives a bare host a scheme', () => {
		expect.assertions(2);

		expect(linkifyReference('See http://apps.kew.org/efloras')).toEqual([
			{ text: 'See ', href: null },
			{ text: 'http://apps.kew.org/efloras', href: 'http://apps.kew.org/efloras' }
		]);

		expect(linkifyReference('See www.eFloras.org')).toEqual([
			{ text: 'See ', href: null },
			{ text: 'www.eFloras.org', href: 'https://www.eFloras.org' }
		]);
	});

	it('leaves sentence punctuation outside the link', () => {
		expect.assertions(1);

		// The real column is full of "https://foodplantsinternational.com/," — the comma is prose.
		expect(linkifyReference('Ref, https://foodplantsinternational.com/, page 4')).toEqual([
			{ text: 'Ref, ', href: null },
			{
				text: 'https://foodplantsinternational.com/',
				href: 'https://foodplantsinternational.com/'
			},
			{ text: ', page 4', href: null }
		]);
	});

	it('returns a reference with no links as a single plain segment', () => {
		expect.assertions(1);

		const plain = 'AAK, 1980, Bertanam Pohon Buah-buahan. Jogyakarta. p 44';
		expect(linkifyReference(plain)).toEqual([{ text: plain, href: null }]);
	});

	it('leaves a URL alone when a space has cut it mid-phrase', () => {
		expect.assertions(1);

		// Real entry: "West Indies" is the resource's title, not a path. Matching to the first
		// space yields ".../antilles/West", which parses fine and is a 404.
		const real =
			'Plants of Haiti Smithsonian Institute http://botany.si.edu/antilles/West Indies (As var. ambigua)';
		expect(linkifyReference(real)).toEqual([{ text: real, href: null }]);
	});

	it('still links when the continuation is ordinary prose', () => {
		expect.assertions(2);

		expect(linkifyReference('doi:10.5063/F1CV4G34 and later work')[0]).toEqual({
			text: 'doi:10.5063/F1CV4G34',
			href: 'https://doi.org/10.5063/F1CV4G34'
		});
		expect(linkifyReference('http://apps.kew.org/efloras Kew Gardens')[0]).toEqual({
			text: 'http://apps.kew.org/efloras',
			href: 'http://apps.kew.org/efloras'
		});
	});

	it('refuses anything that is not a sound absolute URL', () => {
		expect.assertions(3);

		// A DOI must carry a registrant prefix, not just the literal "10.".
		expect(linkifyReference('doi:10.x/nope')).toEqual([{ text: 'doi:10.x/nope', href: null }]);
		// A host with no dotted TLD is a fragment, not an address.
		expect(linkifyReference('see http://localhost/x')).toEqual([
			{ text: 'see http://localhost/x', href: null }
		]);
		// Credentials in a bibliography are a parsing accident.
		expect(linkifyReference('http://user:pw@evil.example.com/x')).toEqual([
			{ text: 'http://user:pw@evil.example.com/x', href: null }
		]);
	});

	it('handles several links in one reference', () => {
		expect.assertions(1);

		const segments = linkifyReference('A https://a.org/x and B doi:10.1006/jmbi.1998.2354 end');
		expect(segments.filter((segment) => segment.href)).toEqual([
			{ text: 'https://a.org/x', href: 'https://a.org/x' },
			{ text: 'doi:10.1006/jmbi.1998.2354', href: 'https://doi.org/10.1006/jmbi.1998.2354' }
		]);
	});
});
