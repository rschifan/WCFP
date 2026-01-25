import { getContext, setContext } from 'svelte';
import type { SpeciesDataProvider } from './SpeciesDataProvider';

/**
 * Context key for species provider (Symbol ensures uniqueness)
 */
const SPECIES_PROVIDER_KEY = Symbol('speciesProvider');

/**
 * Set the species provider in Svelte context.
 * Call this in a parent component (e.g., +page.svelte).
 *
 * @param provider - The provider instance to inject
 */
export function setSpeciesProvider(provider: SpeciesDataProvider): void {
	setContext(SPECIES_PROVIDER_KEY, provider);
}

/**
 * Get the species provider from Svelte context.
 * Call this in child components that need species data.
 *
 * @returns The provider instance
 * @throws {Error} If provider not found in context
 */
export function getSpeciesProvider(): SpeciesDataProvider {
	const provider = getContext<SpeciesDataProvider>(SPECIES_PROVIDER_KEY);

	if (!provider) {
		throw new Error(
			'SpeciesDataProvider not found in context. ' +
				'Did you call setSpeciesProvider() in a parent component?'
		);
	}

	return provider;
}
