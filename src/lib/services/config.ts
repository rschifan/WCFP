/**
 * Application configuration
 */

import { base } from '$app/paths';

/**
 * Application configuration with environment variables and fallbacks
 */
export const config = {
	// API configuration
	apiUrl: import.meta.env.VITE_API_URL || `${base}/api/v1`
} as const;
