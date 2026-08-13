import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRegionTaxonomySource } from './sources';
import { createEmptyTaxonomyFilters } from '$lib/types/taxonomy';

describe('region taxonomy source', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.fetch = vi.fn(async (input) => {
			const url = String(input);

			if (url.includes('/bootstrap')) {
				return new Response(
					JSON.stringify({
						data: {
							rootId: 'region-root',
							startFromId: 'region-root',
							expandedIds: ['region-root'],
							availableLifeforms: ['annual'],
							nodes: []
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (url.includes('/children')) {
				return new Response(
					JSON.stringify({
						data: {
							parentId: 'region-root',
							nodes: []
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			return new Response(
				JSON.stringify({
					data: {
						rootId: 'region-root',
						startFromId: 'region-root',
						expandedIds: ['region-root'],
						nodes: []
					}
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}) as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('uses the region-scoped taxonomy API contract for bootstrap and children', async () => {
		expect.assertions(3);

		const source = createRegionTaxonomySource('Costa Rica');
		await source.loadBootstrap();
		await source.loadChildren('region-root');

		expect(globalThis.fetch).toHaveBeenNthCalledWith(
			1,
			'/api/v1/regions/Costa%20Rica/taxonomy/bootstrap',
			expect.objectContaining({ signal: undefined })
		);
		expect(globalThis.fetch).toHaveBeenNthCalledWith(
			2,
			'/api/v1/regions/Costa%20Rica/taxonomy/children?parentId=region-root',
			expect.objectContaining({ signal: undefined })
		);
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it('serializes query filters through the shared taxonomy source contract', async () => {
		expect.assertions(1);

		const source = createRegionTaxonomySource('Costa Rica');
		const filters = createEmptyTaxonomyFilters();
		filters.lifeforms = new Set(['annual']);
		filters.uses = new Set(['humanFood']);

		await source.query({ q: 'hydro', filters });

		expect(globalThis.fetch).toHaveBeenCalledWith(
			'/api/v1/regions/Costa%20Rica/taxonomy/query?q=hydro&lifeform=annual&use=humanFood',
			expect.objectContaining({ signal: undefined })
		);
	});
});
