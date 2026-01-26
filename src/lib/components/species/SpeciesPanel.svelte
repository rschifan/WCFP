<script lang="ts">
	import { useSpeciesProvider } from '$lib/services/species';
	import type { Species, SpeciesFilters } from '$lib/types/species';
	import { EMPTY_FILTERS } from '$lib/types/species';
	import SpeciesPanelDesktop from './SpeciesPanelDesktop.svelte';
	import SpeciesPanelMobile from './SpeciesPanelMobile.svelte';

	interface Props {
		selectedRegion: string | null;
		isMobile: boolean;
		onClose?: () => void;
	}

	let { selectedRegion, isMobile, onClose }: Props = $props();

	const provider = useSpeciesProvider();

	let species = $state<Species[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let filters = $state<SpeciesFilters>({
		lifeforms: new Set(),
		cwr: null,
		uses: new Set()
	});
	let searchQuery = $state('');

	// Compute filtered species using AND logic
	let filteredSpecies = $derived.by(() => {
		let result = species;

		// Filter by lifeform (if any selected)
		if (filters.lifeforms.size > 0) {
			result = result.filter((s) => s.lifeform && filters.lifeforms.has(s.lifeform));
		}

		// Filter by CWR
		if (filters.cwr === true) {
			result = result.filter((s) => s.cwr === true);
		}

		// Filter by uses (AND logic - must have ALL selected uses)
		if (filters.uses.size > 0) {
			result = result.filter((s) => {
				if (!s.uses) return false;
				return [...filters.uses].every((useKey) => s.uses?.[useKey]);
			});
		}

		return result;
	});

	async function fetchSpecies(region: string) {
		loading = true;
		error = null;

		try {
			species = await provider.getSpeciesByRegion(region);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load species data';
			console.error('[SpeciesPanel] Load error:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const region = selectedRegion?.trim();

		if (!region) {
			species = [];
			error = null;
			loading = false;
			return;
		}

		const cached = provider.getCachedData(region);
		if (cached) {
			species = cached;
			error = null;
			return;
		}

		fetchSpecies(region);
	});

	// Reset filters and search when region changes
	$effect(() => {
		if (selectedRegion) {
			filters = {
				lifeforms: new Set(),
				cwr: null,
				uses: new Set()
			};
			searchQuery = '';
		}
	});

	function handleFilterChange(newFilters: SpeciesFilters) {
		filters = newFilters;
	}
</script>

{#if isMobile}
	<SpeciesPanelMobile
		{selectedRegion}
		species={filteredSpecies}
		allSpecies={species}
		{filters}
		onFilterChange={handleFilterChange}
		{searchQuery}
		onSearchChange={(q) => searchQuery = q}
		{loading}
		{error}
		{onClose}
		onRetry={() => selectedRegion && fetchSpecies(selectedRegion)}
	/>
{:else}
	<SpeciesPanelDesktop
		{selectedRegion}
		species={filteredSpecies}
		allSpecies={species}
		{filters}
		onFilterChange={handleFilterChange}
		{searchQuery}
		onSearchChange={(q) => searchQuery = q}
		{loading}
		{error}
		{onClose}
		onRetry={() => selectedRegion && fetchSpecies(selectedRegion)}
	/>
{/if}
