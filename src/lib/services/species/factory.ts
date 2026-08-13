import type { SpeciesDataProvider } from './SpeciesDataProvider';
import { ApiSpeciesProvider } from './providers/ApiSpeciesProvider';
import { config } from '../config';

/**
 * Factory function - creates the API-backed provider instance.
 */
export function createSpeciesProvider(): SpeciesDataProvider {
	return new ApiSpeciesProvider(config.apiUrl);
}
