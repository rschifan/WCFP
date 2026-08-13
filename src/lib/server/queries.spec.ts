import { describe, expect, it } from 'vitest';
import { mapSpeciesRow, type SpeciesRow } from './queries';

describe('mapSpeciesRow', () => {
	it('preserves explicit use flags from DuckDB rows', () => {
		expect.assertions(1);

		const row: SpeciesRow = {
			wcfp_id: 1,
			taxon_name: 'Hydrodictyon reticulatum',
			authors: '(L.) Bory',
			family: 'Hydrodictyaceae',
			genus: 'Hydrodictyon',
			lifeform: 'annual',
			cwr: false,
			use_human_food: true,
			use_animal_food: false,
			use_environmental: false,
			use_fuels: false,
			use_gene_sources: false,
			use_invertebrate_food: false,
			use_materials: false,
			use_medicines: true,
			use_poisons: false,
			use_social_uses: false,
			source_link: '',
			references_all: '',
			uses_total: 2
		};

		expect(mapSpeciesRow(row).uses).toEqual({
			total: 2,
			humanFood: true,
			medicines: true
		});
	});
});
