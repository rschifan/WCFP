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

	// Mobile breakpoint
	const MOBILE_BREAKPOINT = 768;

	// Initialize species provider and set in context
	const speciesProvider = createSpeciesProvider();
	setSpeciesProvider(speciesProvider);

	// State
	let geoJSONData = $state<FeatureCollection | null>(null);
	let loadError = $state<string | null>(null);
	let loading = $state(true);
	let selectedRegion = $state<string | null>(null);
	let containerWidth = $state(0);
	let containerEl = $state<HTMLElement | null>(null);

	// Derived: is mobile based on container width
	let isMobile = $derived(containerWidth < MOBILE_BREAKPOINT);

	// Load GeoJSON and preload species manifest in parallel on mount
	onMount(async () => {
		try {
			// Fetch GeoJSON and preload species manifest in parallel
			const [response] = await Promise.all([
				fetch('/data/level3_merged_wcfp.geojson'),
				speciesProvider.preload() // Preload manifest so region clicks are fast
			]);

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

	// ResizeObserver for container width
	$effect(() => {
		if (!containerEl) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
			}
		});

		observer.observe(containerEl);

		return () => observer.disconnect();
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
	<main
		bind:this={containerEl}
		class="relative min-h-0 flex-1 overflow-hidden"
		class:flex={!isMobile && selectedRegion}
	>
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
			<!-- Species Panel - renders as flex sibling on desktop (left side), overlay on mobile -->
			<SpeciesPanel {selectedRegion} {isMobile} onClose={() => (selectedRegion = null)} />

			<!-- Map Container - flex-1 to take remaining space when panel is open (desktop) -->
			<div class="relative h-full min-w-0 flex-1">
				<ChoroplethMap
					geoJSON={geoJSONData}
					distributionData={new Map()}
					{selectedRegion}
					colors={{ low: COLOR_LOW, mid: COLOR_MID, high: COLOR_HIGH }}
					hoverColor={HOVER_COLOR}
					onRegionClick={handleRegionClick}
					legendTitle="Count"
					legendSubtitle="Food plant species"
					autoFitBounds={false}
				/>
			</div>
		{/if}
	</main>
	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
