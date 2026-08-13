import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SpeciesDetailPanelTestHost from './SpeciesDetailPanelTestHost.svelte';

describe('SpeciesDetailPanel', () => {
	afterEach(() => {
		document.body.style.overflow = '';
		document.body.style.paddingRight = '';
	});

	it('renders as a full-screen dialog and locks body scroll while open', async () => {
		expect.assertions(4);

		render(SpeciesDetailPanelTestHost);

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Hydrodictyon reticulatum (L.) Bory' }))
			.toBeInTheDocument();
		expect(document.body.style.overflow).toBe('hidden');
		await expect.element(page.getByText('Human Food')).toBeInTheDocument();
	});

	it('closes from the close button and restores focus to the opener', async () => {
		expect.assertions(3);

		render(SpeciesDetailPanelTestHost);

		const opener = page.getByRole('button', { name: 'Open details' });
		await page.getByRole('button', { name: 'Close panel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(opener).toHaveFocus();
		expect(document.body.style.overflow).toBe('');
	});

	it('closes from backdrop click and Escape', async () => {
		expect.assertions(4);

		render(SpeciesDetailPanelTestHost);

		await page.getByRole('button', { name: 'Close overlay' }).click();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Open details' }).click();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Open details' })).toHaveFocus();
	});
});
