import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SpeciesPanelHarness from './SpeciesPanelHarness.svelte';

function createBootstrapPayload(familyName: string) {
	return {
		rootId: 'region-root',
		startFromId: 'region-root',
		expandedIds: ['region-root'],
		availableLifeforms: ['annual'],
		nodes: [
			{
				id: 'region-root',
				name: 'Taxonomy',
				nameLower: 'taxonomy',
				rank: 'root',
				count: 1,
				childCount: 1,
				childrenIds: [],
				childrenLoaded: true,
				parentId: null,
				path: 'region-root',
				depth: 0,
				hasDistribution: true
			},
			{
				id: `region-root/family/${familyName.toLowerCase()}`,
				name: familyName,
				nameLower: familyName.toLowerCase(),
				rank: 'family',
				count: 1,
				childCount: 1,
				childrenIds: [],
				childrenLoaded: false,
				parentId: 'region-root',
				path: `region-root/family/${familyName.toLowerCase()}`,
				depth: 1,
				hasDistribution: true
			}
		]
	};
}

describe('SpeciesPanel shared search state', () => {
	const originalFetch = globalThis.fetch;
	const familyId = 'region-root/family/hydrodictyaceae';
	const genusId = `${familyId}/genus/hydrodictyon`;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);

		globalThis.fetch = vi.fn(async (input) => {
			const url = String(input);
			const familyName = url.includes('/Region%20B/') ? 'Cycadaceae' : 'Hydrodictyaceae';

			if (url.includes('/taxonomy/bootstrap')) {
				return new Response(JSON.stringify({ data: createBootstrapPayload(familyName) }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url.includes('/taxonomy/query')) {
				return new Response(
					JSON.stringify({
						data: {
							rootId: 'region-root',
							startFromId: 'region-root',
							expandedIds: ['region-root'],
							nodes: []
						}
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			if (url.includes(`/taxonomy/children?parentId=${encodeURIComponent(genusId)}`)) {
				return new Response(
					JSON.stringify({
						data: {
							parentId: genusId,
							nodes: [
								{
									id: `${genusId}/species/101`,
									name: 'Hydrodictyon reticulatum',
									nameLower: 'hydrodictyon reticulatum',
									rank: 'species',
									count: 1,
									childCount: 0,
									childrenIds: [],
									childrenLoaded: true,
									parentId: genusId,
									path: `${genusId}/species/101`,
									depth: 3,
									wcfpId: 101,
									authors: '(L.) Bory',
									hasDistribution: true,
									traits: {
										lifeforms: ['annual'],
										uses: ['humanFood']
									}
								}
							]
						}
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			if (url.includes(`/taxonomy/children?parentId=${encodeURIComponent(familyId)}`)) {
				return new Response(
					JSON.stringify({
						data: {
							parentId: familyId,
							nodes: [
								{
									id: genusId,
									name: 'Hydrodictyon',
									nameLower: 'hydrodictyon',
									rank: 'genus',
									count: 1,
									childCount: 1,
									childrenIds: [],
									childrenLoaded: false,
									parentId: familyId,
									path: genusId,
									depth: 2,
									hasDistribution: true
								}
							]
						}
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			if (url.endsWith('/api/v1/species/101')) {
				return new Response(
					JSON.stringify({
						data: {
							wcfpId: 101,
							name: 'Hydrodictyon reticulatum',
							authors: '(L.) Bory',
							family: 'Hydrodictyaceae',
							genus: 'Hydrodictyon',
							lifeform: 'annual',
							uses: {
								total: 1,
								humanFood: true
							},
							referencesAll: ['Reference A']
						}
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			return new Response(JSON.stringify({ data: { parentId: 'region-root', nodes: [] } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}) as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		target = null;
	});

	it.each([
		{ isMobile: false, label: 'desktop' },
		{ isMobile: true, label: 'mobile' }
	])('resets the shared search input when the region changes on $label', async ({ isMobile }) => {
		expect.assertions(3);

		const view = render(SpeciesPanelHarness, {
			target: target ?? document.body,
			props: {
				regionCode: 'RGA',
				regionName: 'Region A',
				isMobile
			}
		});

		const searchInput = page.getByPlaceholder('Search families, genera, or species...');
		await expect.element(searchInput).toBeInTheDocument();

		await searchInput.fill('hydro');
		await expect.element(searchInput).toHaveValue('hydro');

		await view.rerender({
			regionCode: 'RGB',
			regionName: 'Region B',
			isMobile
		});

		await expect.element(searchInput).toHaveValue('');
	});

	it('opens the shared species detail panel from row click in the unified panel', async () => {
		expect.assertions(5);

		render(SpeciesPanelHarness, {
			target: target ?? document.body,
			props: {
				regionCode: 'RGA',
				regionName: 'Region A',
				isMobile: false
			}
		});

		await page.getByRole('button', { name: /^Hydrodictyaceae/ }).click();
		await page.getByRole('button', { name: /^Hydrodictyon/ }).click();

		const speciesRow = page.getByRole('button', { name: /^Hydrodictyon reticulatum/ });

		await expect
			.element(page.getByRole('button', { name: 'Show details for Hydrodictyon reticulatum' }))
			.not.toBeInTheDocument();

		await speciesRow.click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Hydrodictyon reticulatum (L.) Bory' }))
			.toBeInTheDocument();

		await page.getByRole('button', { name: 'Close panel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(speciesRow).toHaveFocus();
	});
});
