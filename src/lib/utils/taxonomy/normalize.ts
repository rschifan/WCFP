import type {
	TaxonomicRank,
	TaxonomyNode,
	TaxonomyNodeNormalized,
	TaxonomyTreeIndex,
	TaxonomySchema
} from '$lib/types/taxonomy';

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)+/g, '');
}

export function normalizeTaxonomyTree(data: TaxonomyNode): TaxonomyTreeIndex {
	const nodesById = new Map<string, TaxonomyNodeNormalized>();

	// Extract schema (if present) so we can infer ranks from depth.
	const schema: TaxonomySchema | undefined = (data as TaxonomyNode).schema;

	function inferRank(depth: number): TaxonomicRank {
		if (!schema || !Array.isArray(schema.ranks) || schema.ranks.length === 0) {
			// Fallback: keep existing behaviour when schema is not available.
			// In that case we expect node.rank to be populated.
			return 'root';
		}
		// Clamp depth to valid range
		if (depth < 0) return schema.ranks[0] as TaxonomicRank;
		if (depth >= schema.ranks.length) return schema.ranks[schema.ranks.length - 1] as TaxonomicRank;
		return schema.ranks[depth] as TaxonomicRank;
	}

	function walk(
		node: TaxonomyNode,
		parentPath: string,
		siblingIndex: number,
		parentId: string | null = null,
		depth: number = 0
	): string {
		const path = node.path ?? (parentPath ? `${parentPath}/${node.name}` : node.name);
		const baseId = node.id ?? slugify(path);
		const id = node.id ? node.id : `${baseId}~${siblingIndex}`;

		const childrenIds = (node.children ?? []).map((child, index) =>
			walk(child as TaxonomyNode, path, index, id, depth + 1)
		);

		// Prefer explicit rank if present; otherwise infer from schema and depth
		const rank = node.rank ?? inferRank(depth);

		nodesById.set(id, {
			id,
			name: node.name,
			nameLower: node.name.toLowerCase(),
			rank,
			count: node.count ?? 0,
			childCount: childrenIds.length,
			childrenIds,
			childrenLoaded: true,
			parentId, // Explicitly null for root, string for all others
			path,
			depth,
			...(typeof node.wcfpId === 'number' ? { wcfpId: node.wcfpId } : {}),
			...(node.authors ? { authors: node.authors } : {}),
			...(node.hasDistribution !== undefined ? { hasDistribution: node.hasDistribution } : {}),
			...(typeof node.distributionAreaCount === 'number'
				? { distributionAreaCount: node.distributionAreaCount }
				: {})
		});

		return id;
	}

	const rootId = walk(data, '', 0, null, 0); // depth 0 for root

	return { rootId, nodesById };
}
