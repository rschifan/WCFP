import type { Species } from '$lib/types/species';
import { config } from '$lib/services/config';
import { profileApiQuery } from '$lib/utils/api-profiler';

const speciesDetailCache = new Map<number, Species>();
const inFlightRequests = new Map<number, Promise<Species>>();

function normalizeSpeciesPayload(payload: unknown): Species {
	if (payload && typeof payload === 'object' && 'wcfpId' in payload) {
		return payload as Species;
	}

	if (
		payload &&
		typeof payload === 'object' &&
		'data' in payload &&
		payload.data &&
		typeof payload.data === 'object'
	) {
		return payload.data as Species;
	}

	throw new Error('Invalid species detail response');
}

export function primeSpeciesDetail(species: Species): Species {
	speciesDetailCache.set(species.wcfpId, species);
	return species;
}

export function getCachedSpeciesDetail(wcfpId: number): Species | undefined {
	return speciesDetailCache.get(wcfpId);
}

export async function fetchSpeciesDetail(wcfpId: number): Promise<Species> {
	const cached = speciesDetailCache.get(wcfpId);
	if (cached) {
		return cached;
	}

	const pending = inFlightRequests.get(wcfpId);
	if (pending) {
		return pending;
	}

	const url = `${config.apiUrl}/species/${wcfpId}`;
	const request = profileApiQuery(url, async () => {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to load species details (HTTP ${response.status})`);
		}

		const payload = await response.json();
		const species = normalizeSpeciesPayload(payload);
		speciesDetailCache.set(wcfpId, species);
		return species;
	}).finally(() => {
		inFlightRequests.delete(wcfpId);
	});

	inFlightRequests.set(wcfpId, request);
	return request;
}

export function clearSpeciesDetailCache(): void {
	speciesDetailCache.clear();
	inFlightRequests.clear();
}
