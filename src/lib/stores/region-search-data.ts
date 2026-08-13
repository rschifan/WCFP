import { writable, type Readable } from 'svelte/store';
import { base } from '$app/paths';

export interface RegionCountryEntry {
	iso: string;
	name: string;
	regions: string[];
}

export interface RegionCountriesPayload {
	version: number;
	regionCountries: Record<string, string[]>;
	countries: RegionCountryEntry[];
}

export interface RegionSearchDataState {
	status: 'idle' | 'loading' | 'ready' | 'error';
	data: RegionCountriesPayload | null;
	error: string | null;
}

const EMPTY_STATE: RegionSearchDataState = { status: 'idle', data: null, error: null };

const store = writable<RegionSearchDataState>(EMPTY_STATE);
let inflight: Promise<void> | null = null;

export const regionSearchDataStore: Readable<RegionSearchDataState> = {
	subscribe: store.subscribe
};

export function loadRegionSearchData(): Promise<void> {
	if (inflight) return inflight;

	let resolvedState: RegionSearchDataState = EMPTY_STATE;
	store.subscribe((s) => (resolvedState = s))();
	if (resolvedState.status === 'ready') return Promise.resolve();

	store.set({ status: 'loading', data: null, error: null });

	inflight = fetch(`${base}/data/region-countries.json`)
		.then(async (response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = (await response.json()) as RegionCountriesPayload;
			store.set({ status: 'ready', data, error: null });
		})
		.catch((err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			store.set({ status: 'error', data: null, error: message });
		})
		.finally(() => {
			inflight = null;
		});

	return inflight;
}
