import { derived, writable, type Readable } from 'svelte/store';
import type { AsyncSearchState, SearchInputState, SearchStatus } from '$lib/types/search';

interface SearchInputOptions {
	initialQuery?: string;
	debounceMs?: number;
}

export function createSearchInputState(options: SearchInputOptions = {}): SearchInputState {
	const { initialQuery = '', debounceMs = 250 } = options;

	const queryStore = writable(initialQuery);
	const debouncedQueryStore = writable(initialQuery);
	const isActive = derived(queryStore, ($query) => $query.trim().length > 0);

	let debounceHandle: ReturnType<typeof setTimeout> | null = null;

	function clearDebounce() {
		if (debounceHandle !== null) {
			clearTimeout(debounceHandle);
			debounceHandle = null;
		}
	}

	function scheduleDebounce(nextQuery: string) {
		if (debounceMs <= 0) {
			debouncedQueryStore.set(nextQuery);
			return;
		}

		clearDebounce();
		debounceHandle = setTimeout(() => {
			debouncedQueryStore.set(nextQuery);
			debounceHandle = null;
		}, debounceMs);
	}

	function setQuery(nextQuery: string) {
		queryStore.set(nextQuery);
		scheduleDebounce(nextQuery);
	}

	function clear() {
		clearDebounce();
		queryStore.set('');
		debouncedQueryStore.set('');
	}

	function destroy() {
		clearDebounce();
	}

	return {
		query: { subscribe: queryStore.subscribe },
		debouncedQuery: { subscribe: debouncedQueryStore.subscribe },
		isActive,
		setQuery,
		clear,
		destroy
	};
}

export function createAsyncSearchController<Result>(): AsyncSearchState<Result> {
	const statusStore = writable<SearchStatus>('idle');
	const errorStore = writable<string | null>(null);
	const resultStore = writable<Result | null>(null);
	const loadingStore = derived(statusStore, ($status) => $status === 'loading');

	let currentAbortController: AbortController | null = null;
	let currentRequestId = 0;
	let currentRequestKey: string | null = null;
	let lastCompletedRequestKey: string | null = null;

	function clear() {
		currentAbortController?.abort();
		currentAbortController = null;
		currentRequestId += 1;
		currentRequestKey = null;
		lastCompletedRequestKey = null;
		statusStore.set('idle');
		errorStore.set(null);
		resultStore.set(null);
	}

	async function execute(
		requestKey: string,
		executor: (signal: AbortSignal) => Promise<Result>
	): Promise<void> {
		if (!requestKey) {
			clear();
			return;
		}

		if (requestKey === currentRequestKey || requestKey === lastCompletedRequestKey) {
			return;
		}

		currentAbortController?.abort();

		const controller = new AbortController();
		const requestId = ++currentRequestId;
		currentAbortController = controller;
		currentRequestKey = requestKey;

		statusStore.set('loading');
		errorStore.set(null);

		try {
			const result = await executor(controller.signal);
			if (controller.signal.aborted || requestId !== currentRequestId) {
				return;
			}

			resultStore.set(result);
			statusStore.set('success');
			lastCompletedRequestKey = requestKey;
		} catch (error) {
			if (controller.signal.aborted || requestId !== currentRequestId) {
				return;
			}

			errorStore.set(error instanceof Error ? error.message : String(error));
			statusStore.set('error');
			resultStore.set(null);
			lastCompletedRequestKey = requestKey;
		} finally {
			if (currentAbortController === controller) {
				currentAbortController = null;
			}

			if (currentRequestKey === requestKey) {
				currentRequestKey = null;
			}
		}
	}

	function destroy() {
		currentAbortController?.abort();
		currentAbortController = null;
		currentRequestKey = null;
		lastCompletedRequestKey = null;
	}

	return {
		status: { subscribe: statusStore.subscribe },
		loading: loadingStore as Readable<boolean>,
		error: { subscribe: errorStore.subscribe },
		result: { subscribe: resultStore.subscribe },
		execute,
		clear,
		destroy
	};
}
