<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Search, Filter, X, ChevronDown, LoaderCircle, CircleAlert } from 'lucide-svelte';
	import type { FilterBarModel } from '$lib/types/filters';
	import ActiveFilterChips from './ActiveFilterChips.svelte';
	import FilterSection from './FilterSection.svelte';

	interface Props {
		model: FilterBarModel;
	}

	let { model }: Props = $props();

	let filtersExpanded = $state(false);
	const clearSearch = $derived(model.onClearSearch ?? (() => model.onSearchChange('')));
</script>

<div class="flex min-h-0 flex-col overflow-hidden">
	<!-- Search and the filter toggle share one row: as two stacked bands they cost 106px of a
	     667px panel before a single taxon is listed. -->
	<div class="flex items-center gap-2 px-3 py-2">
		<div class="relative min-w-0 flex-1">
			<Search class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				value={model.searchQuery}
				oninput={(event) => model.onSearchChange(event.currentTarget.value)}
				placeholder={model.searchPlaceholder}
				class="app-input-accent w-full rounded-sm border border-slate-200 bg-slate-50 py-1.5 pr-8 pl-8 text-sm text-black placeholder:text-slate-400"
			/>
			<div class="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
				{#if model.searchStatus === 'loading'}
					<span class="text-slate-400" aria-label="Searching">
						<LoaderCircle class="h-4 w-4 animate-spin" />
					</span>
				{/if}
				{#if model.searchQuery}
					<button
						type="button"
						onclick={clearSearch}
						class="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						aria-label="Clear search"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>

		<button
			type="button"
			onclick={() => (filtersExpanded = !filtersExpanded)}
			aria-expanded={filtersExpanded}
			class="flex shrink-0 items-center gap-1 rounded-sm border px-2 py-1.5 text-xs font-medium transition-colors {filtersExpanded ||
			model.activeFilterCount > 0
				? 'border-slate-300 bg-slate-100 text-slate-900'
				: 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
		>
			<Filter class="h-3.5 w-3.5" />
			Filters
			{#if model.activeFilterCount > 0}
				<span class="app-accent-badge rounded-full px-1.5 text-[11px] font-semibold">
					{model.activeFilterCount}
				</span>
			{/if}
			<ChevronDown
				class="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 {filtersExpanded
					? 'rotate-180'
					: ''}"
			/>
		</button>

		{#if model.activeFilterCount > 0 && model.onClearAll}
			<button
				type="button"
				onclick={model.onClearAll}
				class="shrink-0 rounded px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
			>
				Clear
			</button>
		{/if}
	</div>

	{#if model.searchStatus === 'error' && model.searchError}
		<div class="mx-3 mb-2 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
			<CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
			<span>{model.searchError}</span>
		</div>
	{/if}

	{#if !filtersExpanded && model.activeFilterChips && model.activeFilterChips.length > 0}
		<ActiveFilterChips chips={model.activeFilterChips} />
	{/if}

	{#if filtersExpanded && model.sections.length > 0}
		<div
			class="min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-slate-100 px-3 py-2.5"
			transition:slide={{ duration: 200, easing: cubicOut }}
		>
			{#each model.sections as section (section.id)}
				<FilterSection {section} />
			{/each}
		</div>
	{/if}
</div>
