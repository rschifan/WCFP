import { writable, type Readable } from 'svelte/store';
import type { OccurrenceStatusFilter } from '$lib/types/taxonomy';

/**
 * The occurrence-status scope applied to the region panel's tree, and the facet counts beside it.
 *
 * It lives in a store rather than in `TaxonomyFilters` because it is a scope: the region source
 * carries it, so bootstrap, lazily-loaded children and search all honour it. The counts are
 * fetched by the map layout while the control renders inside the region panel, which arrives
 * through the route's children snippet — props cannot cross that boundary.
 */
export interface OccurrenceFacet {
	occurrence_status: OccurrenceStatusFilter;
	count: number;
}

export interface OccurrenceFilterState {
	status: OccurrenceStatusFilter | null;
	facets: OccurrenceFacet[];
}

const EMPTY_STATE: OccurrenceFilterState = { status: null, facets: [] };

const store = writable<OccurrenceFilterState>(EMPTY_STATE);

export const occurrenceFilterStore: Readable<OccurrenceFilterState> = {
	subscribe: store.subscribe
};

export function setOccurrenceStatus(status: OccurrenceStatusFilter | null): void {
	store.update((state) => ({ ...state, status }));
}

/** Replace the counts, e.g. after the selected region changed. */
export function setOccurrenceFacets(facets: OccurrenceFacet[]): void {
	store.update((state) => ({ ...state, facets }));
}
