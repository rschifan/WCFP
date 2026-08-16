import {
	Bug,
	Dna,
	Filter,
	Flame,
	FlaskConical,
	Globe,
	Hammer,
	PawPrint,
	Pill,
	Skull,
	TreeDeciduous,
	Users,
	Wheat
} from 'lucide-svelte';
import type { HierarchyEntryBadgeTone } from '$lib/types/hierarchy';
import type { SpeciesUseKey } from '$lib/types/species';

export type PortalIcon = typeof Pill;

export interface FilterUseCategory {
	key: SpeciesUseKey;
	label: string;
	icon: PortalIcon;
	activeClass: string;
}

export interface AboutUseCategory {
	id: string;
	label: string;
	icon: PortalIcon;
	tone: HierarchyEntryBadgeTone;
	definition: string;
	key?: SpeciesUseKey;
}

const ACTIVE_CLASS = 'app-accent-chip-active';

// Human food is deliberately absent: every taxon in the checklist has one, so the filter would
// return the whole checklist and narrow nothing. See ADDITIONAL_USE_CATEGORIES below.
export const FILTER_USE_CATEGORIES: FilterUseCategory[] = [
	{ key: 'medicines', label: 'Medicines', icon: Pill, activeClass: ACTIVE_CLASS },
	{ key: 'poisons', label: 'Poisons', icon: Skull, activeClass: ACTIVE_CLASS },
	{ key: 'materials', label: 'Materials', icon: Hammer, activeClass: ACTIVE_CLASS },
	{ key: 'fuels', label: 'Fuels', icon: Flame, activeClass: ACTIVE_CLASS },
	{ key: 'animalFood', label: 'Animal Food', icon: PawPrint, activeClass: ACTIVE_CLASS },
	{
		key: 'invertebrateFood',
		label: 'Invertebrate Food',
		icon: Bug,
		activeClass: ACTIVE_CLASS
	},
	{ key: 'socialUses', label: 'Social Uses', icon: Users, activeClass: ACTIVE_CLASS },
	{
		key: 'environmentalUses',
		label: 'Environmental',
		icon: Globe,
		activeClass: ACTIVE_CLASS
	},
	{
		key: 'geneSources',
		label: 'Gene Sources',
		icon: FlaskConical,
		activeClass: ACTIVE_CLASS
	}
];

export const ABOUT_USE_CATEGORIES: AboutUseCategory[] = [
	{
		id: 'humanFood',
		key: 'humanFood',
		label: 'Human Food',
		icon: Wheat,
		tone: 'amber',
		// The checklist's inclusion criterion rather than a facet of it — every taxon carries this
		// use, which is why the category has no badge and no filter. The glossary states the scope
		// in prose; this stays a definition of the term.
		definition:
			'Plants consumed by humans as raw food (cereals, pseudocereals, pulses, fruits, starches, vegetables, nuts) or as processed food (food additives, gums, oils, resins, sugars), together with those used as spices and as ingredients in beverages.'
	},
	{
		id: 'animalFood',
		key: 'animalFood',
		// Not Bug: invertebrate food owns that, and the two carried the same icon and the same tone,
		// so a row badged for livestock fodder was indistinguishable from one badged for silkworms.
		label: 'Animal Food',
		icon: PawPrint,
		tone: 'amber',
		definition:
			'Plants used as feed or fodder for livestock, poultry, or other domesticated animals, including pasture grasses and supplementary feed.'
	},
	{
		id: 'medicines',
		key: 'medicines',
		label: 'Medicine',
		icon: Pill,
		tone: 'rose',
		definition:
			'Plants with documented therapeutic or pharmacological applications in traditional or modern medicine, used to treat, prevent, or alleviate human ailments.'
	},
	{
		id: 'materials',
		key: 'materials',
		label: 'Materials',
		icon: Hammer,
		tone: 'stone',
		definition:
			'Plants providing raw materials for construction, textile fibres, paper, rubber, resins, dyes, and other non-food industrial applications.'
	},
	{
		id: 'fuels',
		key: 'fuels',
		label: 'Fuel',
		icon: Flame,
		tone: 'orange',
		definition:
			'Plants used as a source of energy, including firewood, charcoal, and biomass for combustion or biofuel production.'
	},
	{
		id: 'geneSources',
		key: 'geneSources',
		label: 'Gene Sources',
		icon: FlaskConical,
		tone: 'indigo',
		definition:
			'Plants of significance as genetic resources for crop breeding and improvement, including wild relatives of cultivated species and species with traits of potential agronomic value.'
	},
	{
		id: 'poisons',
		key: 'poisons',
		label: 'Poisons',
		icon: Skull,
		tone: 'purple',
		definition:
			'Plants containing toxic compounds used or documented in the context of pest control, hunting, or as sources of biocides and pesticides.'
	},
	{
		id: 'invertebrateFood',
		key: 'invertebrateFood',
		label: 'Invertebrate Food',
		icon: Bug,
		tone: 'lime',
		definition:
			'Plants that serve as host or food source for economically or ecologically important invertebrates, including insects used for honey production, silk, or other products.'
	},
	{
		id: 'environmentalUses',
		key: 'environmentalUses',
		label: 'Environmental Uses',
		icon: Globe,
		tone: 'teal',
		definition:
			'Plants used for ecosystem services, land management, or environmental restoration, including nitrogen-fixing species, windbreaks, erosion control, and ornamentals.'
	},
	{
		id: 'socialUses',
		key: 'socialUses',
		label: 'Social Uses',
		icon: Users,
		tone: 'blue',
		// Ornamentals belong with Environmental Uses under EBDCS and were listed in both categories
		// here, which left the two definitions contradicting each other.
		definition:
			'Plants with cultural, ritual, recreational, or psychoactive significance, including species used in ceremonies or for non-medicinal psychoactive purposes.'
	}
];

/**
 * Bit-mask layout for `taxonomy_nodes.use_mask`.
 *
 * `scripts/build-duckdb.js` writes the mask against this exact order and `decodeUseMask` reads it
 * back with `1 << index`. Reordering or removing an entry silently decodes every stored mask to the
 * wrong categories, so this list changes only alongside a database rebuild.
 */
export const SPECIES_USE_ORDER = ABOUT_USE_CATEGORIES.filter(
	(category): category is (typeof ABOUT_USE_CATEGORIES)[number] & { key: SpeciesUseKey } =>
		Boolean(category.key)
).map((category) => category.key);

/**
 * The categories worth showing per taxon — the nine that are not human food.
 *
 * Human food is the criterion for entering the checklist, not a trait that distinguishes one taxon
 * from another: every record carries it. A chip on every card, a badge on every row and a filter
 * that returns everything are all noise, so presentation uses this list.
 *
 * It stays in `ABOUT_USE_CATEGORIES` regardless, because the glossary still has to say what human
 * food means — that definition is what the scope of the checklist rests on.
 */
export const ADDITIONAL_USE_CATEGORIES = ABOUT_USE_CATEGORIES.filter(
	(category): category is (typeof ABOUT_USE_CATEGORIES)[number] & { key: SpeciesUseKey } =>
		Boolean(category.key) && category.key !== 'humanFood'
);

export const HELP_SECTION_ICONS = {
	useCategories: Filter,
	lifeForm: TreeDeciduous,
	cwr: Dna,
	distribution: Globe
} as const;
