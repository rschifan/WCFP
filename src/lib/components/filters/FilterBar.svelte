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

<div class="shrink-0 overflow-hidden">
	<div class="space-y-2 px-4 py-3">
		<div class="relative">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				value={model.searchQuery}
				oninput={(event) => model.onSearchChange(event.currentTarget.value)}
				placeholder={model.searchPlaceholder}
				class="app-input-accent w-full rounded-sm border border-slate-200 bg-slate-50 py-2 pr-10 pl-10 text-sm text-black placeholder:text-slate-400"
			/>
			<div class="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
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
		{#if model.searchStatus === 'error' && model.searchError}
			<div class="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
				<CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
				<span>{model.searchError}</span>
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-sm">
		<button
			type="button"
			onclick={() => (filtersExpanded = !filtersExpanded)}
			class="flex flex-1 items-center gap-2 font-medium text-slate-700 hover:text-slate-900"
		>
			<Filter class="h-4 w-4" />
			Filters
			{#if model.activeFilterCount > 0}
				<span class="app-accent-badge rounded-full px-1.5 py-0.5 text-xs font-semibold">
					{model.activeFilterCount}
				</span>
			{/if}
		</button>
		<div class="flex items-center gap-2">
			{#if model.activeFilterCount > 0 && model.onClearAll}
				<button
					type="button"
					onclick={model.onClearAll}
					class="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
				>
					Clear
				</button>
			{/if}
			<button
				type="button"
				onclick={() => (filtersExpanded = !filtersExpanded)}
				class="rounded p-0.5 hover:bg-slate-100"
				aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
			>
				<ChevronDown
					class="h-4 w-4 text-slate-400 transition-transform duration-200 {filtersExpanded
						? 'rotate-180'
						: ''}"
				/>
			</button>
		</div>
	</div>

	{#if !filtersExpanded && model.activeFilterChips && model.activeFilterChips.length > 0}
		<ActiveFilterChips chips={model.activeFilterChips} />
	{/if}

	{#if filtersExpanded && model.sections.length > 0}
		<div
			class="space-y-4 border-t border-slate-100 px-4 py-3"
			transition:slide={{ duration: 200, easing: cubicOut }}
		>
			{#each model.sections as section (section.id)}
				<FilterSection {section} />
			{/each}
		</div>
	{/if}
</div>
