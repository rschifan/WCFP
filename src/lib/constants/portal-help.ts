import {
	Bug,
	Dna,
	Filter,
	Flame,
	FlaskConical,
	Globe,
	Hammer,
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

export const FILTER_USE_CATEGORIES: FilterUseCategory[] = [
	{ key: 'humanFood', label: 'Human Food', icon: Wheat, activeClass: ACTIVE_CLASS },
	{ key: 'medicines', label: 'Medicines', icon: Pill, activeClass: ACTIVE_CLASS },
	{ key: 'poisons', label: 'Poisons', icon: Skull, activeClass: ACTIVE_CLASS },
	{ key: 'materials', label: 'Materials', icon: Hammer, activeClass: ACTIVE_CLASS },
	{ key: 'fuels', label: 'Fuels', icon: Flame, activeClass: ACTIVE_CLASS },
	{ key: 'animalFood', label: 'Animal Food', icon: Bug, activeClass: ACTIVE_CLASS },
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
		definition:
			'Plants or plant parts consumed directly by humans as food or beverages, including staple crops, fruits, vegetables, spices, and edible oils.'
	},
	{
		id: 'animalFood',
		key: 'animalFood',
		label: 'Animal Food',
		icon: Bug,
		tone: 'lime',
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
		definition:
			'Plants with cultural, ritual, recreational, or psychoactive significance, including species used in ceremonies, as ornamentals, or for non-medicinal psychoactive purposes.'
	}
];

export const SPECIES_USE_ORDER = ABOUT_USE_CATEGORIES.filter(
	(category): category is (typeof ABOUT_USE_CATEGORIES)[number] & { key: SpeciesUseKey } =>
		Boolean(category.key)
).map((category) => category.key);

export const HELP_SECTION_ICONS = {
	useCategories: Filter,
	lifeForm: TreeDeciduous,
	cwr: Dna,
	distribution: Globe
} as const;
