import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TaxonScheda from './TaxonScheda.svelte';
import type { RegionFeatureCollection } from '$lib/stores/region-geometry';
import type { Species } from '$lib/types/species';
import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
import { buildTaxonDistribution } from '$lib/services/spatial-distribution/load-distribution';

const GUAVA: Species = {
	wcfpId: 14370,
	name: 'Psidium guajava',
	authors: 'L.',
	family: 'Myrtaceae',
	genus: 'Psidium',
	kingdom: 'Plantae',
	phylum: 'Tracheophyta',
	class: 'Magnoliopsida',
	order: 'Myrtales',
	lifeform: 'tree',
	cwr: true,
	uses: { total: 2, humanFood: true, medicines: true },
	sourceLink: 'https://www.ipni.org/n/600841-1'
};

function speciesNode(overrides: Partial<TaxonomyNodeNormalized> = {}): TaxonomyNodeNormalized {
	return {
		id: 'Myrtaceae/Psidium/14370',
		name: 'Psidium guajava',
		nameLower: 'psidium guajava',
		rank: 'species',
		count: 1,
		childCount: 0,
		childrenIds: [],
		childrenLoaded: true,
		parentId: 'Myrtaceae/Psidium',
		path: 'Myrtaceae/Psidium/14370',
		depth: 3,
		wcfpId: 14370,
		authors: 'L.',
		hasDistribution: true,
		distributionAreaCount: 3,
		...overrides
	};
}

const GEOJSON: RegionFeatureCollection = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			properties: { LEVEL3_COD: 'BZS', LEVEL3_NAM: 'Brazil South' },
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[-50, -25],
						[-48, -25],
						[-48, -23],
						[-50, -23],
						[-50, -25]
					]
				]
			}
		}
	]
};

const DISTRIBUTION = buildTaxonDistribution(
	[
		{ code: 'BZS', name: 'Brazil South', occurrenceStatus: 'native' },
		{ code: 'PER', name: 'Peru', occurrenceStatus: 'native' },
		{ code: 'AND', name: 'Andaman Is.', occurrenceStatus: 'introduced' }
	],
	true
);

describe('TaxonScheda', () => {
	it('gives a species both tabs and names its taxonomic registry', async () => {
		expect.assertions(4);

		render(TaxonScheda, {
			taxon: speciesNode(),
			species: GUAVA,
			distribution: { status: 'success', distribution: DISTRIBUTION },
			geoJSON: GEOJSON,
			view: 'overview',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		await expect.element(page.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('tab', { name: 'Geographical distribution' }))
			.toBeInTheDocument();
		// One link, naming the registry and its record id. The card must not cite the same source
		// twice, so this is both the citation and the way out to it.
		await expect.element(page.getByRole('link', { name: 'IPNI 600841-1' })).toBeInTheDocument();
		await expect.element(page.getByText('Plantae')).toBeInTheDocument();
	});

	it('cites the taxonomic source exactly once', async () => {
		expect.assertions(1);

		render(TaxonScheda, {
			taxon: speciesNode(),
			species: GUAVA,
			distribution: { status: 'no-data' },
			view: 'overview',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		await expect.element(page.getByRole('link', { name: /IPNI/ })).toBeInTheDocument();
	});

	it('lists only the uses on record', async () => {
		expect.assertions(3);

		render(TaxonScheda, {
			taxon: speciesNode(),
			species: GUAVA,
			distribution: { status: 'success', distribution: DISTRIBUTION },
			geoJSON: GEOJSON,
			view: 'overview',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		// Two of ten flags are set on the fixture; the other eight get no chip at all.
		await expect.element(page.getByText('Uses — 2 of 10 categories')).toBeInTheDocument();
		await expect.element(page.getByText('Human Food')).toBeInTheDocument();
		await expect.element(page.getByText('Fuel', { exact: true })).not.toBeInTheDocument();
	});

	it('drops the uses section entirely when nothing is recorded', async () => {
		expect.assertions(1);

		render(TaxonScheda, {
			taxon: speciesNode(),
			species: { ...GUAVA, uses: undefined },
			distribution: { status: 'no-data' },
			view: 'overview',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		await expect.element(page.getByText(/^Uses —/)).not.toBeInTheDocument();
	});

	it('groups areas under one root per status, and omits statuses with no areas', async () => {
		expect.assertions(4);

		render(TaxonScheda, {
			taxon: speciesNode(),
			species: GUAVA,
			distribution: { status: 'success', distribution: DISTRIBUTION },
			geoJSON: GEOJSON,
			view: 'distribution',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		// The fixture has 2 native and 1 introduced area, and no extinct or doubtful ones.
		await expect.element(page.getByRole('group').first()).toBeInTheDocument();
		await expect.element(page.getByText('Brazil South')).toBeInTheDocument();
		await expect.element(page.getByText('Extinct')).not.toBeInTheDocument();
		await expect.element(page.getByText('Doubtful')).not.toBeInTheDocument();
	});

	it('cites the registry record and reports an absent bibliography', async () => {
		expect.assertions(2);

		render(TaxonScheda, {
			taxon: speciesNode(),
			species: GUAVA,
			distribution: { status: 'no-data' },
			view: 'overview',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		// Cited as registry plus record id, not as a bare URL.
		await expect.element(page.getByText('IPNI 600841-1')).toBeInTheDocument();
		await expect.element(page.getByText('None recorded')).toBeInTheDocument();
	});

	it('collapses a long bibliography and leaves a short one open', async () => {
		expect.assertions(2);

		const many = Array.from({ length: 30 }, (_, i) => `Reference ${i + 1}`);
		render(TaxonScheda, {
			taxon: speciesNode(),
			species: { ...GUAVA, referencesAll: many },
			distribution: { status: 'no-data' },
			view: 'overview',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		await expect.element(page.getByText('Show all')).toBeInTheDocument();
		// The count is stated in the summary even while the list itself is folded away.
		await expect.element(page.getByRole('group')).toHaveTextContent('References 30');
	});

	it('gives a higher taxon its map with no tab bar, since it has no record to show', async () => {
		expect.assertions(2);

		render(TaxonScheda, {
			taxon: speciesNode({
				id: 'Myrtaceae/Psidium',
				name: 'Psidium',
				rank: 'genus',
				wcfpId: undefined,
				authors: undefined,
				childCount: 31
			}),
			species: null,
			distribution: { status: 'success', distribution: DISTRIBUTION },
			geoJSON: GEOJSON,
			view: 'distribution',
			titleId: 'scheda-title',
			onViewChange: () => {}
		});

		await expect.element(page.getByRole('tablist')).not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Psidium' })).toBeInTheDocument();
	});
});
