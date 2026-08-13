import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAsyncSearchController, createSearchInputState } from './controller';

describe('search controller helpers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('debounces query updates and clears immediately', () => {
		expect.assertions(6);

		const searchState = createSearchInputState({ debounceMs: 100 });

		searchState.setQuery('cy');
		expect(get(searchState.query)).toBe('cy');
		expect(get(searchState.debouncedQuery)).toBe('');

		vi.advanceTimersByTime(50);
		searchState.setQuery('cycas');
		vi.advanceTimersByTime(99);
		expect(get(searchState.debouncedQuery)).toBe('');

		vi.advanceTimersByTime(1);
		expect(get(searchState.debouncedQuery)).toBe('cycas');
		expect(get(searchState.isActive)).toBe(true);

		searchState.clear();
		expect(get(searchState.debouncedQuery)).toBe('');

		searchState.destroy();
	});

	it('aborts previous async requests and ignores stale results', async () => {
		expect.assertions(4);

		const searchController = createAsyncSearchController<string>();
		let resolveFirst!: (value: string) => void;
		let abortCount = 0;

		void searchController.execute(
			'first',
			(signal) =>
				new Promise<string>((resolve) => {
					resolveFirst = resolve;
					signal.addEventListener('abort', () => {
						abortCount += 1;
					});
				})
		);

		await Promise.resolve();
		await searchController.execute('second', async () => 'second result');

		expect(abortCount).toBe(1);
		expect(get(searchController.result)).toBe('second result');

		resolveFirst('stale result');
		await Promise.resolve();

		expect(get(searchController.result)).toBe('second result');
		expect(get(searchController.status)).toBe('success');

		searchController.destroy();
	});

	it('clears async search status and error state', async () => {
		expect.assertions(4);

		const searchController = createAsyncSearchController<string>();

		await searchController.execute('broken', async () => {
			throw new Error('Search failed');
		});

		expect(get(searchController.status)).toBe('error');
		expect(get(searchController.error)).toBe('Search failed');

		searchController.clear();

		expect(get(searchController.status)).toBe('idle');
		expect(get(searchController.error)).toBeNull();

		searchController.destroy();
	});

	it('deduplicates identical request keys until the search is cleared', async () => {
		expect.assertions(3);

		const searchController = createAsyncSearchController<string>();
		const executor = vi.fn(async () => 'cycas');

		await searchController.execute('cycas|annual', executor);
		await searchController.execute('cycas|annual', executor);

		expect(executor).toHaveBeenCalledTimes(1);
		expect(get(searchController.result)).toBe('cycas');

		searchController.clear();
		await searchController.execute('cycas|annual', executor);
		expect(executor).toHaveBeenCalledTimes(2);

		searchController.destroy();
	});
});
