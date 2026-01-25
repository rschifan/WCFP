import type { SpeciesDataProvider } from './SpeciesDataProvider';
import { JsonSpeciesProvider } from './providers/JsonSpeciesProvider';
import { ApiSpeciesProvider } from './providers/ApiSpeciesProvider';
import { config } from '../config';

/**
 * Factory function - creates the configured provider instance.
 * This is the single point where provider selection happens.
 *
 * To switch providers:
 * 1. Update config.ts: speciesProvider = 'api' (or 'json', 'duckdb')
 * 2. Restart dev server
 * 3. All components automatically use the new provider
 */
export function createSpeciesProvider(): SpeciesDataProvider {
	switch (config.speciesProvider) {
		case 'json':
			return new JsonSpeciesProvider();

		case 'api':
			return new ApiSpeciesProvider(config.apiUrl);

		case 'duckdb':
			// TODO: Implement DuckDBSpeciesProvider when needed
			throw new Error('DuckDB provider not yet implemented. Use "json" or "api" provider instead.');

		default:
			throw new Error(`Unknown provider type: ${config.speciesProvider}`);
	}
}
