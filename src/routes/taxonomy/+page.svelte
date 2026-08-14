<script lang="ts">
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { TaxonomyOverlayView } from '$lib/components/map';
	import { createSpeciesProvider, setSpeciesProvider } from '$lib/services/species';
	import {
		createSpatialDistributionService,
		setSpatialDistributionService
	} from '$lib/services/spatial-distribution';

	const speciesProvider = createSpeciesProvider();
	setSpeciesProvider(speciesProvider);

	const distributionService = createSpatialDistributionService();
	setSpatialDistributionService(distributionService);

	const MOBILE_BREAKPOINT = 768;

	let containerWidth = $state(9999);
	let containerEl = $state<HTMLElement | null>(null);

	const isMobile = $derived(containerWidth < 9999 && containerWidth < MOBILE_BREAKPOINT);

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
</script>

<svelte:head>
	<title>Taxonomy | World Checklist of Food Plants</title>
	<meta
		name="description"
		content="Browse food plant taxa by taxonomic classification and traits through the World Checklist of Food Plants taxonomy view."
	/>
</svelte:head>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main bind:this={containerEl} class="relative min-h-0 flex-1 overflow-hidden">
		<TaxonomyOverlayView {isMobile} class="h-full w-full" />
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
