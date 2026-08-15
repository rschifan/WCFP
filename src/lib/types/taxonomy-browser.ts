import type { Readable } from 'svelte/store';
import type {
	TaxonomyBootstrapPayload,
	TaxonomyChildrenPayload,
	TaxonomyFilters,
	TaxonomyNodeNormalized,
	TaxonomyQueryPayload,
	TaxonomyTreeIndex
} from './taxonomy';
import type { SearchInputState, SearchStatus } from './search';

export interface TaxonomyBrowserQuery {
	q: string;
	filters: TaxonomyFilters;
}

export interface TaxonomyBrowserSource {
	/** Identity of the scope. A change means a different subject: reset everything. */
	key?: string;
	/** A narrowing of the same scope. A change reloads the tree but keeps the view in place. */
	scopeKey?: string;
	loadBootstrap: (signal?: AbortSignal) => Promise<TaxonomyBootstrapPayload>;
	loadChildren: (parentId: string, signal?: AbortSignal) => Promise<TaxonomyChildrenPayload>;
	query: (query: TaxonomyBrowserQuery, signal?: AbortSignal) => Promise<TaxonomyQueryPayload>;
}

export type TaxonomyBrowserBootstrapState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'success' }
	| { status: 'error'; message: string };

export interface TaxonomyBrowserSummary {
	totalSpeciesCount: number;
	visibleSpeciesCount: number;
	hasActiveQuery: boolean;
}

export interface TaxonomyBrowserControllerState {
	bootstrapState: Readable<TaxonomyBrowserBootstrapState>;
	browseData: Readable<TaxonomyTreeIndex | null>;
	queryData: Readable<TaxonomyTreeIndex | null>;
	activeData: Readable<TaxonomyTreeIndex | null>;
	availableLifeforms: Readable<string[]>;
	startFromId: Readable<string | undefined>;
	filters: Readable<TaxonomyFilters>;
	searchInput: SearchInputState;
	searchStatus: Readable<SearchStatus>;
	searchError: Readable<string | null>;
	hasActiveQuery: Readable<boolean>;
	hasNoResults: Readable<boolean>;
	activeExpandedIds: Readable<Set<string>>;
	activeLoadingNodeIds: Readable<Set<string>>;
	summary: Readable<TaxonomyBrowserSummary>;
	initialize: (source: TaxonomyBrowserSource) => Promise<void>;
	setFilters: (filters: TaxonomyFilters) => void;
	toggleExpanded: (node: TaxonomyNodeNormalized) => Promise<void>;
	destroy: () => void;
}

function sortFilterValues(filters: TaxonomyFilters) {
	return {
		lifeforms: [...filters.lifeforms].sort(),
		uses: [...filters.uses].sort()
	};
}

export function hasTaxonomyBrowserQuery(query: TaxonomyBrowserQuery): boolean {
	return (
		query.q.trim().length > 0 ||
		query.filters.geographicOnly ||
		query.filters.lifeforms.size > 0 ||
		query.filters.uses.size > 0 ||
		query.filters.occurrenceStatus !== null
	);
}

export function serializeTaxonomyBrowserQuery(query: TaxonomyBrowserQuery): string {
	const params = new URLSearchParams();
	const trimmedQuery = query.q.trim();

	if (trimmedQuery) {
		params.set('q', trimmedQuery);
	}

	if (query.filters.geographicOnly) {
		params.set('geographicOnly', 'true');
	}

	const { lifeforms, uses } = sortFilterValues(query.filters);

	for (const lifeform of lifeforms) {
		params.append('lifeform', lifeform);
	}

	for (const useKey of uses) {
		params.append('use', useKey);
	}

	if (query.filters.occurrenceStatus) {
		params.set('status', query.filters.occurrenceStatus);
	}

	return params.toString();
}
