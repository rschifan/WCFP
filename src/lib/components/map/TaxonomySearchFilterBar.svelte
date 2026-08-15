<script lang="ts">
	import { Globe, Sprout } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { fromStore } from 'svelte/store';
	import FilterBar from '$lib/components/filters/FilterBar.svelte';
	import {
		buildTraitActiveFilterChips,
		buildTraitFilterSections
	} from '$lib/components/filters/traitFilterModel';
	import { occurrenceFilterStore, setOccurrenceStatus } from '$lib/stores/occurrence-filter';
	import { formatCount } from '$lib/utils/format';
	import {
		createEmptyTaxonomyFilters,
		type OccurrenceStatusFilter,
		type TaxonomyFilters
	} from '$lib/types/taxonomy';
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
		searchPlaceholder = 'Search',
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

	// Occurrence is a scope, not a row predicate: it reloads the region's tree so the counts on
	// every family and genus are the filtered ones, and so the list stays aggregated instead of
	// flattening to thousands of rows. The reload is invisible — see initialize() in the browser
	// controller. Counts and selection live in a store because the map layout fetches the facets,
	// on the other side of the route's children snippet. No facets outside a region, no section.
	const occurrence = fromStore(occurrenceFilterStore);
	// Doubtful is deliberately not offered as a filter — it stays visible as a badge on the taxa
	// that carry it, and those taxa are still counted in the unfiltered list.
	const ORDER: OccurrenceStatusFilter[] = ['native', 'introduced', 'extinct'];
	// A status with no records in this region is left out rather than shown at zero.
	const occurrenceRows = $derived(
		ORDER.map((status) => ({
			status,
			count: occurrence.current.facets.find((f) => f.occurrence_status === status)?.count ?? 0
		})).filter((row) => row.count > 0)
	);

	const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

	function toggleOccurrence(status: OccurrenceStatusFilter) {
		setOccurrenceStatus(occurrence.current.status === status ? null : status);
	}

	const activeFilterCount = $derived(
		(showGeographicFilter && filters.geographicOnly ? 1 : 0) +
			filters.lifeforms.size +
			filters.uses.size +
			(occurrence.current.status ? 1 : 0)
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
		setOccurrenceStatus(null);
		onFilterChange(createEmptyTaxonomyFilters());
	}

	const activeFilterChips = $derived.by((): ActiveFilterChip[] => {
		const chips: ActiveFilterChip[] = [];
		const status = occurrence.current.status;
		if (status) {
			chips.push({
				id: 'occurrence',
				label: capitalize(status),
				icon: Sprout,
				onRemove: () => setOccurrenceStatus(null)
			});
		}

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

		// Single-select: clicking the active status clears it. Same chips as every other section,
		// so the whole rail reads as one control surface.
		const occurrenceSection: FilterSectionModel = {
			id: 'occurrence',
			title: 'Occurrence',
			kind: 'multi-chip',
			options: occurrenceRows.map(({ status, count }) => ({
				id: status,
				label: `${capitalize(status)} · ${formatCount(count)}`,
				selected: occurrence.current.status === status,
				title: `Show only taxa recorded as ${status} in this region`,
				ariaLabel: `Show only taxa recorded as ${status} in this region`
			})),
			onToggle: (optionId) => toggleOccurrence(optionId as OccurrenceStatusFilter)
		};

		return [
			...(occurrenceRows.length > 0 ? [occurrenceSection] : []),
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
