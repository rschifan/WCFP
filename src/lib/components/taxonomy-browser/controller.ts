import { derived, get, writable, type Readable } from 'svelte/store';
import {
	createEmptyTaxonomyFilters,
	type TaxonomyFilters,
	type TaxonomyNodeNormalized,
	type TaxonomyQueryPayload,
	type TaxonomyTreeIndex
} from '$lib/types/taxonomy';
import type {
	TaxonomyBrowserBootstrapState,
	TaxonomyBrowserControllerState,
	TaxonomyBrowserQuery,
	TaxonomyBrowserSource,
	TaxonomyBrowserSummary
} from '$lib/types/taxonomy-browser';
import {
	hasTaxonomyBrowserQuery,
	serializeTaxonomyBrowserQuery
} from '$lib/types/taxonomy-browser';
import { createAsyncSearchController, createSearchInputState } from '$lib/utils/search/controller';
import { buildTaxonomyTreeIndex, mergeTaxonomyChildren } from '$lib/utils/taxonomy/runtime-index';

const EMPTY_TREE: TaxonomyTreeIndex = { rootId: 'root', nodesById: new Map() };
const EMPTY_SET = new Set<string>();

function countSpeciesNodes(index: TaxonomyTreeIndex | null): number {
	if (!index) return 0;

	let count = 0;
	for (const node of index.nodesById.values()) {
		if (node.rank === 'species') {
			count += 1;
		}
	}

	return count;
}

function getStartNodeSpeciesCount(
	index: TaxonomyTreeIndex | null,
	startFromId: string | undefined
): number {
	if (!index || !startFromId) {
		return countSpeciesNodes(index);
	}

	return index.nodesById.get(startFromId)?.count ?? countSpeciesNodes(index);
}

function cloneSet(values: Set<string>): Set<string> {
	return new Set(values);
}

function applyExpandedIds(ids: string[]): Set<string> {
	return new Set(ids);
}

