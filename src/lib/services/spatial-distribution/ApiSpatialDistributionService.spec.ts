import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiSpatialDistributionService } from './ApiSpatialDistributionService';
import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';

function createNode(overrides: Partial<TaxonomyNodeNormalized>): TaxonomyNodeNormalized {
	return {
		id: 'node-1',
		name: 'Example',
		nameLower: 'example',
		rank: 'species',
		count: 1,
		childCount: 0,
		childrenIds: [],
		childrenLoaded: true,
		parentId: null,
		depth: 0,
		...overrides
	};
}

describe('ApiSpatialDistributionService', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('treats species distributions as presence-only and keys them by region code', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ data: [{ code: 'ITA' }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const service = new ApiSpatialDistributionService('/api/v1');
		const distribution = await service.getDistributionForNode(
			createNode({ rank: 'species', wcfpId: 6456, path: 'species:rosa-canina:6456' })
		);
		const firstCall = fetchMock.mock.calls[0] as unknown as [
			RequestInfo | URL,
			RequestInit | undefined
		];

		expect([...distribution.entries()]).toEqual([['ITA', 1]]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(firstCall[0]).toBe('/api/v1/distribution?rank=species&wcfp_id=6456');
		expect(firstCall[1]).toEqual(
			expect.objectContaining({
				cache: 'no-store'
			})
		);
	});

	it('uses returned counts for aggregate distributions and still keys by region code', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ data: [{ code: 'ITA', count: 12 }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const service = new ApiSpatialDistributionService('/api/v1');
		const distribution = await service.getDistributionForNode(
			createNode({ rank: 'family', name: 'Rosaceae', path: 'family:rosaceae' })
		);
		const firstCall = fetchMock.mock.calls[0] as unknown as [
			RequestInfo | URL,
			RequestInit | undefined
		];

		expect([...distribution.entries()]).toEqual([['ITA', 12]]);
		expect(firstCall[0]).toBe('/api/v1/distribution?rank=family&name=Rosaceae');
	});

	it('does not cache repeated distribution requests', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ data: [{ code: 'ITA' }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const service = new ApiSpatialDistributionService('/api/v1');
		const node = createNode({ rank: 'species', wcfpId: 6456, path: 'species:rosa-canina:6456' });

		await service.getDistributionForNode(node);
		await service.getDistributionForNode(node);

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
