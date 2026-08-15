import { get, writable, type Readable } from 'svelte/store';
import type { OccurrenceStatusFilter } from '$lib/types/taxonomy';

/**
 * The occurrence-status filter applied to the region panel's list.
 *
 * Scoped deliberately: the map has its own control in the bar above it. This one narrows the
 * taxa listed for the selected region and nothing else.
 *
 * It lives in a store rather than component state because the facet counts are fetched by the
 * map layout while the control and the tree both sit inside the region panel, which arrives
 * through the route's children snippet — props cannot cross that boundary.
 */
export interface OccurrenceFacet {
	occurrence_status: OccurrenceStatusFilter;
	count: number;
}

export interface OccurrenceFilterState {
	/** Active filter, or null for every record. */
	status: OccurrenceStatusFilter | null;
	/** Taxa per status in the current scope — the counts shown beside each option. */
	facets: OccurrenceFacet[];
}

const EMPTY_STATE: OccurrenceFilterState = { status: null, facets: [] };

const store = writable<OccurrenceFilterState>(EMPTY_STATE);

export const occurrenceFilterStore: Readable<OccurrenceFilterState> = {
	subscribe: store.subscribe
};

/** Set the active filter. Called by whichever facet control the reader used. */
export function setOccurrenceStatus(status: OccurrenceStatusFilter | null): void {
	store.update((state) => ({ ...state, status }));
}

/** Replace the counts, e.g. after the selected region changed. */
export function setOccurrenceFacets(facets: OccurrenceFacet[]): void {
	store.update((state) => ({ ...state, facets }));
}

export function resetOccurrenceFilter(): void {
	store.set(EMPTY_STATE);
}

export function getOccurrenceFilterSnapshot(): OccurrenceFilterState {
	return get(store);
}
