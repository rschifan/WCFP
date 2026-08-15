import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('renders the landing page hero and entry points', async () => {
		render(Page);

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
	});
});
