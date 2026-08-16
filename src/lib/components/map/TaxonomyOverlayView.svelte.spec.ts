import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	clearRegionGeometryStore,
	primeRegionGeometryStore,
	type RegionFeatureCollection
} from '$lib/stores/region-geometry';
import TaxonomyOverlayViewHarness from './TaxonomyOverlayViewHarness.svelte';

const BOOTSTRAP_PAYLOAD = {
	rootId: 'root',
	startFromId: 'root/Plantae',
	expandedIds: ['root/Plantae'],
	availableLifeforms: ['annual'],
	nodes: [
		{
			id: 'root',
			name: 'root',
			nameLower: 'root',
			rank: 'root',
			count: 2,
			childCount: 1,
			childrenIds: [],
			childrenLoaded: true,
			parentId: null,
			path: 'root',
			depth: 0
		},
		{
			id: 'root/Plantae',
			name: 'Plantae',
			nameLower: 'plantae',
			rank: 'kingdom',
			count: 2,
			childCount: 2,
			childrenIds: [],
			childrenLoaded: true,
			parentId: 'root',
			path: 'root/Plantae',
			depth: 1
		},
		{
			id: 'root/Plantae/Asteraceae',
			name: 'Asteraceae',
			nameLower: 'asteraceae',
			rank: 'family',
			count: 1,
			childCount: 0,
			childrenIds: [],
			childrenLoaded: true,
			parentId: 'root/Plantae',
			path: 'root/Plantae/Asteraceae',
			depth: 2
		},
		{
			id: 'root/Plantae/Cycadaceae',
			name: 'Cycadaceae',
			nameLower: 'cycadaceae',
			rank: 'family',
			count: 1,
			childCount: 1,
			childrenIds: [],
			childrenLoaded: false,
			parentId: 'root/Plantae',
			path: 'root/Plantae/Cycadaceae',
			depth: 2
		}
	]
};

const QUERY_PAYLOAD = {
	rootId: 'root',
	startFromId: 'root/Plantae',
	expandedIds: ['root/Plantae', 'root/Plantae/Cycadaceae'],
	nodes: [
		...BOOTSTRAP_PAYLOAD.nodes,
		{
			id: 'root/Plantae/Cycadaceae/Cycas',
			name: 'Cycas',
			nameLower: 'cycas',
			rank: 'genus',
			count: 1,
			childCount: 0,
			childrenIds: [],
			childrenLoaded: true,
			parentId: 'root/Plantae/Cycadaceae',
			path: 'root/Plantae/Cycadaceae/Cycas',
			depth: 3
		}
	]
};

const CLICKABLE_BOOTSTRAP_PAYLOAD = {
	rootId: 'root',
	startFromId: 'root/Plantae',
	expandedIds: ['root/Plantae', 'root/Plantae/Asteraceae'],
	availableLifeforms: ['annual'],
	nodes: [
		{
			id: 'root',
			name: 'root',
			nameLower: 'root',
			rank: 'root',
			count: 1,
			childCount: 1,
			childrenIds: [],
			childrenLoaded: true,
			parentId: null,
			path: 'root',
			depth: 0
		},
		{
			id: 'root/Plantae',
			name: 'Plantae',
			nameLower: 'plantae',
			rank: 'kingdom',
			count: 1,
			childCount: 1,
			childrenIds: [],
			childrenLoaded: true,
			parentId: 'root',
			path: 'root/Plantae',
			depth: 1
		},
		{
			id: 'root/Plantae/Asteraceae',
			name: 'Asteraceae',
			nameLower: 'asteraceae',
			rank: 'family',
			count: 1,
			childCount: 1,
			childrenIds: [],
			childrenLoaded: true,
			parentId: 'root/Plantae',
			path: 'root/Plantae/Asteraceae',
			depth: 2
		},
		{
			id: 'root/Plantae/Asteraceae/Asterus testus',
			name: 'Asterus testus',
			nameLower: 'asterus testus',
			rank: 'species',
			count: 1,
			childCount: 0,
			childrenIds: [],
			childrenLoaded: true,
			parentId: 'root/Plantae/Asteraceae',
			path: 'root/Plantae/Asteraceae/Asterus testus',
			depth: 3,
			wcfpId: 42,
			hasDistribution: true,
			distributionAreaCount: 1
		}
	]
};

const GEOJSON_PAYLOAD: RegionFeatureCollection = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[11, 41],
						[13, 41],
						[13, 43],
						[11, 43],
						[11, 41]
					]
				]
			},
			properties: {
				LEVEL3_COD: 'ITA',
				LEVEL3_NAM: 'Italy',
				code: 'ITA',
				area: 'Italy',
				unique_count: 100,
				family_count: 5
			}
		}
	]
};

function createTarget(): HTMLDivElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	return target;
}

