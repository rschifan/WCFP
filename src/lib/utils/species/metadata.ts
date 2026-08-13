import { ABOUT_USE_CATEGORIES, SPECIES_USE_ORDER } from '$lib/constants/portal-help';
import type { Species, SpeciesUseKey, SpeciesUses } from '$lib/types/species';

const USE_CATEGORIES_BY_KEY = new Map(
	ABOUT_USE_CATEGORIES.filter(
		(category): category is (typeof ABOUT_USE_CATEGORIES)[number] & { key: SpeciesUseKey } =>
			Boolean(category.key)
	).map((category) => [category.key, category])
);

export function parseReferencesAll(rawValue: string | null | undefined): string[] {
	const raw = String(rawValue ?? '').trim();
	if (!raw) return [];
	if (!raw.includes(';')) return [raw];

	return raw
		.split(';')
		.map((reference) => reference.trim())
		.filter(Boolean);
}

export function buildSpeciesUsesFromFlags(flags: {
	total?: number | null;
	humanFood?: boolean;
	animalFood?: boolean;
	environmentalUses?: boolean;
	fuels?: boolean;
	geneSources?: boolean;
	invertebrateFood?: boolean;
	materials?: boolean;
	medicines?: boolean;
	poisons?: boolean;
	socialUses?: boolean;
}): SpeciesUses | undefined {
	const selectedUseKeys = SPECIES_USE_ORDER.filter((useKey) => Boolean(flags[useKey]));
	const totalFromFlags =
		typeof flags.total === 'number' && Number.isFinite(flags.total)
			? flags.total
			: selectedUseKeys.length;

	if (selectedUseKeys.length === 0 && totalFromFlags === 0) {
		return undefined;
	}

	const uses: SpeciesUses = {
		total: totalFromFlags
	};

	for (const useKey of selectedUseKeys) {
		uses[useKey] = true;
	}

	return uses;
}

export function getSpeciesUseCategories(species: Pick<Species, 'uses'>) {
	const uses = species.uses;
	if (!uses) return [];

	return SPECIES_USE_ORDER.filter((useKey) => Boolean(uses[useKey]))
		.map((useKey) => USE_CATEGORIES_BY_KEY.get(useKey)!)
		.filter(Boolean);
}
