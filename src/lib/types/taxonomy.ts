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
export type TaxonomicRank = 'root' | 'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus' | 'species';

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
 * Taxonomy path for a family - used in families.json lookup
 */
export interface FamilyTaxonomy {
	kingdom: string;
	phylum: string;
	class: string;
	order: string;
	speciesCount: number;
}

/**
 * The families.json lookup structure
 */
export type FamilyLookup = Record<string, FamilyTaxonomy>;

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
	children: TaxonomyNode[] | any[]; // Can include load-more nodes (any[] for flexibility)
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
	childrenIds: string[];
	parentId: string | null; // null for root node, string for all others
	path?: string;
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
	uses?: import('./species').SpeciesUses;
}
