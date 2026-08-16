<script lang="ts">
	import { fromStore } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import TaxonomySearchFilterBar from '$lib/components/map/TaxonomySearchFilterBar.svelte';
	import TaxonomyList from '$lib/components/visualization/TaxonomyList.svelte';
	import type { HierarchyEntryBadge } from '$lib/types/hierarchy';
	import type { TaxonomyBrowserSource, TaxonomyBrowserSummary } from '$lib/types/taxonomy-browser';
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
	import { createTaxonomyBrowserController } from './controller';

	interface Props {
		/** False inside a region, where the geographic filter is a no-op. */
		showGeographicFilter?: boolean;
		source: TaxonomyBrowserSource;
		selectedNodeId?: string;
		searchPlaceholder?: string;
		showStartNode?: boolean;
		emptyMessage?: string;
		class?: string;
		onNodeSelect?: (node: TaxonomyNodeNormalized, path: string) => void;
		onSummaryChange?: (summary: TaxonomyBrowserSummary) => void;
		isNodeClickable?: (node: TaxonomyNodeNormalized) => boolean;
		getNodeBadges?: (node: TaxonomyNodeNormalized) => readonly HierarchyEntryBadge[] | undefined;
	}

	let {
		showGeographicFilter = true,
		source,
		selectedNodeId,
		searchPlaceholder = 'Search',
		showStartNode = true,
		emptyMessage = 'No matching taxonomy nodes found.',
		class: className = '',
		onNodeSelect,
		onSummaryChange,
		isNodeClickable,
		getNodeBadges
	}: Props = $props();

	const controller = createTaxonomyBrowserController();

	// Defer showing the loading UI so fast loads don't flash a spinner.
	let showLoadingUi = $state(false);

	const bootstrapStateStore = fromStore(controller.bootstrapState);
	const activeDataStore = fromStore(controller.activeData);
	const availableLifeformsStore = fromStore(controller.availableLifeforms);
	const startFromIdStore = fromStore(controller.startFromId);
	const filtersStore = fromStore(controller.filters);
	const searchQueryStore = fromStore(controller.searchInput.query);
	const searchStatusStore = fromStore(controller.searchStatus);
	const searchErrorStore = fromStore(controller.searchError);
	const activeExpandedIdsStore = fromStore(controller.activeExpandedIds);
	const activeLoadingNodeIdsStore = fromStore(controller.activeLoadingNodeIds);
	const hasNoResultsStore = fromStore(controller.hasNoResults);
	const summaryStore = fromStore(controller.summary);

	const bootstrapState = $derived(bootstrapStateStore.current);
	const activeData = $derived(activeDataStore.current);
	const availableLifeforms = $derived(availableLifeformsStore.current);
	const startFromId = $derived(startFromIdStore.current);
	const filters = $derived(filtersStore.current);
	const searchQuery = $derived(searchQueryStore.current);
	const searchStatus = $derived(searchStatusStore.current);
	const searchError = $derived(searchErrorStore.current);
	const activeExpandedIds = $derived(activeExpandedIdsStore.current);
	const activeLoadingNodeIds = $derived(activeLoadingNodeIdsStore.current);
	const hasNoResults = $derived(hasNoResultsStore.current);
	const summary = $derived(summaryStore.current);

	$effect(() => {
		void controller.initialize(source);
	});

	$effect(() => {
		onSummaryChange?.(summary);
	});

	$effect(() => {
		return () => controller.destroy();
	});

	$effect(() => {
		const isLoading = bootstrapState.status === 'loading' || bootstrapState.status === 'idle';
		if (!isLoading) {
			showLoadingUi = false;
			return;
		}
		showLoadingUi = false;
		const timer = setTimeout(() => {
			showLoadingUi = true;
		}, 180);
		return () => clearTimeout(timer);
	});
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white {className}">
	<!-- Outside the loading branch on purpose: picking a filter reloads the tree, and unmounting
	     the bar with it would throw away its expanded/collapsed state mid-interaction. -->
	{#if bootstrapState.status !== 'error'}
		<TaxonomySearchFilterBar
			{searchPlaceholder}
			{searchQuery}
			onSearchChange={controller.searchInput.setQuery}
			onClearSearch={controller.searchInput.clear}
			{searchStatus}
			{searchError}
			{filters}
			{availableLifeforms}
			{showGeographicFilter}
			onFilterChange={controller.setFilters}
		/>
	{/if}

	{#if bootstrapState.status === 'loading' || bootstrapState.status === 'idle'}
		<div class="relative flex-1 bg-white">
			<div class="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-slate-100">
				<div class="app-progress-stripe h-full w-1/3 bg-slate-400/60"></div>
			</div>
			{#if showLoadingUi}
				<div
					class="flex h-full items-center justify-center text-sm text-slate-500"
					transition:fade={{ duration: 120 }}
				>
					<span class="flex items-center gap-2">
						<span
							class="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500"
						></span>
						Loading…
					</span>
				</div>
			{/if}
		</div>
	{:else if bootstrapState.status === 'error'}
		<div class="flex flex-1 items-center justify-center bg-white p-6">
			<div
				class="max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900 shadow-sm"
			>
				<p class="font-semibold">Unable to load taxonomy</p>
				<p class="mt-2 text-sm">{bootstrapState.message}</p>
			</div>
		</div>
	{:else if activeData && startFromId}
		{#if hasNoResults}
			<div class="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
				{emptyMessage}
			</div>
		{:else}
			<div class="min-h-0 flex-1 overflow-hidden">
				<TaxonomyList
					data={activeData}
					{startFromId}
					{showStartNode}
					expandedIds={activeExpandedIds}
					loadingNodeIds={activeLoadingNodeIds}
					onToggleExpanded={controller.toggleExpanded}
					{onNodeSelect}
					{isNodeClickable}
					{selectedNodeId}
					{getNodeBadges}
					highlightQuery={searchQuery}
				/>
			</div>
		{/if}
	{/if}
</div>

<style>
	.app-progress-stripe {
		animation: progress-stripe 1.2s ease-in-out infinite;
	}
	@keyframes progress-stripe {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(200%);
		}
		100% {
			transform: translateX(400%);
		}
	}
</style>
