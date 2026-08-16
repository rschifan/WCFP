import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ReferenceList from './ReferenceList.svelte';

const FREE_TEXT = [
	{ label: 'AAK, 1980, Bertanam Pohon Buah-buahan. Jogyakarta. p 44' },
	{ label: 'Kew, 2020. See doi:10.5063/F1CV4G34' }
];

describe('ReferenceList', () => {
	it('detects links inside free-text citations', async () => {
		expect.assertions(2);

		render(ReferenceList, { references: FREE_TEXT });

		const link = page.getByRole('link', { name: 'doi:10.5063/F1CV4G34' });
		await expect.element(link).toHaveAttribute('href', 'https://doi.org/10.5063/F1CV4G34');
		await expect.element(link).toHaveAttribute('rel', 'external noopener noreferrer');
	});

	it('links the whole label when the caller supplies the destination', async () => {
		expect.assertions(1);

		render(ReferenceList, {
			references: [
				{ label: 'World Checklist of Useful Plant Species', href: 'https://doi.org/10.5063/x' }
			]
		});

		await expect
			.element(page.getByRole('link', { name: 'World Checklist of Useful Plant Species' }))
			.toHaveAttribute('href', 'https://doi.org/10.5063/x');
	});

	it('folds a list past the collapse threshold', async () => {
		expect.assertions(1);

		const many = Array.from({ length: 12 }, (_, i) => ({ label: `Reference ${i + 1}` }));
		render(ReferenceList, { references: many, collapseAbove: 8, idPrefix: 'folded' });

		await expect.element(page.getByText('Show all')).toBeInTheDocument();
	});

	it('never hides a curated set, because the About page sets no threshold', async () => {
		expect.assertions(2);

		render(ReferenceList, { references: FREE_TEXT, idPrefix: 'open' });

		await expect.element(page.getByText('Show all')).not.toBeInTheDocument();
		await expect.element(page.getByText('References')).toBeInTheDocument();
	});

	it('renders nothing when empty unless the caller asks for a message', async () => {
		expect.assertions(2);

		render(ReferenceList, { references: [], idPrefix: 'silent' });
		await expect.element(page.getByText('References')).not.toBeInTheDocument();

		render(ReferenceList, { references: [], emptyMessage: 'None recorded', idPrefix: 'stated' });
		await expect.element(page.getByText('None recorded')).toBeInTheDocument();
	});
});
