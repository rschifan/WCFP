import type { TaxonomyNodeNormalized, TaxonomyTreeIndex } from '$lib/types/taxonomy';

function cloneNode(node: TaxonomyNodeNormalized): TaxonomyNodeNormalized {
	return {
		...node,
		childrenIds: [...node.childrenIds]
	};
}

export function buildTaxonomyTreeIndex(
	rootId: string,
	nodes: readonly TaxonomyNodeNormalized[]
): TaxonomyTreeIndex {
	const nodesById = new Map<string, TaxonomyNodeNormalized>();

	for (const node of nodes) {
		nodesById.set(node.id, { ...cloneNode(node), childrenIds: [] });
	}

	for (const node of nodes) {
		if (!node.parentId) continue;

		const parent = nodesById.get(node.parentId);
		if (!parent) continue;

		parent.childrenIds = [...parent.childrenIds, node.id];
	}

	return {
		rootId,
		nodesById
	};
}

/**
 * Merge query result nodes into an existing browse index.
 * Adds nodes that aren't already present, updating parent childrenIds links.
 * The browse tree structure is preserved; query nodes fill in deep branches.
 */
export function mergeQueryIntoIndex(
	browseIndex: TaxonomyTreeIndex,
	queryNodes: readonly TaxonomyNodeNormalized[]
): TaxonomyTreeIndex {
	const nodesById = new Map(browseIndex.nodesById);

	for (const queryNode of queryNodes) {
		if (nodesById.has(queryNode.id)) continue;

		nodesById.set(queryNode.id, cloneNode(queryNode));

		if (queryNode.parentId) {
			const parent = nodesById.get(queryNode.parentId);
			if (parent && !parent.childrenIds.includes(queryNode.id)) {
				nodesById.set(queryNode.parentId, {
					...parent,
					childrenLoaded: true,
					childrenIds: [...parent.childrenIds, queryNode.id]
				});
			}
		}
	}

	return { rootId: browseIndex.rootId, nodesById };
}

export function mergeTaxonomyChildren(
	index: TaxonomyTreeIndex,
	parentId: string,
	children: readonly TaxonomyNodeNormalized[]
): TaxonomyTreeIndex {
	const nodesById = new Map(index.nodesById);
	const nextChildIds = children.map((child) => child.id);

	for (const child of children) {
		nodesById.set(child.id, cloneNode(child));
	}

	const parent = nodesById.get(parentId);
	if (parent) {
		nodesById.set(parentId, {
			...parent,
			childrenLoaded: true,
			childrenIds: nextChildIds
		});
	}

	return {
		rootId: index.rootId,
		nodesById
	};
}
