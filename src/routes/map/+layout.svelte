<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { fromStore } from 'svelte/store';
	import type { FeatureCollection } from 'geojson';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { ChoroplethMap, RegionSearchBox } from '$lib/components/map';
	import { regionGeometryStore, type RegionFeatureCollection } from '$lib/stores/region-geometry';
	import { createSpeciesProvider, setSpeciesProvider } from '$lib/services/species';
	import {
		createSpatialDistributionService,
		setSpatialDistributionService
	} from '$lib/services/spatial-distribution';

	// Provide the taxonomy/species services used by SpeciesPanel children.
	setSpeciesProvider(createSpeciesProvider());
	setSpatialDistributionService(createSpatialDistributionService());

	interface Props {
		data: { regionsGeoJSON: RegionFeatureCollection };
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	let previewRegion = $state<string | null>(null);
	const sharedRegionGeometry = fromStore(regionGeometryStore);
	const geoJSON = $derived(sharedRegionGeometry.current.geoJSON ?? data.regionsGeoJSON);

	// The selected region is derived from the URL: /map -> none, /map/WAU -> "WAU".
	const selectedRegion = $derived((page.params.region as string | undefined) ?? null);

	function handleSelectRegion(code: string) {
		previewRegion = null;
		goto(`${base}/map/${encodeURIComponent(code)}`, { keepFocus: true, noScroll: true });
	}

	function handlePreviewRegion(code: string | null) {
		previewRegion = code;
	}
</script>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="shrink-0">
		<TopBar />
	</header>

	<section class="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div class="min-w-0">
				<h1 class="truncate text-xl font-semibold text-slate-900">Food plants worldwide</h1>
				<p class="mt-0.5 text-sm text-slate-500">
					Distribution of edible plant species across 369 botanical regions.
				</p>
			</div>
			<div class="shrink-0">
				<RegionSearchBox
					onSelectRegion={handleSelectRegion}
					onPreviewRegion={handlePreviewRegion}
				/>
			</div>
		</div>
	</section>

	<main class="flex min-h-0 flex-1 overflow-hidden bg-slate-100 md:flex-row-reverse">
		<div class="relative h-full min-w-0 flex-1">
			{#if geoJSON}
				<ChoroplethMap
					geoJSON={geoJSON as FeatureCollection}
					distributionData={new Map()}
					{selectedRegion}
					{previewRegion}
					onRegionClick={handleSelectRegion}
					legendTitle="Count"
					legendSubtitle="Food plant taxa"
					legendPosition="bottom-left"
				/>
			{/if}
		</div>

		{@render children()}
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
