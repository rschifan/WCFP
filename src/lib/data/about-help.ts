import { ABOUT_USE_CATEGORIES } from '$lib/constants/portal-help';
import type { HelpSection } from '$lib/types/help';

export const aboutHelpSections: HelpSection[] = [
	{
		id: 'use-categories',
		title: 'Use categories',
		paragraphs: [
			'Plant uses are classified according to the ten categories defined in the World Checklist of Useful Plant Species (Diazgranados et al., 2020), based on the Economic Botany Data Collection Standard (EBDCS; Cook, 1995). Each category is defined as follows:'
		],
		table: {
			columns: ['Category', 'Definition'],
			rows: ABOUT_USE_CATEGORIES.map((category) => ({
				iconBadge: {
					id: `about-use:${category.id}`,
					icon: category.icon,
					tone: category.tone,
					tooltip: category.label,
					description: category.definition
				},
				cells: [category.label, category.definition]
			}))
		},
		references: [
			{
				label:
					'Reference: Diazgranados M, Allkin B, Black N, et al. (2020). World Checklist of Useful Plant Species. Royal Botanic Gardens, Kew. Knowledge Network for Biocomplexity. doi:10.5063/F1CV4G34',
				href: 'https://doi.org/10.5063/F1CV4G34'
			}
		]
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
				{
					text: 'GRIN-Global CWR database',
					href: 'https://npgsweb.ars-grin.gov'
				},
				{
					text: ' (Global Crop Diversity Trust, Bioversity International & USDA Agricultural Research Service, 2025) integrated with the '
				},
				{
					text: 'World Checklist of Vascular Plants (WCVP)',
					href: 'https://powo.science.kew.org/'
				},
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
		},
		references: [
			{
				label:
					'Reference: Global Crop Diversity Trust, Bioversity International & USDA Agricultural Research Service. GRIN-Global Server. (2025). https://npgsweb.ars-grin.gov',
				href: 'https://npgsweb.ars-grin.gov'
			},
			{
				label:
					'Reference: Wiersema JH & Leon B (2016). The GRIN Taxonomy crop wild relative inventory. In: Maxted N, Dulloo ME & Ford-Lloyd BV (eds.), Enhancing Crop Genepool Use. CAB International. USDA-ARS GRIN Taxonomy: https://npgsweb.ars-grin.gov',
				href: 'https://npgsweb.ars-grin.gov'
			}
		]
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
				{
					text: '; areas of cultivation are not included. Geographic units follow the World Geographical Scheme for Recording Plant Distributions (WGSRPD) at Level 3 (TDWG3), a standardised system widely used in botanical literature to define botanical countries and regions. Where a TDWG3 area corresponds to a single sovereign nation, the respective ISO 3166-1 alpha-2 and alpha-3 codes are provided to facilitate interoperability. For TDWG3 areas that encompass more than one country (e.g. former political units or multi-island regions), ISO codes are not assigned and all constituent countries are listed, separated by "/".'
				}
			]
		],
		references: [
			{
				label: 'World Checklist of Vascular Plants (WCVP)',
				href: 'https://powo.science.kew.org/'
			}
		]
	}
];
