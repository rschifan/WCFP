export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface SearchInputState {
	query: import('svelte/store').Readable<string>;
	debouncedQuery: import('svelte/store').Readable<string>;
	isActive: import('svelte/store').Readable<boolean>;
	setQuery: (query: string) => void;
	clear: () => void;
	destroy: () => void;
}

export interface AsyncSearchState<Result> {
	status: import('svelte/store').Readable<SearchStatus>;
	loading: import('svelte/store').Readable<boolean>;
	error: import('svelte/store').Readable<string | null>;
	result: import('svelte/store').Readable<Result | null>;
	execute: (
		requestKey: string,
		executor: (signal: AbortSignal) => Promise<Result>
	) => Promise<void>;
	clear: () => void;
	destroy: () => void;
}
