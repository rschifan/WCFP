/**
 * Node Traversal Utilities
 *
 * Utilities for traversing and extracting data from taxonomy nodes.
 * Used for computing spatial distributions and generating cache keys.
 */

import type {
	TaxonomyNode,
	TaxonomyNodeNormalized,
	TaxonomyTreeIndex,
	TaxonomySchema
} from '$lib/types/taxonomy';

/**
 * Infer rank from schema and depth.
 *
 * @param schema - Taxonomy schema (ranks in order from root to species)
 * @param depth - Depth of the node (0 = root)
 */
export function getNodeRankFromDepth(schema: TaxonomySchema, depth: number): string {
	if (!schema?.ranks?.length) return 'root';
	if (depth < 0) return schema.ranks[0];
	if (depth >= schema.ranks.length) return schema.ranks[schema.ranks.length - 1];
	return schema.ranks[depth];
}

/**
 * Convenience helper to infer rank for a normalized node using its stored depth.
 */
export function getNodeRankFromNode(
	node: TaxonomyNodeNormalized,
	schema: TaxonomySchema
): string {
	return getNodeRankFromDepth(schema, node.depth);
}

/**
 * Recursively collect all descendant species nodes from a raw taxonomy node.
 *
 * Uses schema and depth to identify species by rank.
 * 
 * IMPORTANT: If the node itself has a `wcfpId`, it is considered a species
 * regardless of depth calculation (handles cases where depth is unknown).
 */
export function collectDescendantSpecies(
	node: TaxonomyNode,
	schema: TaxonomySchema,
	depth = 0
): TaxonomyNode[] {
	const species: TaxonomyNode[] = [];

	// If node has wcfpId, it's a species node - include it directly
	// This handles the case where a species node is passed but depth is wrong
	if (typeof node.wcfpId === 'number' && Number.isFinite(node.wcfpId)) {
		species.push(node);
		// If it's a species, it has no descendant species, so return early
		return species;
	}

	const rankAtDepth = getNodeRankFromDepth(schema, depth);
	if (rankAtDepth === 'species') {
		species.push(node);
		return species;
	}

	if (node.children && Array.isArray(node.children)) {
		for (const child of node.children) {
			if (child && typeof child === 'object' && 'name' in child) {
				species.push(
					...collectDescendantSpecies(child as TaxonomyNode, schema, depth + 1)
				);
			}
		}
	}

	return species;
}

/**
 * Collect all descendant species nodes starting from a normalized node.
 * Uses the TaxonomyTreeIndex to walk children and stored depth to identify species.
 */
export function collectDescendantSpeciesNormalized(
	node: TaxonomyNodeNormalized,
	schema: TaxonomySchema,
	index: TaxonomyTreeIndex
): TaxonomyNodeNormalized[] {
	const species: TaxonomyNodeNormalized[] = [];

	function walk(currentId: string) {
		const current = index.nodesById.get(currentId);
		if (!current) return;

		const rank = getNodeRankFromNode(current, schema);
		if (rank === 'species') {
			species.push(current);
			return;
		}

		for (const childId of current.childrenIds) {
			walk(childId);
		}
	}

	walk(node.id);
	return species;
}

/**
 * Get all descendant WCFP_IDs for a given taxonomy node.
 *
 * Uses the schema-based taxonomy tree where species nodes carry `wcfpId`.
 * 
 * IMPORTANT: If the node itself is a species (has `wcfpId`), it will be included
 * in the result set. This handles the case where a species node is selected directly.
 */
export function getWcfpIdsForNode(node: TaxonomyNode, schema: TaxonomySchema): Set<number> {
	const ids = new Set<number>();

	// If this node itself is a species (has wcfpId), include it directly
	if (typeof node.wcfpId === 'number' && Number.isFinite(node.wcfpId)) {
		ids.add(node.wcfpId);
	}

	// Collect all descendant species nodes starting from this node.
	// We don't know the absolute depth of this node in the tree here,
	// so we treat it as depth 0 and rely on relative depth to reach
	// the species level (schema still provides correct relative ordering).
	const speciesNodes = collectDescendantSpecies(node, schema, 0);

	for (const s of speciesNodes) {
		if (typeof s.wcfpId === 'number' && Number.isFinite(s.wcfpId)) {
			ids.add(s.wcfpId);
		}
	}

	return ids;
}

/**
 * Generate a unique path string for a taxonomy node.
 * Used as a cache key for distribution data.
 *
 * Uses the node's precomputed path if available, otherwise falls back to node name.
 * For proper caching, nodes should have the `path` property set during tree construction.
 *
 * @param node - The taxonomy node
 * @returns Path string (e.g., "Plantae/Magnoliophyta/Magnoliopsida")
 *
 * @example
 * ```typescript
 * const path = getNodePath(node);
 * // Returns: "Plantae/Magnoliophyta/Magnoliopsida/Rosales"
 * ```
 */
export function getNodePath(node: TaxonomyNode): string {
	// Use precomputed path if available (preferred)
	if (node.path) {
		return node.path;
	}

	// Fallback: use node name (may not be unique, but works for leaf nodes)
	// In practice, taxonomy nodes should have path set during tree construction
	return node.name;
}

/**
 * Find a taxonomy node by its path string.
 * Searches through the tree structure to locate the node matching the given path.
 *
 * @param tree - The root taxonomy tree to search
 * @param path - Path string (e.g., "Plantae/Magnoliophyta/Magnoliopsida")
 * @returns The matching node if found, null otherwise
 *
 * @example
 * ```typescript
 * const node = findNodeByPath(taxonomyTree, "Plantae/Magnoliophyta");
 * if (node) {
 *   console.log(`Found: ${node.name}`);
 * }
 * ```
 */
export function findNodeByPath(tree: TaxonomyNode, path: string): TaxonomyNode | null {
	if (!path || !tree) {
		return null;
	}

	const pathParts = path.split('/').filter((part) => part.trim().length > 0);

	if (pathParts.length === 0) {
		return tree;
	}

	// Start from root
	let currentNode: TaxonomyNode | null = tree;

	// Traverse path parts sequentially
	for (let i = 0; i < pathParts.length; i++) {
		const part = pathParts[i];
		if (!currentNode) {
			return null;
		}

		// If current node name matches this part
		if (currentNode.name === part) {
			// If this is the last part, return this node
			if (i === pathParts.length - 1) {
				return currentNode;
			}

			// Otherwise, find matching child for next part
			if (currentNode.children && Array.isArray(currentNode.children)) {
				const nextPart = pathParts[i + 1];
				const matchingChild = currentNode.children.find(
					(child) =>
						child &&
						typeof child === 'object' &&
						'name' in child &&
						child.name === nextPart
				) as TaxonomyNode | undefined;

				if (matchingChild) {
					currentNode = matchingChild;
				} else {
					return null; // Path not found
				}
			} else {
				return null; // No children to continue
			}
		} else {
			// Current node doesn't match - path is invalid
			return null;
		}
	}

	return currentNode;
}
