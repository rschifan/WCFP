import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

/**
 * The hero quotes the checklist's headline figures, which now come from the server load rather than
 * from literals in the markup. Only the fields the hero reads are stubbed.
 */
const SUMMARY = {
	taxa: 26622,
	species: 26419,
	genera: 5009,
	families: 412
};

describe('/+page.svelte', () => {
	it('renders the landing page hero and entry points', async () => {
		render(Page, { data: { summary: SUMMARY } as never });

		const heading = page.getByRole('heading', {
			level: 1,
			name: 'World Checklist of Food Plants'
		});
		await expect.element(heading).toBeInTheDocument();
		await expect
			.element(page.getByText(/The WCFP 2026 is the most comprehensive global inventory/i))
			.toBeInTheDocument();
		await expect.element(page.getByText('Where would you like to start?')).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Start with Map' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Start with Taxonomy' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('26,622 taxa (26,419 species)')).toBeInTheDocument();
	});
});
