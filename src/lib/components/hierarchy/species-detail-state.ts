import { writable, type Readable } from 'svelte/store';
import { fetchSpeciesDetail, primeSpeciesDetail } from '$lib/services/species/detail-cache';
import type { Species } from '$lib/types/species';

export interface SpeciesDetailState {
	species: Species | null;
	returnFocusTo: HTMLElement | null;
}

export interface SpeciesDetailController extends Readable<SpeciesDetailState> {
	openFromSpecies: (species: Species, trigger?: HTMLElement | null) => void;
	openById: (wcfpId: number, trigger?: HTMLElement | null) => Promise<void>;
	close: () => void;
}

export function createClosedSpeciesDetailState(): SpeciesDetailState {
	return {
		species: null,
		returnFocusTo: null
	};
}

export function openSpeciesDetailFromSpecies(
	species: Species,
	trigger?: HTMLElement | null
): SpeciesDetailState {
	return {
		species: primeSpeciesDetail(species),
		returnFocusTo: trigger ?? null
	};
}

export async function openSpeciesDetailById(
	wcfpId: number,
	trigger?: HTMLElement | null
): Promise<SpeciesDetailState> {
	return {
		species: await fetchSpeciesDetail(wcfpId),
		returnFocusTo: trigger ?? null
	};
}

export function createSpeciesDetailController(): SpeciesDetailController {
	const store = writable<SpeciesDetailState>(createClosedSpeciesDetailState());

	return {
		subscribe: store.subscribe,
		openFromSpecies(species, trigger) {
			store.set(openSpeciesDetailFromSpecies(species, trigger));
		},
		async openById(wcfpId, trigger) {
			store.set(await openSpeciesDetailById(wcfpId, trigger));
		},
		close() {
			store.set(createClosedSpeciesDetailState());
		}
	};
}
