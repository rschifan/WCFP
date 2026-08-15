import { describe, expect, it } from 'vitest';
import {
	clearRegionTaxonomyCache,
	getRegionTaxonomyBootstrap,
	getRegionTaxonomyChildren,
	queryRegionTaxonomy
} from './region-taxonomy';

describe('region taxonomy runtime', () => {
	it('returns a lightweight bootstrap and lazy children for a real region', async () => {
		expect.assertions(4);
		clearRegionTaxonomyCache();

		const bootstrap = await getRegionTaxonomyBootstrap('COL');
		const familyNode = bootstrap.nodes.find((node) => node.rank === 'family');

		expect(bootstrap.rootId).toBe('region-root');
		expect(bootstrap.nodes.some((node) => node.rank === 'species')).toBe(false);
		expect(familyNode).toBeDefined();

		const children = await getRegionTaxonomyChildren('COL', familyNode!.id);
		expect(children.nodes.some((node) => node.rank === 'genus')).toBe(true);
	});

	it('projects search results as a tree with ancestors', async () => {
		expect.assertions(2);
		clearRegionTaxonomyCache();

		const bootstrap = await getRegionTaxonomyBootstrap('COL');
		const familyNode = bootstrap.nodes.find((node) => node.rank === 'family');
		expect(familyNode).toBeDefined();

		const result = await queryRegionTaxonomy('COL', { q: familyNode!.name });
		expect(result.nodes.some((node) => node.name === familyNode!.name)).toBe(true);
	});
});
