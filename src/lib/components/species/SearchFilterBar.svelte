<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		Search,
		Filter,
		X,
		ChevronDown,
		Pill,
		Flame,
		Bug,
		Skull,
		Users,
		Hammer,
		Globe,
		FlaskConical,
		TreeDeciduous
	} from 'lucide-svelte';
	import type { Species, SpeciesFilters, SpeciesUseKey } from '$lib/types/species';

	interface Props {
		filters: SpeciesFilters;
		species: Species[];
		onFilterChange: (filters: SpeciesFilters) => void;
		searchQuery: string;
		onSearchChange: (query: string) => void;
	}

	let { filters, species, onFilterChange, searchQuery, onSearchChange }: Props = $props();

	let filtersExpanded = $state(false);

	// Use categories configuration
	const USE_CATEGORIES: Array<{
		key: SpeciesUseKey;
		label: string;
		icon: typeof Pill;
		activeClass: string;
	}> = [
		{ key: 'medicines', label: 'Medicines', icon: Pill, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'poisons', label: 'Poisons', icon: Skull, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'materials', label: 'Materials', icon: Hammer, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'fuels', label: 'Fuels', icon: Flame, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'animalFood', label: 'Animal Food', icon: Bug, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'invertebrateFood', label: 'Invertebrate Food', icon: Bug, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'socialUses', label: 'Social Uses', icon: Users, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'environmentalUses', label: 'Environmental', icon: Globe, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' },
		{ key: 'geneSources', label: 'Gene Sources', icon: FlaskConical, activeClass: 'bg-teal-100 text-teal-700 border-teal-300' }
	];

	// Extract unique lifeforms from species data, sorted by frequency
	let lifeformOptions = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const s of species) {
			if (s.lifeform) {
				counts.set(s.lifeform, (counts.get(s.lifeform) || 0) + 1);
			}
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([lf, count]) => ({ value: lf, label: lf, count }));
	});

	// Count active filters
	let activeFilterCount = $derived(filters.lifeforms.size + filters.uses.size);

	// Get active filter labels for chips display
	let activeFilters = $derived.by(() => {
		const active: Array<{ type: 'use' | 'lifeform'; key: string; label: string }> = [];

		for (const useKey of filters.uses) {
			const category = USE_CATEGORIES.find(c => c.key === useKey);
			if (category) {
				active.push({ type: 'use', key: useKey, label: category.label });
			}
		}

		for (const lf of filters.lifeforms) {
			active.push({ type: 'lifeform', key: lf, label: lf });
		}

		return active;
	});

	function toggleUse(useKey: SpeciesUseKey) {
		const newUses = new Set(filters.uses);
		if (newUses.has(useKey)) {
			newUses.delete(useKey);
		} else {
			newUses.add(useKey);
		}
		onFilterChange({ ...filters, uses: newUses });
	}

	function removeUse(useKey: string) {
		const newUses = new Set(filters.uses);
		newUses.delete(useKey as SpeciesUseKey);
		onFilterChange({ ...filters, uses: newUses });
	}

	function handleLifeformChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const selectedOptions = Array.from(select.selectedOptions).map(opt => opt.value);
		onFilterChange({ ...filters, lifeforms: new Set(selectedOptions) });
	}

	function removeLifeform(lf: string) {
		const newLifeforms = new Set(filters.lifeforms);
		newLifeforms.delete(lf);
		onFilterChange({ ...filters, lifeforms: newLifeforms });
	}

	function removeFilter(filter: { type: 'use' | 'lifeform'; key: string }) {
		if (filter.type === 'use') {
			removeUse(filter.key);
		} else {
			removeLifeform(filter.key);
		}
	}

	function clearAll() {
		onFilterChange({
			lifeforms: new Set(),
			cwr: null,
			uses: new Set()
		});
	}
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
				placeholder="Search families, genera, or species..."
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
			{#if activeFilterCount > 0}
				<span class="rounded-full bg-teal-500 px-1.5 py-0.5 text-xs font-semibold text-white">
					{activeFilterCount}
				</span>
			{/if}
		</button>
		<div class="flex items-center gap-2">
			{#if activeFilterCount > 0}
				<button
					type="button"
					onclick={clearAll}
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
				<ChevronDown class="h-4 w-4 text-slate-400 transition-transform duration-200 {filtersExpanded ? 'rotate-180' : ''}" />
			</button>
		</div>
	</div>

	<!-- Active filters chips (shown when collapsed and has active filters) -->
	{#if !filtersExpanded && activeFilters.length > 0}
		<div class="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2">
			{#each activeFilters as filter (filter.type + filter.key)}
				<button
					type="button"
					onclick={() => removeFilter(filter)}
					class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
				>
					{#if filter.type === 'lifeform'}
						<TreeDeciduous class="h-3 w-3" />
					{/if}
					{filter.label}
					<X class="h-3 w-3" />
				</button>
			{/each}
		</div>
	{/if}

	<!-- Expanded filter content -->
	{#if filtersExpanded}
		<div
			class="space-y-4 border-t border-slate-100 px-4 py-3"
			transition:slide={{ duration: 200, easing: cubicOut }}
		>
			<!-- Uses section -->
			<div class="filter-group">
				<span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Uses</span>
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each USE_CATEGORIES as { key, label, icon: Icon, activeClass } (key)}
						{@const isActive = filters.uses.has(key)}
						<button
							type="button"
							class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors {isActive
								? activeClass
								: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}"
							onclick={() => toggleUse(key)}
						>
							<Icon class="h-3 w-3" />
							{label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Lifeform dropdown -->
			{#if lifeformOptions.length > 0}
				<div class="filter-group">
					<label for="lifeform-select" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Lifeform
					</label>
					<select
						id="lifeform-select"
						multiple
						class="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none"
						style="height: auto; max-height: 120px;"
						onchange={handleLifeformChange}
					>
						{#each lifeformOptions as { value, label, count } (value)}
							<option {value} selected={filters.lifeforms.has(value)}>
								{label} ({count})
							</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-slate-400">Hold Ctrl/Cmd to select multiple</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
