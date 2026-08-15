import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TaxonomyList from './TaxonomyList.svelte';
import type { Species } from '$lib/types/species';
import type { TaxonomyTreeIndex } from '$lib/types/taxonomy';

const SAMPLE_SPECIES: Species[] = [
	{
		wcfpId: 201,
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
	},
	{
		wcfpId: 202,
		name: 'Tetradesmus obliquus',
		authors: '(Turpin) M.J.Wynne',
		family: 'Hydrodictyaceae',
		genus: 'Tetradesmus',
		lifeform: 'annual',
		uses: {
			total: 1,
			humanFood: true
		},
		referencesAll: ['Reference B']
	}
];

const DATA: TaxonomyTreeIndex = {
	rootId: 'family',
	nodesById: new Map([
		[
			'family',
			{
				id: 'family',
				name: 'Hydrodictyaceae',
				nameLower: 'hydrodictyaceae',
				rank: 'family',
				count: 2,
				childCount: 2,
				childrenIds: ['species', 'species-no-map'],
				childrenLoaded: true,
				parentId: null,
				path: 'root/Plantae/Chlorophyta/Chlorophyceae/Sphaeropleales/Hydrodictyaceae',
				depth: 0,
				hasDistribution: true
			}
		],
		[
			'species',
			{
				id: 'species',
				name: 'Hydrodictyon reticulatum',
				nameLower: 'hydrodictyon reticulatum',
				rank: 'species',
				count: 1,
				childCount: 0,
				childrenIds: [],
				childrenLoaded: true,
				parentId: 'family',
				path: 'root/Plantae/Chlorophyta/Chlorophyceae/Sphaeropleales/Hydrodictyaceae/Hydrodictyon reticulatum',
				depth: 1,
				wcfpId: 201,
				authors: '(L.) Bory',
				hasDistribution: true,
				distributionAreaCount: 3
			}
		],
		[
			'species-no-map',
			{
				id: 'species-no-map',
				name: 'Tetradesmus obliquus',
				nameLower: 'tetradesmus obliquus',
				rank: 'species',
				count: 1,
				childCount: 0,
				childrenIds: [],
				childrenLoaded: true,
				parentId: 'family',
				path: 'root/Plantae/Chlorophyta/Chlorophyceae/Sphaeropleales/Hydrodictyaceae/Tetradesmus obliquus',
				depth: 1,
				wcfpId: 202,
				authors: '(Turpin) M.J.Wynne',
				hasDistribution: false
			}
		]
	])
};

describe('TaxonomyList species detail integration', () => {
	const originalFetch = globalThis.fetch;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);

		globalThis.fetch = vi.fn(async (input) => {
			const url = String(input);
			const species = url.endsWith('/202') ? SAMPLE_SPECIES[1] : SAMPLE_SPECIES[0];

			return new Response(JSON.stringify({ data: species }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}) as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		document.body.style.overflow = '';
		document.body.style.paddingRight = '';
		target = null;
	});

	it('opens the shared species detail panel from species row click and removes the old detail button', async () => {
		expect.assertions(7);
		const onNodeSelect = vi.fn();

		render(TaxonomyList, {
			target: target ?? document.body,
			props: {
				data: DATA,
				expandedIds: new Set(['family']),
				isNodeClickable: (node) => node.hasDistribution === true,
				onNodeSelect
			}
		});

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
		await expect.element(page.getByText('Hydrodictyaceae')).toBeInTheDocument();
		await expect.element(speciesRow).toHaveFocus();
		expect(onNodeSelect).not.toHaveBeenCalled();
	});

	it('shows the taxonomy map action only when distribution exists and keeps it separate from details', async () => {
		expect.assertions(5);
		const onNodeSelect = vi.fn();

		render(TaxonomyList, {
			target: target ?? document.body,
			props: {
				data: DATA,
				expandedIds: new Set(['family']),
				isNodeClickable: (node) => node.hasDistribution === true,
				onNodeSelect
			}
		});

		const mapButton = page.getByRole('button', {
			name: 'Open map for Hydrodictyon reticulatum across 3 areas'
		});

		await expect.element(mapButton).toBeInTheDocument();
		await expect.element(page.getByText('3 areas')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: /Open map for Tetradesmus obliquus/ }))
			.not.toBeInTheDocument();

		await mapButton.click();

		expect(onNodeSelect).toHaveBeenCalledTimes(1);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});
});
