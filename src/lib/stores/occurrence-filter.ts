import { get, writable, type Readable } from 'svelte/store';
import type { OccurrenceStatusFilter } from '$lib/types/taxonomy';

/**
 * The occurrence-status filter, shared by everything that answers to it.
 *
 * This is the single source of truth rather than component state because the selection has to
 * reach three places that cannot pass props to one another: the choropleth in the map layout,
 * the filter rail (which is the layout's own aside before a region is chosen, and the region
 * panel afterwards), and the taxonomy tree inside that panel. Holding it in one store is what
 * makes the map and the list incapable of disagreeing.
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
	/** True when the active measure is published for all occurrences and cannot be filtered. */
	disabled: boolean;
}

const EMPTY_STATE: OccurrenceFilterState = { status: null, facets: [], disabled: false };

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

/** Disable the filter and clear it — used when the measure cannot be filtered by status. */
export function setOccurrenceDisabled(disabled: boolean): void {
	store.update((state) => ({
		...state,
		disabled,
		status: disabled ? null : state.status
	}));
}

export function resetOccurrenceFilter(): void {
	store.set(EMPTY_STATE);
}

export function getOccurrenceFilterSnapshot(): OccurrenceFilterState {
	return get(store);
}
