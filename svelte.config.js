import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// The application relies on SSR/API routes backed by DuckDB, so adapter-node is required.
		adapter: adapter(),
		paths: {
			base: process.env.BASE_PATH ?? ''
		},
		prerender: {
			handleHttpError: 'warn'
		}
	}
};

export default config;
