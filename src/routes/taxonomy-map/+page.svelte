<script lang="ts">
	/**
	 * Taxonomy Map Route - Interactive taxonomy spatial distribution visualization
	 *
	 * This route displays a split view with:
	 * - Left: Taxonomy tree (ResponsiveTaxonomyView)
	 * - Right: Choropleth map showing spatial distribution (ChoroplethMap)
	 *
	 * Features:
	 * - Click a taxonomy node to see its spatial distribution
	 * - Multi-level caching for performance
	 * - Request cancellation on rapid node selection
	 * - Error handling and loading states
	 */

	import { onMount } from 'svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { TaxonomyMapView } from '$lib/components/map';
	import { createSpeciesProvider, setSpeciesProvider } from '$lib/services/species';
	import {
		createSpatialDistributionService,
		setSpatialDistributionService
	} from '$lib/services/spatial-distribution';

	let { data } = $props();

	// Initialize services synchronously (before child components render)
	// This ensures context is available when TaxonomyMapView initializes
	const speciesProvider = createSpeciesProvider();
	setSpeciesProvider(speciesProvider);

	const distributionService = createSpatialDistributionService(speciesProvider);
	setSpatialDistributionService(distributionService);

	// Mobile breakpoint
	const MOBILE_BREAKPOINT = 768;

	// State for responsive behavior
	// Initialize with a large value to assume desktop until measured (prevents mobile panel flash on load)
	let containerWidth = $state(9999);
	let containerEl = $state<HTMLElement | null>(null);

	// Derived: is mobile based on container width
	// Only consider mobile if we've actually measured (containerWidth < 9999 means ResizeObserver has fired)
	const isMobile = $derived(containerWidth < 9999 && containerWidth < MOBILE_BREAKPOINT);

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

	// Preload species manifest for faster region lookups
	onMount(() => {
		speciesProvider.preload();
	});
</script>

<svelte:head>
	<title>World Checklist of Food Plants</title>
</svelte:head>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main
		bind:this={containerEl}
		class="relative min-h-0 flex-1 overflow-hidden"
	>
		<TaxonomyMapView
			taxonomyTree={data.taxonomyTree}
			families={data.families}
			geoJSON={data.geoJSON}
			wcfpIdsWithSpatialData={data.wcfpIdsWithSpatialData}
			{isMobile}
			class="h-full w-full"
		/>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