export function createTaxonomyBrowserController(
	options: { debounceMs?: number } = {}
): TaxonomyBrowserControllerState {
	const debounceMs = options.debounceMs ?? 250;
	const bootstrapStateStore = writable<TaxonomyBrowserBootstrapState>({ status: 'idle' });
	const browseDataStore = writable<TaxonomyTreeIndex | null>(null);
	const queryDataStore = writable<TaxonomyTreeIndex | null>(null);
	const availableLifeformsStore = writable<string[]>([]);
	const startFromIdStore = writable<string | undefined>(undefined);
	const filtersStore = writable<TaxonomyFilters>(createEmptyTaxonomyFilters());
	const browseExpandedIdsStore = writable<Set<string>>(new Set());
	const queryExpandedIdsStore = writable<Set<string>>(new Set());
	const loadingNodeIdsStore = writable<Set<string>>(new Set());
	const searchInput = createSearchInputState({ debounceMs });
	const searchController = createAsyncSearchController<TaxonomyQueryPayload>();

	let currentSource: TaxonomyBrowserSource | null = null;
	let currentVersion = 0;
	let bootstrapAbortController: AbortController | null = null;
	const childAbortControllers = new Map<string, AbortController>();

	function abortBootstrap() {
		bootstrapAbortController?.abort();
		bootstrapAbortController = null;
	}

	function abortChildren() {
		for (const controller of childAbortControllers.values()) {
			controller.abort();
		}
		childAbortControllers.clear();
	}

	function resetRuntime() {
		abortBootstrap();
		abortChildren();
		searchController.clear();
		searchInput.clear();
		browseDataStore.set(null);
		queryDataStore.set(null);
		availableLifeformsStore.set([]);
		startFromIdStore.set(undefined);
		filtersStore.set(createEmptyTaxonomyFilters());
		browseExpandedIdsStore.set(new Set());
		queryExpandedIdsStore.set(new Set());
		loadingNodeIdsStore.set(new Set());
	}

	function applyBootstrapPayload(payload: {
		rootId: string;
		startFromId: string;
		expandedIds: string[];
		availableLifeforms: string[];
		nodes: TaxonomyNodeNormalized[];
	}) {
		browseDataStore.set(buildTaxonomyTreeIndex(payload.rootId, payload.nodes));
		availableLifeformsStore.set(payload.availableLifeforms);
		startFromIdStore.set(payload.startFromId);
		browseExpandedIdsStore.set(applyExpandedIds(payload.expandedIds));
	}

	function applyQueryPayload(payload: TaxonomyQueryPayload) {
		queryDataStore.set(buildTaxonomyTreeIndex(payload.rootId, payload.nodes));
		queryExpandedIdsStore.set(applyExpandedIds(payload.expandedIds));
		startFromIdStore.set(payload.startFromId);
	}

	async function initialize(source: TaxonomyBrowserSource) {
		// Same subject, narrower scope (e.g. an occurrence status): reload the tree underneath the
		// user rather than blanking the panel — search text, filters and scroll position stay put.
		const narrowing =
			currentSource?.key !== undefined &&
			currentSource.key === source.key &&
			currentSource.scopeKey !== source.scopeKey;

		currentVersion += 1;
		const version = currentVersion;
		currentSource = source;

		if (narrowing) {
			abortBootstrap();
			abortChildren();
		} else {
			resetRuntime();
			bootstrapStateStore.set({ status: 'loading' });
		}

		const controller = new AbortController();
		bootstrapAbortController = controller;

		try {
			const payload = await source.loadBootstrap(controller.signal);
			if (controller.signal.aborted || version !== currentVersion) {
				return;
			}

			applyBootstrapPayload(payload);
			bootstrapStateStore.set({ status: 'success' });
		} catch (error) {
			if (controller.signal.aborted || version !== currentVersion) {
				return;
			}

			const message = error instanceof Error ? error.message : String(error);
			bootstrapStateStore.set({ status: 'error', message: `Failed to load taxonomy: ${message}` });
		} finally {
			if (bootstrapAbortController === controller) {
				bootstrapAbortController = null;
			}
		}
	}

	const queryRequestStore = derived(
		[browseDataStore, searchInput.debouncedQuery, filtersStore],
		([$browseData, $debouncedQuery, $filters]): { requestKey: string; query: TaxonomyBrowserQuery } | null => {
			if (!$browseData || !currentSource) {
				return null;
			}

			const query: TaxonomyBrowserQuery = {
				q: $debouncedQuery,
				filters: $filters
			};

			if (!hasTaxonomyBrowserQuery(query)) {
				return null;
			}

			return {
				requestKey: `${currentSource.scopeKey ?? ''}|${serializeTaxonomyBrowserQuery(query)}`,
				query
			};
		}
	);

	const unsubscribeQueryRequest = queryRequestStore.subscribe((request) => {
		if (!request || !currentSource) {
			searchController.clear();
			queryDataStore.set(null);
			queryExpandedIdsStore.set(new Set());
			return;
		}

		void searchController.execute(request.requestKey, (signal) =>
			currentSource!.query(request.query, signal)
		);
	});

	const unsubscribeSearchResult = searchController.result.subscribe((payload) => {
		if (!payload) {
			return;
		}

		applyQueryPayload(payload);
	});

	const unsubscribeSearchStatus = searchController.status.subscribe((status) => {
		if (status !== 'error') {
			return;
		}

		queryDataStore.set(null);
		queryExpandedIdsStore.set(new Set());
	});

	async function loadChildren(node: TaxonomyNodeNormalized) {
		if (!currentSource) {
			return;
		}

		const browseData = get(browseDataStore);
		const loadingNodeIds = get(loadingNodeIdsStore);

		if (!browseData || loadingNodeIds.has(node.id) || childAbortControllers.has(node.id)) {
			return;
		}

		const controller = new AbortController();
		childAbortControllers.set(node.id, controller);
		loadingNodeIdsStore.set(new Set([...loadingNodeIds, node.id]));

		try {
			const payload = await currentSource.loadChildren(node.id, controller.signal);
			if (controller.signal.aborted) {
				return;
			}

			const currentBrowseData = get(browseDataStore);
			if (!currentBrowseData) {
				return;
			}

			browseDataStore.set(mergeTaxonomyChildren(currentBrowseData, node.id, payload.nodes));
		} finally {
			childAbortControllers.delete(node.id);
			const nextLoadingNodeIds = cloneSet(get(loadingNodeIdsStore));
			nextLoadingNodeIds.delete(node.id);
			loadingNodeIdsStore.set(nextLoadingNodeIds);
		}
	}

	async function toggleExpanded(node: TaxonomyNodeNormalized) {
		if (get(hasActiveQueryStore)) {
			const next = cloneSet(get(queryExpandedIdsStore));
			if (next.has(node.id)) {
				next.delete(node.id);
			} else {
				next.add(node.id);
			}
			queryExpandedIdsStore.set(next);
			return;
		}

		const next = cloneSet(get(browseExpandedIdsStore));
		if (next.has(node.id)) {
			next.delete(node.id);
			browseExpandedIdsStore.set(next);
			return;
		}

		if (node.childCount > 0 && !node.childrenLoaded) {
			await loadChildren(node);
		}

		const updated = cloneSet(get(browseExpandedIdsStore));
		updated.add(node.id);
		browseExpandedIdsStore.set(updated);
	}

	function setFilters(filters: TaxonomyFilters) {
		filtersStore.set(filters);
	}

	const hasActiveQueryStore = derived(
		[searchInput.debouncedQuery, filtersStore],
		([$debouncedQuery, $filters]) =>
			$debouncedQuery.trim().length > 0 ||
			$filters.geographicOnly ||
			$filters.lifeforms.size > 0 ||
			$filters.uses.size > 0 ||
			$filters.occurrenceStatus !== null
	);

	const activeDataStore = derived(
		[hasActiveQueryStore, queryDataStore, browseDataStore],
		([$hasActiveQuery, $queryData, $browseData]) =>
			$hasActiveQuery ? ($queryData ?? EMPTY_TREE) : ($browseData ?? EMPTY_TREE)
	);

	const activeExpandedIdsStore = derived(
		[hasActiveQueryStore, queryExpandedIdsStore, browseExpandedIdsStore],
		([$hasActiveQuery, $queryExpandedIds, $browseExpandedIds]) =>
			$hasActiveQuery ? $queryExpandedIds : $browseExpandedIds
	);

	const activeLoadingNodeIdsStore = derived(
		[hasActiveQueryStore, loadingNodeIdsStore],
		([$hasActiveQuery, $loadingNodeIds]) => ($hasActiveQuery ? EMPTY_SET : $loadingNodeIds)
	);

	const hasNoResultsStore = derived(
		[hasActiveQueryStore, searchController.status, queryDataStore],
		([$hasActiveQuery, $searchStatus, $queryData]) =>
			$hasActiveQuery && $searchStatus === 'success' && ($queryData?.nodesById.size ?? 0) === 0
	);

	const summaryStore = derived(
		[browseDataStore, queryDataStore, startFromIdStore, hasActiveQueryStore],
		([$browseData, $queryData, $startFromId, $hasActiveQuery]): TaxonomyBrowserSummary => {
			const totalSpeciesCount = getStartNodeSpeciesCount($browseData, $startFromId);

			return {
				totalSpeciesCount,
				visibleSpeciesCount: $hasActiveQuery ? countSpeciesNodes($queryData) : totalSpeciesCount,
				hasActiveQuery: $hasActiveQuery
			};
		}
	);

	function destroy() {
		currentVersion += 1;
		currentSource = null;
		resetRuntime();
		searchController.destroy();
		searchInput.destroy();
		unsubscribeQueryRequest();
		unsubscribeSearchResult();
		unsubscribeSearchStatus();
		bootstrapStateStore.set({ status: 'idle' });
	}

	return {
		bootstrapState: { subscribe: bootstrapStateStore.subscribe },
		browseData: { subscribe: browseDataStore.subscribe },
		queryData: { subscribe: queryDataStore.subscribe },
		activeData: activeDataStore as Readable<TaxonomyTreeIndex | null>,
		availableLifeforms: { subscribe: availableLifeformsStore.subscribe },
		startFromId: { subscribe: startFromIdStore.subscribe },
		filters: { subscribe: filtersStore.subscribe },
		searchInput,
		searchStatus: searchController.status,
		searchError: searchController.error,
		hasActiveQuery: hasActiveQueryStore as Readable<boolean>,
		hasNoResults: hasNoResultsStore as Readable<boolean>,
		activeExpandedIds: activeExpandedIdsStore as Readable<Set<string>>,
		activeLoadingNodeIds: activeLoadingNodeIdsStore as Readable<Set<string>>,
		summary: summaryStore as Readable<TaxonomyBrowserSummary>,
		initialize,
		setFilters,
		toggleExpanded,
		destroy
	};
}
