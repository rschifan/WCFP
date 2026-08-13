import type { SpeciesUseKey, SpeciesUses } from './species';

/**
 * Type definitions for taxonomy data and visualization
 */

/**
 * Taxonomic ranks in order from highest to lowest.
 *
 * Note: the schema-based taxonomy tree also has a synthetic "root" node.
 * For raw JSON we infer ranks from depth using the schema, but we still
 * use this union type for normalized nodes and helpers.
 */
export type TaxonomicRank =
	| 'root'
	| 'kingdom'
	| 'phylum'
	| 'class'
	| 'order'
	| 'family'
	| 'genus'
	| 'species';

/**
 * Schema metadata for the taxonomy tree.
 *
 * Defines the rank hierarchy once at the root level. Ranks are inferred
 * from depth in the tree: schema.ranks[depth].
 */
export interface TaxonomySchema {
	ranks: string[];
}

/**
 * A node in the taxonomy tree (for visualization)
 */
export interface TaxonomyNode {
	name: string;
	/**
	 * Optional rank on raw nodes.
	 * In the schema-based format we infer ranks from depth, so this is
	 * primarily used for backwards compatibility or when rank is known.
	 */
	rank?: TaxonomicRank;
	/** Number of descendant taxa (including this node) */
	count: number;
	children: TaxonomyNode[];
	/** Original child count (preserved when filtering collapsed nodes) */
	_childCount?: number;
	/** Optional stable ID if provided by data source */
	id?: string;
	/** Optional precomputed path */
	path?: string;
	/**
	 * Optional WCFP_ID on species nodes.
	 * Present only for leaves in the schema-based taxonomy tree.
	 */
	wcfpId?: number;
	/**
	 * Optional authorship string on species nodes.
	 * Used for inline display in the taxonomy browser.
	 */
	authors?: string;
	/**
	 * Whether this node or any of its descendants has spatial distribution data.
	 * Used to determine if the node should be selectable for map interaction.
	 */
	hasDistribution?: boolean;
	distributionAreaCount?: number;
	/**
	 * Optional schema definition on the root node.
	 * Child nodes do not repeat this field.
	 */
	schema?: TaxonomySchema;
}

/**
 * Normalized taxonomy node for fast lookup
 */
export interface TaxonomyNodeNormalized {
	id: string;
	name: string;
	nameLower: string;
	/** Inferred rank based on depth + schema */
	rank: TaxonomicRank;
	count: number;
	childCount: number;
	childrenIds: string[];
	childrenLoaded: boolean;
	parentId: string | null; // null for root node, string for all others
	path?: string;
	wcfpId?: number;
	authors?: string;
	hasDistribution?: boolean;
	distributionAreaCount?: number;
	traits?: TaxonomyTraitEntry;
	/**
	 * Depth of this node in the tree, starting at 0 for the root.
	 * Used for efficient rank inference without recomputing depth.
	 */
	depth: number;
}

/**
 * Normalized taxonomy tree index
 */
export interface TaxonomyTreeIndex {
	rootId: string;
	nodesById: Map<string, TaxonomyNodeNormalized>;
}

/**
 * Active filters for taxonomy browsing.
 */
export interface TaxonomyFilters {
	geographicOnly: boolean;
	lifeforms: Set<string>;
	uses: Set<SpeciesUseKey>;
}

export function createEmptyTaxonomyFilters(): TaxonomyFilters {
	return {
		geographicOnly: false,
		lifeforms: new Set(),
		uses: new Set()
	};
}

export interface TaxonomyTraitEntry {
	lifeforms: string[];
	uses: SpeciesUseKey[];
	signatures?: string[];
	hasCwr?: boolean;
}

export type TaxonomyTraitIndex = Record<string, TaxonomyTraitEntry>;

export interface TaxonomyBootstrapPayload {
	rootId: string;
	startFromId: string;
	expandedIds: string[];
	availableLifeforms: string[];
	nodes: TaxonomyNodeNormalized[];
}

export interface TaxonomyChildrenPayload {
	parentId: string;
	nodes: TaxonomyNodeNormalized[];
}

export interface TaxonomyQueryPayload {
	rootId: string;
	startFromId: string;
	expandedIds: string[];
	nodes: TaxonomyNodeNormalized[];
}

/**
 * Species enriched with full taxonomy
 */
export interface EnrichedSpecies {
	wcfpId: number;
	name: string;
	authors: string;
	family: string;
	genus: string;
	kingdom: string;
	phylum: string;
	class: string;
	order: string;
	lifeform?: string;
	cwr?: boolean;
	uses?: SpeciesUses;
	sourceLink?: string;
	referencesAll?: string[];
}
