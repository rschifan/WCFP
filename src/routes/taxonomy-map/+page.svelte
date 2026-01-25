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
</script>

<svelte:head>
	<title>Taxonomy Spatial Distribution | Plant Explorer</title>
</svelte:head>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main class="relative min-h-0 flex-1 overflow-hidden">
		<TaxonomyMapView
			taxonomyTree={data.taxonomyTree}
			families={data.families}
			geoJSON={data.geoJSON}
			wcfpIdsWithSpatialData={data.wcfpIdsWithSpatialData}
			class="h-full w-full"
		/>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
