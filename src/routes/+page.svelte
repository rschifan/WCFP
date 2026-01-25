<script lang="ts">
	import { onMount } from 'svelte';
	import type { FeatureCollection } from 'geojson';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { ChoroplethMap } from '$lib/components/map';
	import SpeciesPanel from '$lib/components/species/SpeciesPanel.svelte';
	import { createSpeciesProvider, setSpeciesProvider } from '$lib/services/species';

	// Color scale constants
	const COLOR_LOW = '#e0f2f1';
	const COLOR_MID = '#80cbc4';
	const COLOR_HIGH = '#00897b';
	const HOVER_COLOR = '#14532d';

	// Initialize species provider and set in context
	const speciesProvider = createSpeciesProvider();
	setSpeciesProvider(speciesProvider);

	// State
	let geoJSONData = $state<FeatureCollection | null>(null);
	let loadError = $state<string | null>(null);
	let loading = $state(true);
	let selectedRegion = $state<string | null>(null);

	// Load GeoJSON on mount
	onMount(async () => {
		try {
			const response = await fetch('/data/level3_merged_wcfp.geojson');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			geoJSONData = await response.json();
			loading = false;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load GeoJSON';
			loading = false;
		}
	});

	// Handle region click to show species panel
	function handleRegionClick(regionName: string) {
		selectedRegion = regionName;
	}
</script>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="shrink-0">
		<TopBar />
	</header>
	<main class="relative min-h-0 flex-1 overflow-hidden">
		{#if loadError}
			<div class="flex h-full items-center justify-center">
				<div class="bg-error-500-900 text-on-error-token card rounded-lg p-6 shadow-lg">
					<p class="font-semibold">Failed to load GeoJSON data</p>
					<p class="mt-2 text-sm">{loadError}</p>
					<button
						type="button"
						class="preset-filled-error mt-4 btn"
						onclick={() => window.location.reload()}
					>
						Retry
					</button>
				</div>
			</div>
		{:else if loading}
			<div class="flex h-full items-center justify-center">
				<div class="text-on-surface-token flex items-center gap-3">
					<span
						class="h-6 w-6 animate-spin rounded-full border-2 border-surface-300-700 border-t-primary-500"
					></span>
					<span>Loading map data...</span>
				</div>
			</div>
		{:else if geoJSONData}
			<ChoroplethMap
				geoJSON={geoJSONData}
				distributionData={new Map()}
				colors={{ low: COLOR_LOW, mid: COLOR_MID, high: COLOR_HIGH }}
				hoverColor={HOVER_COLOR}
				onRegionClick={handleRegionClick}
				legendTitle="Count"
				legendSubtitle="Food plant species"
				autoFitBounds={false}
			/>

			<!-- Species Panel -->
			<SpeciesPanel {selectedRegion} onClose={() => (selectedRegion = null)} />
		{/if}
	</main>
	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
