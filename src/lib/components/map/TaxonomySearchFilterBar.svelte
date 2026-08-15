<script lang="ts">
	import { Globe } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import FilterBar from '$lib/components/filters/FilterBar.svelte';
	import {
		buildTraitActiveFilterChips,
		buildTraitFilterSections
	} from '$lib/components/filters/traitFilterModel';
	import { createEmptyTaxonomyFilters, type TaxonomyFilters } from '$lib/types/taxonomy';
	import type { FilterBarModel } from '$lib/types/filters';
	import type { ActiveFilterChip, FilterSectionModel } from '$lib/types/filters';
	import type { SearchStatus } from '$lib/types/search';
	import type { SpeciesUseKey } from '$lib/types/species';

	interface Props {
		searchPlaceholder?: string;
		searchQuery: string;
		onSearchChange: (query: string) => void;
		onClearSearch?: () => void;
		searchStatus?: SearchStatus;
		searchError?: string | null;
		filters: TaxonomyFilters;
		availableLifeforms: string[];
		onFilterChange: (filters: TaxonomyFilters) => void;
		/** Only meaningful in the global view — see the note on geographySection below. */
		showGeographicFilter?: boolean;
	}

	let {
		searchPlaceholder = 'Search taxonomy...',
		searchQuery,
		onSearchChange,
		onClearSearch,
		searchStatus,
		searchError = null,
		filters,
		availableLifeforms,
		onFilterChange,
		showGeographicFilter = true
	}: Props = $props();

	const activeFilterCount = $derived(
		(showGeographicFilter && filters.geographicOnly ? 1 : 0) + filters.lifeforms.size + filters.uses.size
	);

	function toggleGeographicOnly() {
		onFilterChange({ ...filters, geographicOnly: !filters.geographicOnly });
	}

	function toggleUse(useKey: SpeciesUseKey) {
		const nextUses = new SvelteSet(filters.uses);
		if (nextUses.has(useKey)) {
			nextUses.delete(useKey);
		} else {
			nextUses.add(useKey);
		}

		onFilterChange({ ...filters, uses: nextUses });
	}

	function removeUse(useKey: SpeciesUseKey) {
		const nextUses = new SvelteSet(filters.uses);
		nextUses.delete(useKey);
		onFilterChange({ ...filters, uses: nextUses });
	}

	function removeLifeform(lifeform: string) {
		const nextLifeforms = new SvelteSet(filters.lifeforms);
		nextLifeforms.delete(lifeform);
		onFilterChange({ ...filters, lifeforms: nextLifeforms });
	}

	function clearAll() {
		onFilterChange(createEmptyTaxonomyFilters());
	}

	const activeFilterChips = $derived.by((): ActiveFilterChip[] => {
		const chips: ActiveFilterChip[] = [];
		if (filters.geographicOnly) {
			chips.push({
				id: 'geographicOnly',
				label: 'Geographic',
				icon: Globe,
				onRemove: toggleGeographicOnly
			});
		}

		return chips.concat(
			buildTraitActiveFilterChips({
				selectedUses: filters.uses,
				selectedLifeforms: filters.lifeforms,
				onRemoveUse: removeUse,
				onRemoveLifeform: removeLifeform
			})
		);
	});

	const sections = $derived.by((): FilterSectionModel[] => {
		// "Geographic" keeps only taxa that have distribution records at all. Inside a region
		// every listed taxon has them by construction, so the toggle cannot change the result
		// there — it is offered only in the global taxonomy view, where 1,187 taxa lack them.
		const geographySection: FilterSectionModel = {
			id: 'taxonomy-geographic',
			title: 'Geographic',
			kind: 'toggle-chip',
			options: [
				{
					id: 'geographicOnly',
					icon: Globe,
					selected: filters.geographicOnly,
					title: 'Show only nodes with geographical information',
					ariaLabel: 'Show only nodes with geographical information'
				}
			],
			onToggle: toggleGeographicOnly
		};

		return [
			...(showGeographicFilter ? [geographySection] : []),
			...buildTraitFilterSections({
				selectedUses: filters.uses,
				selectedLifeforms: filters.lifeforms,
				lifeformOptions: availableLifeforms.map((value) => ({ value, label: value })),
				lifeformSelectId: 'taxonomy-lifeform-select',
				onToggleUse: toggleUse,
				onLifeformsChange: (selectedIds) =>
					onFilterChange({ ...filters, lifeforms: new SvelteSet(selectedIds) })
			})
		];
	});

	const model = $derived.by(
		(): FilterBarModel => ({
			searchPlaceholder,
			searchQuery,
			onSearchChange,
			onClearSearch,
			searchStatus,
			searchError,
			activeFilterCount,
			activeFilterChips,
			onClearAll: activeFilterCount > 0 ? clearAll : undefined,
			sections
		})
	);
</script>

<div class="shrink-0 overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
	<FilterBar {model} />
</div>
