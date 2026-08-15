<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { fromStore } from 'svelte/store';
	import type { FeatureCollection } from 'geojson';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { ChoroplethMap, OccurrenceFacet, RegionSearchBox } from '$lib/components/map';
	import { regionGeometryStore, type RegionFeatureCollection } from '$lib/stores/region-geometry';
	import {
		occurrenceFilterStore,
		setOccurrenceDisabled,
		setOccurrenceFacets,
		setOccurrenceStatus
	} from '$lib/stores/occurrence-filter';
	import type { OccurrenceStatusFilter } from '$lib/types/taxonomy';
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
	// Two independent choices. The measure is a rendering decision and lives in the header;
	// the occurrence status is a data filter and lives in the rail with the other filters,
	// driving the map and the region's taxonomy tree from one selection.
	type Measure = 'taxa' | 'pct';

	let measure = $state<Measure>('taxa');
	let statusCounts = $state<Map<string, number>>(new Map());

	// The filter itself lives in the store so the rail, the region panel and the map all read
	// and write one value.
	const filter = fromStore(occurrenceFilterStore);
	const occurrenceStatus = $derived(filter.current.status);
	const facets = $derived(filter.current.facets);

	// Share of flora is published against all occurrences, so the two cannot combine.
	const statusApplies = $derived(measure !== 'pct');
	const activeStatus = $derived(statusApplies ? occurrenceStatus : null);

	$effect(() => {
		setOccurrenceDisabled(!statusApplies);
	});

	const legendSubtitle = $derived(
		measure === 'pct'
			? 'WCFP taxa as % of accepted flora'
			: activeStatus
				? `Food plant taxa — ${activeStatus}`
				: 'Food plant taxa'
	);

	const formatValue = $derived(
		measure === 'pct'
			? (v: number) => `${v.toFixed(1)}%`
			: // counts are integers — the midpoint of an odd span is not
				(v: number) => Math.round(v).toLocaleString('en-US')
	);

	/**
	 * Values the choropleth paints. Unfiltered taxon counts already travel inside the GeoJSON,
	 * so that default costs no request; the other two are small overlays fetched on demand.
	 */
	const distributionData = $derived.by<Map<string, number>>(() => {
		if (measure === 'pct') {
			const out = new Map<string, number>();
			for (const feature of geoJSON?.features ?? []) {
				const code = feature.properties?.LEVEL3_COD ?? feature.properties?.code;
				const pct = feature.properties?.pct_of_flora;
				if (typeof code === 'string' && typeof pct === 'number') out.set(code, pct);
			}
			return out;
		}
		return activeStatus ? statusCounts : new Map();
	});

	// Per-region counts for the active status.
	$effect(() => {
		const status = activeStatus;
		if (!status) {
			statusCounts = new Map();
			return;
		}
		const controller = new AbortController();
		fetch(`${base}/api/v1/regions/counts?status=${status}`, { signal: controller.signal })
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then((payload: { data: { code: string; count: number }[] }) => {
				statusCounts = new Map(payload.data.map((row) => [row.code, row.count]));
			})
			.catch((err) => {
				if (err?.name === 'AbortError') return;
				console.error('[map] occurrence counts failed:', err);
				setOccurrenceStatus(null);
			});
		return () => controller.abort();
	});

	// Facet counts, scoped to the selected region when there is one.
	$effect(() => {
		const region = selectedRegion;
		const controller = new AbortController();
		const url = region
			? `${base}/api/v1/regions/facets?region=${encodeURIComponent(region)}`
			: `${base}/api/v1/regions/facets`;
		fetch(url, { signal: controller.signal })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((payload) => {
				setOccurrenceFacets(payload.data);
			})
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
			<div class="flex shrink-0 flex-wrap items-center gap-3">
				<span class="text-[11px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
					Colour by
				</span>
				<div
					class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
					role="radiogroup"
					aria-label="Colour the map by"
				>
					{#each [{ id: 'taxa' as Measure, label: 'Taxa' }, { id: 'pct' as Measure, label: '% of flora' }] as option (option.id)}
						<button
							type="button"
							role="radio"
							aria-checked={measure === option.id}
							onclick={() => (measure = option.id)}
							class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {measure ===
							option.id
								? 'bg-white text-slate-900 shadow-sm'
								: 'text-slate-600 hover:text-slate-900'}"
						>
							{option.label}
						</button>
					{/each}
				</div>
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
					{distributionData}
					{selectedRegion}
					{previewRegion}
					onRegionClick={handleSelectRegion}
					legendTitle={measure === 'pct' ? 'Share' : 'Count'}
					{legendSubtitle}
					{formatValue}
					valueLabel={measure === 'pct' ? 'Share of flora' : 'Taxa'}
					zeroIsData={measure === 'pct'}
					legendPosition="bottom-left"
				/>
			{/if}
		</div>

		{#if selectedRegion}
			{@render children()}
		{:else}
			<!-- The rail is part of the map, not of a selection: the filter has to be reachable
			     before a region is chosen, otherwise the world view cannot be filtered at all. -->
			<aside
				class="hidden w-[16rem] shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-4 md:flex"
				aria-label="Map filters"
			>
				<div>
					<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
						All regions
					</p>
					<h2 class="mt-1 text-lg font-semibold text-slate-900">367 botanical regions</h2>
					<p class="mt-1 text-sm text-slate-600">Select one on the map to browse its taxa.</p>
				</div>

				<OccurrenceFacet
					{facets}
					value={occurrenceStatus}
					onChange={setOccurrenceStatus}
					disabled={!statusApplies}
					disabledReason="Share of flora is published for all occurrences, so a status filter does not apply to it."
				/>
			</aside>
		{/if}
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
