import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import { skeleton } from '@skeletonlabs/tw-plugin';

/**
 * Tailwind CSS configuration (Tailwind v4)
 *
 * We configure plugins here instead of using Tailwind v4's CSS `@plugin` directive
 * because `@skeletonlabs/tw-plugin` exports a *named* plugin factory (`skeleton`)
 * rather than a default export. Using `@plugin '@skeletonlabs/tw-plugin'` causes
 * Tailwind to attempt to execute a non-function module default, which manifests as
 * `TypeError: y is not a function`.
 */
const config: Config = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	plugins: [
		typography,
		skeleton({
			// Skeleton UI styles are imported via CSS (`@skeletonlabs/skeleton` + theme)
			// and component styles via `@skeletonlabs/skeleton-svelte`.
			base: false
		})
	]
};

export default config;
