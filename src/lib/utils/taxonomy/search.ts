import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';

export type SearchMode = 'contains' | 'prefix' | 'exact';

export class TaxonomySearchIndex {
	private index: Map<string, Set<string>> | null = null;

	constructor(private nodesById: Map<string, TaxonomyNodeNormalized>) {}

	private buildIndex(): void {
		this.index = new Map();

		for (const [nodeId, node] of this.nodesById.entries()) {
			const tokens = node.nameLower.split(/\s+/).filter((t) => t.length > 0);
			for (const token of tokens) {
				if (!this.index.has(token)) {
					this.index.set(token, new Set());
				}
				this.index.get(token)!.add(nodeId);
			}
		}
	}

	private searchByMode(normalizedQuery: string, mode: SearchMode): Set<string> {
		if (!this.index) return new Set();

		if (mode === 'exact') {
			return this.index.get(normalizedQuery) ?? new Set();
		}

		const matches = new Set<string>();

		if (mode === 'prefix') {
			for (const [token, nodeIds] of this.index.entries()) {
				if (token.startsWith(normalizedQuery)) {
					for (const nodeId of nodeIds) matches.add(nodeId);
				}
			}
		} else {
			// contains: O(n) substring match
			for (const [nodeId, node] of this.nodesById.entries()) {
				if (node.nameLower.includes(normalizedQuery)) {
					matches.add(nodeId);
				}
			}
		}

		return matches;
	}

	smartSearch(query: string): Set<string> {
		if (!this.index) this.buildIndex();

		const normalizedQuery = query.toLowerCase().trim();
		if (!normalizedQuery) return new Set();

		// Multi-word: use contains
		if (/\s/.test(normalizedQuery)) {
			return this.searchByMode(normalizedQuery, 'contains');
		}

		// Try exact → prefix → contains
		let matches = this.searchByMode(normalizedQuery, 'exact');
		if (matches.size > 0) return matches;

		matches = this.searchByMode(normalizedQuery, 'prefix');
		if (matches.size > 0) return matches;

		return this.searchByMode(normalizedQuery, 'contains');
	}

	getAncestors(nodeId: string): string[] {
		const ancestors: string[] = [];
		let current = this.nodesById.get(nodeId)?.parentId ?? null;

		while (current !== null) {
			ancestors.push(current);
			current = this.nodesById.get(current)?.parentId ?? null;
		}

		return ancestors;
	}
}
