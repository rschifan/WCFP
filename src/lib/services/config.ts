/**
 * Application configuration
 * Change speciesProvider to switch data source implementation
 */

export type ProviderType = 'json' | 'api' | 'duckdb';

/**
 * Application configuration with environment variables and fallbacks
 */
export const config = {
	// 🔧 CHANGE THIS LINE TO SWITCH PROVIDERS
	// 'json' = Static JSON files (current)
	// 'api' = Backend REST API (future)
	// 'duckdb' = Client-side DuckDB-WASM (future)
	speciesProvider: (import.meta.env.VITE_SPECIES_PROVIDER || 'json') as ProviderType,

	// API configuration (used when speciesProvider = 'api')
	apiUrl: import.meta.env.VITE_API_URL || '/api/species'
} as const;
