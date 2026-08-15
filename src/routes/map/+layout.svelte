<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { fromStore } from 'svelte/store';
	import type { FeatureCollection } from 'geojson';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import {
		ChoroplethMap,
		OccurrenceStatusFilter,
		RegionSearchBox,
		type OccurrenceFilterValue
	} from '$lib/components/map';
	import { regionGeometryStore, type RegionFeatureCollection } from '$lib/stores/region-geometry';
	import { setOccurrenceFilter } from '$lib/stores/occurrence-filter';
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

	// ── Occurrence-status filter ────────────────────────────────────────────────
	// "all" uses the counts already embedded in the GeoJSON, so the default view makes no
	// request. Choosing a status fetches per-region counts and hands them to ChoroplethMap's
	// existing `distributionData` override, which recolours and rescales the legend; regions
	// with no records of that status are absent from the map and render as "no data".
	let occurrenceStatus = $state<OccurrenceFilterValue>('all');
	let statusCounts = $state<Map<string, number>>(new Map());
	let statusLoading = $state(false);

	// Publish to the shared store so the region panel reports the same figure the map shows.
	$effect(() => {
		setOccurrenceFilter({ status: occurrenceStatus, counts: statusCounts });
	});

	const legendSubtitle = $derived(
		occurrenceStatus === 'all' ? 'Food plant taxa' : `Food plant taxa — ${occurrenceStatus}`
	);

	$effect(() => {
		const status = occurrenceStatus;

		if (status === 'all') {
			statusCounts = new Map();
			statusLoading = false;
			return;
		}

		const controller = new AbortController();
		statusLoading = true;

		fetch(`${base}/api/v1/regions/counts?status=${status}`, { signal: controller.signal })
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.json();
			})
			.then((payload: { data: { code: string; count: number }[] }) => {
				statusCounts = new Map(payload.data.map((row) => [row.code, row.count]));
			})
			.catch((err) => {
				if (err?.name === 'AbortError') return;
				// Fall back to the unfiltered view rather than showing an empty map.
				console.error('[map] occurrence counts failed:', err);
				occurrenceStatus = 'all';
			})
			.finally(() => {
				statusLoading = false;
			});

		return () => controller.abort();
	});
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
					Distribution of edible plant taxa across 367 botanical regions.
				</p>
			</div>
			<div class="flex shrink-0 flex-wrap items-center gap-3">
				<OccurrenceStatusFilter
					value={occurrenceStatus}
					onChange={(next) => (occurrenceStatus = next)}
					loading={statusLoading}
				/>
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
					distributionData={statusCounts}
					{selectedRegion}
					{previewRegion}
					onRegionClick={handleSelectRegion}
					legendTitle="Count"
					{legendSubtitle}
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