describe('TaxonomyOverlayView taxonomy search', () => {
	const originalFetch = globalThis.fetch;
	let fetchMock: ReturnType<typeof vi.fn>;
	let taxonomyQueryRequestCount = 0;

	beforeEach(() => {
		taxonomyQueryRequestCount = 0;
		fetchMock = vi.fn(async (input) => {
			const url = String(input);

			if (url.includes('/api/v1/taxonomy/bootstrap')) {
				return new Response(JSON.stringify({ data: BOOTSTRAP_PAYLOAD }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url.includes('/api/v1/taxonomy/query')) {
				taxonomyQueryRequestCount += 1;
				return new Response(JSON.stringify({ data: QUERY_PAYLOAD }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			throw new Error(`Unexpected fetch: ${url}`);
		});
		globalThis.fetch = fetchMock as typeof fetch;
	});

	afterEach(() => {
		clearRegionGeometryStore();
		globalThis.fetch = originalFetch;
	});

	it('only requests the final taxonomy query when typing quickly', async () => {
		expect.assertions(4);

		render(TaxonomyOverlayViewHarness, {
			target: createTarget()
		});

		await expect.element(page.getByText('Browse Taxonomy')).toBeInTheDocument();
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/v1/regions'))).toBe(
			false
		);

		const searchInput = page.getByPlaceholder('Search');
		await searchInput.fill('c');
		await searchInput.fill('cy');
		await searchInput.fill('cyc');
		await searchInput.fill('cyca');
		await searchInput.fill('cycas');

		await expect.element(page.getByRole('button', { name: /^Cycas/ })).toBeInTheDocument();
		expect(taxonomyQueryRequestCount).toBe(1);
	});

	it('renders DB-backed query results when typing in the taxonomy search box', async () => {
		expect.assertions(3);

		render(TaxonomyOverlayViewHarness, {
			target: createTarget()
		});

		await expect.element(page.getByText('Browse Taxonomy')).toBeInTheDocument();

		const searchInput = page.getByPlaceholder('Search');
		await searchInput.fill('cycas');

		await expect.element(page.getByRole('button', { name: /^Cycadaceae/ })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /^Cycas/ })).toBeInTheDocument();
	});

	it('restores the browse tree when the taxonomy search is cleared', async () => {
		expect.assertions(2);

		render(TaxonomyOverlayViewHarness, {
			target: createTarget()
		});

		const searchInput = page.getByPlaceholder('Search');
		await searchInput.fill('cycas');
		await expect.element(page.getByRole('button', { name: /^Cycas/ })).toBeInTheDocument();

		await searchInput.fill('');
		await expect.element(page.getByRole('button', { name: /^Cycas/ })).not.toBeInTheDocument();
	});

	it('shows taxonomy query errors in the shared search UI', async () => {
		expect.assertions(1);

		globalThis.fetch = vi.fn(async (input) => {
			const url = String(input);

			if (url.includes('/api/v1/taxonomy/bootstrap')) {
				return new Response(JSON.stringify({ data: BOOTSTRAP_PAYLOAD }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url.includes('/api/v1/taxonomy/query')) {
				return new Response(JSON.stringify({ message: 'Query failed' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			throw new Error(`Unexpected fetch: ${url}`);
		}) as typeof fetch;

		render(TaxonomyOverlayViewHarness, {
			target: createTarget()
		});

		await page.getByPlaceholder('Search').fill('cycas');
		await expect.element(page.getByText('Query failed')).toBeInTheDocument();
	});

	it('loads overlay text data only after clicking a clickable node', async () => {
		expect.assertions(3);
		let distributionRequestCount = 0;

		primeRegionGeometryStore(GEOJSON_PAYLOAD);

		globalThis.fetch = vi.fn(async (input) => {
			const url = String(input);

			if (url.includes('/api/v1/taxonomy/bootstrap')) {
				return new Response(JSON.stringify({ data: CLICKABLE_BOOTSTRAP_PAYLOAD }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url.includes('/api/v1/species/42')) {
				return new Response(
					JSON.stringify({
						data: {
							wcfpId: 42,
							name: 'Asterus testus',
							authors: 'Auth.',
							family: 'Asteraceae',
							genus: 'Asterus'
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (url.includes('/api/v1/distribution?rank=species&wcfp_id=42')) {
				distributionRequestCount += 1;
				return new Response(JSON.stringify({ data: [{ code: 'ITA' }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			throw new Error(`Unexpected fetch: ${url}`);
		}) as typeof fetch;

		render(TaxonomyOverlayViewHarness, {
			target: createTarget()
		});

		await expect.element(page.getByText('Browse Taxonomy')).toBeInTheDocument();

		await page.getByRole('button', { name: 'Open the distribution map for Asterus testus, 1 area' }).click();

		await expect.element(page.getByLabelText('Taxonomy distribution map')).toBeInTheDocument();
		expect(distributionRequestCount).toBe(1);
	});

	it('reopens the overlay and reloads the API text output', async () => {
		expect.assertions(3);

		let distributionRequestCount = 0;

		primeRegionGeometryStore(GEOJSON_PAYLOAD);

		globalThis.fetch = vi.fn(async (input) => {
			const url = String(input);

			if (url.includes('/api/v1/taxonomy/bootstrap')) {
				return new Response(JSON.stringify({ data: CLICKABLE_BOOTSTRAP_PAYLOAD }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url.includes('/api/v1/species/42')) {
				return new Response(
					JSON.stringify({
						data: {
							wcfpId: 42,
							name: 'Asterus testus',
							authors: 'Auth.',
							family: 'Asteraceae',
							genus: 'Asterus'
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (url.includes('/api/v1/distribution?rank=species&wcfp_id=42')) {
				distributionRequestCount += 1;
				return new Response(JSON.stringify({ data: [{ code: 'ITA' }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			throw new Error(`Unexpected fetch: ${url}`);
		}) as typeof fetch;

		render(TaxonomyOverlayViewHarness, {
			target: createTarget()
		});

		const openButton = page.getByRole('button', { name: 'Open the distribution map for Asterus testus, 1 area' });
		await openButton.click();
		await expect.element(page.getByLabelText('Taxonomy distribution map')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Close' }).click();
		await openButton.click();
		await expect.element(page.getByLabelText('Taxonomy distribution map')).toBeInTheDocument();
		expect(distributionRequestCount).toBe(2);
	});
});
