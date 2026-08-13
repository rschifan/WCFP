import { describe, expect, it } from 'vitest';
import { mapTaxonomyNodeRow } from './queries';

describe('mapTaxonomyNodeRow', () => {
	it('decodes species trait data from taxonomy node rows', () => {
		const node = mapTaxonomyNodeRow({
			node_id: 'root/Plantae/Testaceae/Testus example',
			parent_id: 'root/Plantae/Testaceae',
			path: 'root/Plantae/Testaceae/Testus example',
			rank: 'species',
			depth: 3,
			name: 'Testus example',
			name_lower: 'testus example',
			count: 1,
			child_count: 0,
			wcfp_id: 42,
			authors: '(L.) Example',
			has_distribution: true,
			distribution_area_count: 3,
			has_cwr: true,
			lifeforms_json: '["annual"]',
			use_mask: 1
		});

		expect(node.traits?.lifeforms).toEqual(['annual']);
		expect(node.traits?.uses).toEqual(['humanFood']);
		expect(node.traits?.hasCwr).toBe(true);
		expect(node.childrenLoaded).toBe(true);
		expect(node.distributionAreaCount).toBe(3);
	});

	it('does not expose trait payloads for non-species rows with empty trait columns', () => {
		const node = mapTaxonomyNodeRow({
			node_id: 'root/Plantae/Testaceae',
			parent_id: 'root/Plantae',
			path: 'root/Plantae/Testaceae',
			rank: 'family',
			depth: 2,
			name: 'Testaceae',
			name_lower: 'testaceae',
			count: 12,
			child_count: 2,
			wcfp_id: null,
			authors: '',
			has_distribution: true,
			distribution_area_count: 0,
			has_cwr: false,
			lifeforms_json: '[]',
			use_mask: 0
		});

		expect(node.traits).toBeUndefined();
	});
});
