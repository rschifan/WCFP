import type { SpeciesUseKey } from '$lib/types/species';
import type { TaxonomyFilters, TaxonomyTraitEntry, TaxonomyTraitIndex } from '$lib/types/taxonomy';

interface ParsedSignature {
	lifeform: string | null;
	uses: Set<SpeciesUseKey>;
}

const signatureCache = new Map<string, ParsedSignature>();

function parseSignature(signature: string): ParsedSignature {
	const cached = signatureCache.get(signature);
	if (cached) return cached;

	const [lifeformPart = '', usesPart = ''] = signature.split('::');
	const parsed: ParsedSignature = {
		lifeform: lifeformPart || null,
		uses: new Set(
			usesPart
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean) as SpeciesUseKey[]
		)
	};

	signatureCache.set(signature, parsed);
	return parsed;
}

export function hasActiveTaxonomyTraitFilters(filters: TaxonomyFilters): boolean {
	return filters.lifeforms.size > 0 || filters.uses.size > 0;
}

export function getAvailableTaxonomyLifeforms(
	index: TaxonomyTraitIndex,
	preferredPaths: string[] = ['root/Plantae', 'root']
): string[] {
	for (const path of preferredPaths) {
		const entry = index[path];
		if (entry?.lifeforms?.length) {
			return [...entry.lifeforms].sort((a, b) => a.localeCompare(b));
		}
	}

	return [];
}

export function matchesTaxonomyTraitEntry(
	entry: TaxonomyTraitEntry | undefined,
	filters: TaxonomyFilters
): boolean {
	const hasLifeformFilters = filters.lifeforms.size > 0;
	const hasUseFilters = filters.uses.size > 0;

	if (!hasLifeformFilters && !hasUseFilters) return true;
	if (!entry) return false;

	if (hasLifeformFilters && !entry.lifeforms.some((lifeform) => filters.lifeforms.has(lifeform))) {
		return false;
	}

	if (hasUseFilters && ![...filters.uses].every((use) => entry.uses.includes(use))) {
		return false;
	}

	return (entry.signatures ?? []).some((signature) => {
		const parsed = parseSignature(signature);

		if (hasLifeformFilters && (!parsed.lifeform || !filters.lifeforms.has(parsed.lifeform))) {
			return false;
		}

		if (hasUseFilters && ![...filters.uses].every((use) => parsed.uses.has(use))) {
			return false;
		}

		return true;
	});
}

export function buildMatchingTaxonomyPaths(
	index: TaxonomyTraitIndex,
	filters: TaxonomyFilters
): Set<string> | null {
	if (!hasActiveTaxonomyTraitFilters(filters)) {
		return null;
	}

	const matchingPaths = new Set<string>();

	for (const [path, entry] of Object.entries(index)) {
		if (matchesTaxonomyTraitEntry(entry, filters)) {
			matchingPaths.add(path);
		}
	}

	return matchingPaths;
}
