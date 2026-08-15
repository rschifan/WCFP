<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { fromStore } from 'svelte/store';
	import type { FeatureCollection } from 'geojson';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { ChoroplethMap, MapModeBar, RegionSearchBox, type MapMode } from '$lib/components/map';
	import { regionGeometryStore, type RegionFeatureCollection } from '$lib/stores/region-geometry';
	import { setOccurrenceFacets } from '$lib/stores/occurrence-filter';
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

	// ── What the map is coloured by ─────────────────────────────────────────────
	// Map-level and independent of the region panel: this bar changes the world view, while the
	// filters in the panel narrow that region's list. Keeping them separate means neither
	// control silently reaches into the other's territory.
	let mapMode = $state<MapMode>('all');
	let statusCounts = $state<Map<string, number>>(new Map());
	let loadingCounts = $state(false);

	const legendSubtitle = $derived(
		mapMode === 'pct'
			? '% of accepted flora'
			: mapMode === 'all'
				? 'Food plant taxa'
				: `Food plant taxa — ${mapMode}`
	);

	const formatValue = $derived(
		mapMode === 'pct'
			? (v: number) => `${v.toFixed(1)}%`
			: // counts are integers — the midpoint of an odd span is not
				(v: number) => Math.round(v).toLocaleString('en-US')
	);

	/**
	 * Values the choropleth paints. Unfiltered counts already travel inside the GeoJSON, so the
	 * default costs no request; a status is a small overlay fetched on demand, and the flora
	 * share is read straight off the features.
	 */
	const distributionData = $derived.by<Map<string, number>>(() => {
		if (mapMode === 'pct') {
			const out = new Map<string, number>();
			for (const feature of geoJSON?.features ?? []) {
				const code = feature.properties?.LEVEL3_COD ?? feature.properties?.code;
				const pct = feature.properties?.pct_of_flora;
				if (typeof code === 'string' && typeof pct === 'number') out.set(code, pct);
			}
			return out;
		}
		return mapMode === 'all' ? new Map() : statusCounts;
	});

	// Per-region counts for the selected status.
	$effect(() => {
		const mode = mapMode;
		if (mode === 'all' || mode === 'pct') {
			statusCounts = new Map();
			loadingCounts = false;
			return;
		}

		const controller = new AbortController();
		loadingCounts = true;
		fetch(`${base}/api/v1/regions/counts?status=${mode}`, { signal: controller.signal })
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then((payload: { data: { code: string; count: number }[] }) => {
				statusCounts = new Map(payload.data.map((row) => [row.code, row.count]));
			})
			.catch((err) => {
				if (err?.name === 'AbortError') return;
				// Fall back to the unfiltered view rather than showing an empty map.
				console.error('[map] occurrence counts failed:', err);
				mapMode = 'all';
			})
			.finally(() => {
				loadingCounts = false;
			});

		return () => controller.abort();
	});

	// Facet counts for the panel's list filter, scoped to the selected region.
	$effect(() => {
		const region = selectedRegion;
		if (!region) {
			setOccurrenceFacets([]);
			return;
		}

		const controller = new AbortController();
		fetch(`${base}/api/v1/regions/facets?region=${encodeURIComponent(region)}`, {
			signal: controller.signal
		})
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((payload) => setOccurrenceFacets(payload.data))
			.catch((err) => {
				if (err?.name !== 'AbortError') console.error('[map] facets failed:', err);
			});

		return () => controller.abort();
	});
</script>

<div class="flex h-screen w-screen flex-col overflow-hidden">
	<header class="shrink-0">
		<TopBar />
	</header>

	<section class="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="min-w-0">
				<h1 class="truncate text-xl font-semibold text-slate-900">Food plants worldwide</h1>
				<p class="mt-0.5 text-sm text-slate-500">
					Distribution of edible plant taxa across 367 botanical regions.
				</p>
			</div>
			<RegionSearchBox
				onSelectRegion={handleSelectRegion}
				onPreviewRegion={handlePreviewRegion}
			/>
		</div>
	</section>

	<main class="flex min-h-0 flex-1 overflow-hidden bg-slate-100 md:flex-row-reverse">
		<!-- The bar belongs to the map, so it spans the map column only — not the panel beside it. -->
		<div class="flex h-full min-w-0 flex-1 flex-col">
			<MapModeBar value={mapMode} onChange={(next) => (mapMode = next)} loading={loadingCounts} />
			<div class="relative min-h-0 flex-1">
				{#if geoJSON}
					<ChoroplethMap
						geoJSON={geoJSON as FeatureCollection}
						{distributionData}
						{selectedRegion}
						{previewRegion}
						onRegionClick={handleSelectRegion}
						legendTitle={mapMode === 'pct' ? 'Share' : 'Count'}
						{legendSubtitle}
						{formatValue}
						valueLabel={mapMode === 'pct' ? 'Share of flora' : 'Taxa'}
						zeroIsData={mapMode === 'pct'}
						classification={mapMode === 'pct' ? 'quantile' : 'continuous'}
						legendPosition="bottom-left"
					/>
				{/if}
			</div>
		</div>

		{@render children()}
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
