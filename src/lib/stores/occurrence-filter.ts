import { get, writable, type Readable } from 'svelte/store';

/**
 * The occurrence-status filter applied to the map choropleth.
 *
 * Shared as a store because the control lives in the map layout while the region panel is
 * rendered through the route's children snippet, so props cannot reach it. Without this the
 * panel would report the all-status total while the map was coloured by native counts — the
 * same region reading 2,074 in one place and 1,542 in the other.
 */
export type OccurrenceStatusFilterValue = 'all' | 'native' | 'introduced';

export interface OccurrenceFilterState {
	status: OccurrenceStatusFilterValue;
	/** TDWG3 code -> taxon count under the active status. Empty when status is 'all'. */
	counts: Map<string, number>;
}

const EMPTY_STATE: OccurrenceFilterState = { status: 'all', counts: new Map() };

const store = writable<OccurrenceFilterState>(EMPTY_STATE);

export const occurrenceFilterStore: Readable<OccurrenceFilterState> = {
	subscribe: store.subscribe
};

export function setOccurrenceFilter(state: OccurrenceFilterState): void {
	store.set(state);
}

export function resetOccurrenceFilter(): void {
	store.set(EMPTY_STATE);
}

export function getOccurrenceFilterSnapshot(): OccurrenceFilterState {
	return get(store);
}
