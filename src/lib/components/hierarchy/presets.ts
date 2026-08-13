import { Dna, TreeDeciduous } from 'lucide-svelte';
import { ABOUT_USE_CATEGORIES, SPECIES_USE_ORDER } from '$lib/constants/portal-help';
import type { Species, SpeciesUseKey } from '$lib/types/species';
import type { TaxonomyTraitEntry } from '$lib/types/taxonomy';
import type {
	HierarchyEntryBadge,
	HierarchyEntryBadgeTone,
	HierarchyEntryIcon,
	HierarchyEntryModel,
	HierarchyEntryPreset
} from '$lib/types/hierarchy';

interface SpeciesBadgeDefinition {
	label: string;
	description: string;
	tone: HierarchyEntryBadgeTone;
	icon: HierarchyEntryIcon;
}

const USE_BADGE_DEFINITIONS = Object.fromEntries(
	ABOUT_USE_CATEGORIES.filter(
		(category): category is (typeof ABOUT_USE_CATEGORIES)[number] & { key: SpeciesUseKey } =>
			Boolean(category.key)
	).map((category) => [
		category.key,
		{
			label: category.label,
			description: category.definition,
			tone: category.tone,
			icon: category.icon
		}
	])
) as Record<SpeciesUseKey, SpeciesBadgeDefinition>;

const CWR_BADGE_DEFINITION: SpeciesBadgeDefinition = {
	label: 'Crop Wild Relative',
	description: 'Wild ancestor of cultivated crops',
	tone: 'amber',
	icon: Dna
};

const LIFEFORM_BADGE_DEFINITION: SpeciesBadgeDefinition = {
	label: 'Life Form',
	description: 'Growth habit and life cycle',
	tone: 'slate',
	icon: TreeDeciduous
};

export const taxonomyBrowserPreset: HierarchyEntryPreset = {
	id: 'taxonomy-browser',
	showMeta: false,
	showSubtitle: true,
	showBadges: true,
	showCount: true
};

export const regionSpeciesPreset: HierarchyEntryPreset = {
	id: 'region-species',
	showMeta: false,
	showSubtitle: true,
	showBadges: true,
	showCount: true
};

export const SHARED_TRAIT_BADGE_LEVELS: readonly TaxonomicEntryLevel[] = [
	'species'
];

export type TaxonomicEntryLevel =
	| 'default'
	| 'root'
	| 'kingdom'
	| 'phylum'
	| 'class'
	| 'order'
	| 'family'
	| 'genus'
	| 'species';

export function getTaxonomicEntryAppearance(
	level: TaxonomicEntryLevel
): Pick<HierarchyEntryModel, 'titleTone' | 'titleStyle' | 'titleWeight'> {
	switch (level) {
		case 'genus':
			return {
				titleTone: 'muted',
				titleStyle: 'italic',
				titleWeight: 'medium'
			};
		case 'species':
			return {
				titleTone: 'strong',
				titleStyle: 'italic',
				titleWeight: 'regular'
			};
		case 'family':
		case 'order':
		case 'class':
		case 'phylum':
		case 'kingdom':
		case 'root':
		case 'default':
		default:
			return {
				titleTone: 'default',
				titleStyle: 'normal',
				titleWeight: 'semibold'
			};
	}
}

function buildTraitBadges(
	traitSource: {
		idPrefix: string;
		lifeforms: readonly string[];
		uses: readonly SpeciesUseKey[];
		hasCwr?: boolean;
	},
	options: { showLifeformLabel?: boolean } = {}
): HierarchyEntryBadge[] {
	const badges: HierarchyEntryBadge[] = [];

	if (traitSource.lifeforms.length > 0) {
		badges.push({
			id: `${traitSource.idPrefix}:lifeform`,
			label:
				options.showLifeformLabel && traitSource.lifeforms.length === 1
					? traitSource.lifeforms[0]
					: undefined,
			icon: LIFEFORM_BADGE_DEFINITION.icon,
			tone: LIFEFORM_BADGE_DEFINITION.tone,
			ariaLabel:
				options.showLifeformLabel && traitSource.lifeforms.length === 1
					? traitSource.lifeforms[0]
					: LIFEFORM_BADGE_DEFINITION.label
		});
	}

	if (traitSource.hasCwr) {
		badges.push({
			id: `${traitSource.idPrefix}:cwr`,
			icon: CWR_BADGE_DEFINITION.icon,
			tone: CWR_BADGE_DEFINITION.tone,
			tooltip: CWR_BADGE_DEFINITION.label,
			ariaLabel: CWR_BADGE_DEFINITION.label,
			description: CWR_BADGE_DEFINITION.description
		});
	}

	for (const useKey of SPECIES_USE_ORDER) {
		if (!traitSource.uses.includes(useKey)) continue;
		const config = USE_BADGE_DEFINITIONS[useKey];
		badges.push({
			id: `${traitSource.idPrefix}:${useKey}`,
			icon: config.icon,
			tone: config.tone,
			ariaLabel: config.label
		});
	}

	return badges;
}

export function buildRegionSpeciesBadges(species: Species): HierarchyEntryBadge[] {
	return buildTraitBadges(
		{
			idPrefix: `species:${species.wcfpId}`,
			lifeforms: species.lifeform ? [species.lifeform] : [],
			uses: SPECIES_USE_ORDER.filter((useKey) => Boolean(species.uses?.[useKey])),
			hasCwr: species.cwr
		},
		{ showLifeformLabel: true }
	);
}

export function buildTaxonomyTraitBadges(
	entry: TaxonomyTraitEntry | undefined,
	options: { idPrefix?: string; showLifeformLabel?: boolean } = {}
): HierarchyEntryBadge[] {
	if (!entry) return [];

	return buildTraitBadges(
		{
			idPrefix: options.idPrefix ?? 'taxonomy',
			lifeforms: entry.lifeforms,
			uses: entry.uses,
			hasCwr: entry.hasCwr
		},
		{ showLifeformLabel: options.showLifeformLabel }
	);
}
