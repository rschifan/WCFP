<script lang="ts">
	import { useSpeciesProvider } from '$lib/services/species';
	import type { Species } from '$lib/types/species';
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
</script>

{#if isMobile}
	<SpeciesPanelMobile
		{selectedRegion}
		{species}
		{loading}
		{error}
		{onClose}
		onRetry={() => selectedRegion && fetchSpecies(selectedRegion)}
	/>
{:else}
	<SpeciesPanelDesktop
		{selectedRegion}
		{species}
		{loading}
		{error}
		{onClose}
		onRetry={() => selectedRegion && fetchSpecies(selectedRegion)}
	/>
{/if}
