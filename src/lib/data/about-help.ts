import { ABOUT_USE_CATEGORIES, ADDITIONAL_USE_CATEGORIES } from '$lib/constants/portal-help';
import type { HelpReference, HelpSection } from '$lib/types/help';

const humanFood = ABOUT_USE_CATEGORIES.find((category) => category.key === 'humanFood');

if (!humanFood) {
	throw new Error('ABOUT_USE_CATEGORIES must define the human food category.');
}

/**
 * One bibliography for the whole guide, numbered by first citation.
 *
 * Each section used to carry its own short list, so the same source could appear twice under
 * different numbers and a reader had no way to tell which sentence a reference belonged to. These
 * are cited inline instead, by the `id` below, and rendered once at the foot of the guide.
 *
 * Order is order of first appearance in the text — renumbering happens by moving an entry, never by
 * editing a number, because the numbers are positions rather than data.
 */
export const aboutReferences: HelpReference[] = [
	{
		id: 'ebdcs',
		label:
			'Cook FEM (1995). Economic Botany Data Collection Standard. Prepared for the International Working Group on Taxonomic Databases for Plant Sciences (TDWG). Royal Botanic Gardens, Kew.'
	},
	{
		id: 'wcup',
		label:
			'Diazgranados M, Allkin B, Black N, et al. (2020). World Checklist of Useful Plant Species. Royal Botanic Gardens, Kew. Knowledge Network for Biocomplexity.',
		href: 'https://doi.org/10.5063/F1CV4G34'
	},
	{
		id: 'grin',
		label:
			'Global Crop Diversity Trust, Bioversity International & USDA Agricultural Research Service (2025). GRIN-Global Server.',
		href: 'https://npgsweb.ars-grin.gov'
	},
	{
		id: 'grin-cwr-inventory',
		label:
			'Wiersema JH & Leon B (2016). The GRIN Taxonomy crop wild relative inventory. In: Maxted N, Dulloo ME & Ford-Lloyd BV (eds.), Enhancing Crop Genepool Use. CAB International.',
		href: 'https://npgsweb.ars-grin.gov'
	},
	{
		id: 'wcvp',
		label: 'World Checklist of Vascular Plants (WCVP). Royal Botanic Gardens, Kew.',
		href: 'https://powo.science.kew.org/'
	},
	{
		id: 'wgsrpd',
		label:
			'Brummitt RK (2001). World Geographical Scheme for Recording Plant Distributions, 2nd edition. International Working Group on Taxonomic Databases for Plant Sciences (TDWG).'
	}
];

export const aboutHelpSections: HelpSection[] = [
	{
		id: 'use-categories',
		title: 'Use categories',
		paragraphs: [
			[
				// The scheme is *adapted from* WCUP rather than defined by it, and the descriptions in
				// the table are this portal's summaries rather than either source's text. Saying
				// otherwise would attribute wording to Cook and to Diazgranados et al. that neither
				// wrote.
				{
					text: 'Plant uses are classified following the Economic Botany Data Collection Standard'
				},
				{ text: ' (Cook, 1995)', cite: ['ebdcs'] },
				{
					text: ', using a simplified categorisation adapted from the World Checklist of Useful Plant Species'
				},
				{ text: ' (Diazgranados et al., 2020)', cite: ['wcup'] },
				{ text: '.' }
			],
			// Human food is described here rather than listed in the table: it is the criterion for
			// inclusion, so it carries no badge anywhere in the portal, and a table row with an empty
			// icon cell would imply a marker the reader will never meet.
			`Every taxon in the checklist has a documented human food use — that is the criterion for inclusion. ${humanFood.definition} The nine categories below record uses documented in addition to it, and each has a badge used throughout the portal:`
		],
		table: {
			columns: ['Category', 'Definition'],
			rows: ADDITIONAL_USE_CATEGORIES.map((category) => ({
				iconBadge: {
					id: `about-use:${category.id}`,
					icon: category.icon,
					tone: category.tone,
					tooltip: category.label,
					description: category.definition
				},
				cells: [category.label, category.definition]
			}))
		}
	},
	{
		id: 'life-form',
		title: 'Life form',
		paragraphs: [
			'Life form refers to the overall growth habit and structural form of a plant species, reflecting its adaptation to the environment. Life form categories used in this portal follow standard botanical classifications and include: trees (woody plants with a single main stem reaching over 5 m), shrubs (multi-stemmed woody plants generally under 5 m), herbs (non-woody or weakly woody plants), climbers/lianas (plants that use other structures for support), and succulents (plants with water-storing tissues), among others.'
		]
	},
	{
		id: 'cwr',
		title: 'Cultivated taxa and Crop Wild Relatives (CWR)',
		paragraphs: [
			[
				{
					text: 'Crop Wild Relatives are wild plant taxa closely related to cultivated crops that represent a critical reservoir of genetic diversity for crop improvement and food security. In this portal, CWR status follows the '
				},
				{ text: 'GRIN-Global CWR database', href: 'https://npgsweb.ars-grin.gov' },
				{ text: '', cite: ['grin', 'grin-cwr-inventory'] },
				{ text: ' integrated with the ' },
				{
					text: 'World Checklist of Vascular Plants (WCVP)',
					href: 'https://powo.science.kew.org/'
				},
				{ text: '', cite: ['wcvp'] },
				{
					text: '. Taxa were classified as cultivated or as CWR by retaining only records with an assigned gene pool or graftstock designation in GRIN-Global. Food plant taxa with CWR status and documented food uses are referred to as edible CWR.'
				}
			],
			'CWR are classified according to their hybridization potential with crops using the gene pool framework:'
		],
		table: {
			columns: ['Category', 'Definition'],
			rows: [
				{
					cells: [
						'Primary gene pool (GP-1)',
						'Wild or weedy forms of the same biological species as the crop; gene transfer is straightforward and hybrids are generally fertile.'
					]
				},
				{
					cells: [
						'Secondary gene pool (GP-2)',
						'Closely related species where hybridization is possible but hybrid fertility is reduced and gene transfer more difficult.'
					]
				},
				{
					cells: [
						'Tertiary gene pool (GP-3)',
						'More distantly related species for which gene transfer requires advanced biotechnological techniques such as embryo rescue or somatic hybridization.'
					]
				},
				{
					cells: [
						'Graftstock',
						'Species used as rootstocks for grafting with the cultivated crop, relevant for their indirect agronomic utility.'
					]
				}
			]
		}
	},
	{
		id: 'distribution',
		title: 'Plant distribution data',
		paragraphs: [
			[
				{ text: 'Plant distribution data are sourced from the ' },
				{
					text: 'World Checklist of Vascular Plants (WCVP)',
					href: 'https://powo.science.kew.org/'
				},
				{ text: '', cite: ['wcvp'] },
				{
					text: '; areas of cultivation are not included. Geographic units follow the World Geographical Scheme for Recording Plant Distributions (WGSRPD) at Level 3 (TDWG3)'
				},
				{ text: '', cite: ['wgsrpd'] },
				{
					text: ', a standardised system widely used in botanical literature to define botanical countries and regions. Where a TDWG3 area corresponds to a single sovereign nation, the respective ISO 3166-1 alpha-2 and alpha-3 codes are provided to facilitate interoperability. For TDWG3 areas that encompass more than one country (e.g. former political units or multi-island regions), ISO codes are not assigned and all constituent countries are listed, separated by "/".'
				}
			]
		]
	}
];
