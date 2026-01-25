/**
 * Tree Visualization Constants
 *
 * Configuration for taxonomy tree styling and display.
 */

import type { TaxonomicRank } from '$lib/types/taxonomy';

/**
 * Color palette for taxonomic ranks
 */
export const RANK_COLORS: Record<TaxonomicRank | 'root' | 'load-more', string> = {
	root: '#10b981',
	kingdom: '#10b981',
	phylum: '#10b981',
	class: '#10b981',
	order: '#10b981',
	family: '#10b981',
	genus: '#10b981',
	species: '#10b981',
	'load-more': '#94a3b8'
};

/**
 * Human-readable rank labels
 */
export const RANK_LABELS: Record<string, string> = {
	root: 'All Taxa',
	kingdom: 'Kingdom',
	phylum: 'Phylum',
	class: 'Class',
	order: 'Order',
	family: 'Family',
	genus: 'Genus',
	species: 'Species',
	'load-more': 'Load More'
};

/**
 * Get color for a node based on its rank
 */
export function getRankColor(
	rank: string | undefined | null,
	colors: Record<string, string> = RANK_COLORS
): string {
	if (!rank) return '#94a3b8';
	return colors[rank.toLowerCase()] || '#94a3b8';
}

/**
 * Get human-readable rank label
 */
export function getRankLabel(rank: string | undefined | null): string {
	if (!rank) return 'Unknown';
	return RANK_LABELS[rank.toLowerCase()] || rank;
}
