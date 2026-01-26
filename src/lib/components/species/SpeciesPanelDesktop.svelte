<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Species, SpeciesFilters } from '$lib/types/species';
	import TaxonomyTree from './TaxonomyTree.svelte';
	import SearchFilterBar from './SearchFilterBar.svelte';
	import { formatCount } from '$lib/utils/format';
	import { X, CircleAlert, Inbox, ChevronLeft, ChevronRight, GripVertical } from 'lucide-svelte';

	interface Props {
		selectedRegion: string | null;
		species: Species[];
		allSpecies: Species[];
		filters: SpeciesFilters;
		onFilterChange: (filters: SpeciesFilters) => void;
		searchQuery: string;
		onSearchChange: (query: string) => void;
		loading: boolean;
		error: string | null;
		onClose?: () => void;
		onRetry?: () => void;
	}

	let { selectedRegion, species, allSpecies, filters, onFilterChange, searchQuery, onSearchChange, loading, error, onClose, onRetry }: Props = $props();

	let hasActiveFilters = $derived(
		filters.lifeforms.size > 0 || filters.uses.size > 0 || filters.cwr === true
	);

	const STORAGE_KEY = 'species-panel-width';
	const MIN_WIDTH = 300;
	const MAX_WIDTH = 800;
	const DEFAULT_WIDTH = 420;
	const COLLAPSED_WIDTH = 48;

	let panelWidth = $state(DEFAULT_WIDTH);
	let isCollapsed = $state(false);
	let isResizing = $state(false);

	let displayWidth = $derived(isCollapsed ? COLLAPSED_WIDTH : panelWidth);
	let truncatedRegion = $derived(
		selectedRegion && selectedRegion.length > 20
			? selectedRegion.slice(0, 20) + '...'
			: selectedRegion
	);

	onMount(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = parseInt(saved, 10);
			if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
				panelWidth = parsed;
			}
		}
	});

	$effect(() => {
		if (!isCollapsed) {
			localStorage.setItem(STORAGE_KEY, panelWidth.toString());
		}
	});

	$effect(() => {
		if (selectedRegion) {
			isCollapsed = false;
		}
	});

	function startResize(e: MouseEvent) {
		e.preventDefault();
		isResizing = true;

		const startX = e.clientX;
		const startWidth = panelWidth;

		function onMouseMove(e: MouseEvent) {
			panelWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + e.clientX - startX));
		}

		function onMouseUp() {
			isResizing = false;
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
	}
</script>

{#snippet loadingState()}
	<div class="flex h-64 items-center justify-center" transition:fade={{ duration: 200 }}>
		<div class="flex flex-col items-center gap-3">
			<div class="relative">
				<div class="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-sky-500"></div>
				<div class="absolute inset-0 h-10 w-10 animate-ping rounded-full border-3 border-sky-500 opacity-20"></div>
			</div>
			<p class="text-sm font-medium text-slate-600">Loading species data...</p>
		</div>
	</div>
{/snippet}

{#snippet errorState()}
	<div class="flex h-64 items-center justify-center px-6" transition:fade={{ duration: 200 }}>
		<div class="rounded-xl bg-red-50 p-6 text-center shadow-sm">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
				<CircleAlert class="h-6 w-6 text-red-500" />
			</div>
			<p class="mt-4 font-semibold text-red-800">Failed to load species</p>
			<p class="mt-2 text-sm text-red-600">{error}</p>
			{#if onRetry}
				<button
					type="button"
					onclick={onRetry}
					class="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
				>
					Try again
				</button>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet emptyState()}
	<div class="flex h-64 items-center justify-center px-6 text-center" transition:fade={{ duration: 200 }}>
		<div>
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
				<Inbox class="h-8 w-8 text-slate-400" strokeWidth={1.5} />
			</div>
			{#if hasActiveFilters}
				<p class="mt-4 font-semibold text-slate-700">No matching species</p>
				<p class="mt-2 text-sm text-slate-500">Try adjusting your filters</p>
				<button
					type="button"
					onclick={() => onFilterChange({ lifeforms: new Set(), cwr: null, uses: new Set() })}
					class="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
				>
					Clear filters
				</button>
			{:else}
				<p class="mt-4 font-semibold text-slate-700">No species data</p>
				<p class="mt-2 text-sm text-slate-500">No species found for this region</p>
			{/if}
		</div>
	</div>
{/snippet}

{#if selectedRegion}
	<div
		class="relative flex h-full shrink-0 border-r border-slate-200 bg-white"
		style:width="{displayWidth}px"
		transition:fly={{ x: -displayWidth, duration: 300, easing: cubicOut }}
	>
		{#if !isCollapsed}
			<button
				type="button"
				class="absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center bg-slate-100 hover:bg-sky-200"
				class:bg-sky-300={isResizing}
				onmousedown={startResize}
				aria-label="Resize panel"
			>
				<div
					class="flex h-12 w-full items-center justify-center rounded-l opacity-0 transition-opacity hover:opacity-100"
					class:opacity-100={isResizing}
				>
					<GripVertical class="h-4 w-4 text-slate-400" />
				</div>
			</button>
		{/if}

		<button
			type="button"
			onclick={toggleCollapse}
			class="absolute top-1/2 -right-3 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50"
			aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
		>
			{#if isCollapsed}
				<ChevronRight class="h-4 w-4 text-slate-600" />
			{:else}
				<ChevronLeft class="h-4 w-4 text-slate-600" />
			{/if}
		</button>

		{#if isCollapsed}
			<div class="flex h-full w-full flex-col items-center py-4">
				<button
					type="button"
					onclick={toggleCollapse}
					class="flex flex-col items-center gap-2 rounded-lg p-2 hover:bg-slate-100"
					aria-label="Expand panel"
				>
					<span class="text-[18px] font-normal text-slate-600 [writing-mode:vertical-lr] rotate-180">
						{truncatedRegion}
					</span>
				</button>
			</div>
		{:else}
			<div class="flex h-full w-full flex-col pr-2">
				<div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4">
					<div class="min-w-0 flex-1">
						<h2 class="truncate text-lg font-semibold text-slate-900">{selectedRegion}</h2>
						{#if !loading && !error}
							<p class="text-sm text-slate-600" transition:fade={{ duration: 150 }}>
								{#if species.length !== allSpecies.length}
									<span class="font-medium text-sky-600">{formatCount(species.length)}</span> of {formatCount(allSpecies.length)} species
								{:else}
									{formatCount(species.length)} species found
								{/if}
							</p>
						{/if}
					</div>

					{#if onClose}
						<button
							type="button"
							onclick={onClose}
							class="shrink-0 rounded-lg p-2 text-slate-400 transition-all duration-150 hover:rotate-90 hover:bg-slate-200 hover:text-slate-600"
							aria-label="Close panel"
						>
							<X class="h-5 w-5" />
						</button>
					{/if}
				</div>

				{#if !loading && !error && allSpecies.length > 0}
					<SearchFilterBar
						{filters}
						species={allSpecies}
						{onFilterChange}
						{searchQuery}
						{onSearchChange}
					/>
				{/if}

				<div class="flex-1 overflow-y-auto">
					{#if loading}
						{@render loadingState()}
					{:else if error}
						{@render errorState()}
					{:else if species.length === 0}
						{@render emptyState()}
					{:else}
						<TaxonomyTree {species} {searchQuery} />
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
