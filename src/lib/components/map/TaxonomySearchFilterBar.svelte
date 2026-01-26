<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Search, Filter, X, ChevronDown } from 'lucide-svelte';

	interface Props {
		searchQuery: string;
		onSearchChange: (query: string) => void;
		showOnlySpatial: boolean;
		onFilterChange: (showOnly: boolean) => void;
	}

	let { searchQuery, onSearchChange, showOnlySpatial, onFilterChange }: Props = $props();

	let filtersExpanded = $state(false);
</script>

<div class="shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white overflow-hidden">
	<!-- Search bar - always visible -->
	<div class="px-4 py-3">
		<div class="relative">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				value={searchQuery}
				oninput={(e) => onSearchChange(e.currentTarget.value)}
				placeholder="Search taxonomy..."
				class="w-full rounded-sm border border-slate-200 bg-slate-50 py-2 pr-10 pl-10 text-sm text-black placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => onSearchChange('')}
					class="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					aria-label="Clear search"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	<!-- Filter toggle header -->
	<div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-sm">
		<button
			type="button"
			onclick={() => (filtersExpanded = !filtersExpanded)}
			class="flex flex-1 items-center gap-2 font-medium text-slate-700 hover:text-slate-900"
		>
			<Filter class="h-4 w-4" />
			Filters
			{#if showOnlySpatial}
				<span class="rounded-full bg-teal-500 px-1.5 py-0.5 text-xs font-semibold text-white">1</span>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (filtersExpanded = !filtersExpanded)}
			class="rounded p-0.5 hover:bg-slate-100"
			aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
		>
			<ChevronDown
				class="h-4 w-4 text-slate-400 transition-transform duration-200 {filtersExpanded ? 'rotate-180' : ''}"
			/>
		</button>
	</div>

	<!-- Expanded filter content -->
	{#if filtersExpanded}
		<div
			class="space-y-4 border-t border-slate-100 px-4 py-3"
			transition:slide={{ duration: 200, easing: cubicOut }}
		>
			<div class="filter-group">
				<span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</span>
				<div class="mt-2 flex flex-wrap gap-1.5">
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors {showOnlySpatial
							? 'border-teal-300 bg-teal-100 text-teal-700'
							: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}"
						onclick={() => onFilterChange(!showOnlySpatial)}
					>
						<span>Show only nodes with geographical information</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
