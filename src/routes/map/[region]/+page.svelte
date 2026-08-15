<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { fromStore } from 'svelte/store';
	import type { RegionFeature, RegionFeatureCollection } from '$lib/stores/region-geometry';
	import { occurrenceFilterStore, setOccurrenceStatus } from '$lib/stores/occurrence-filter';
	import { OccurrenceFacet } from '$lib/components/map';
	import { SpeciesPanel } from '$lib/components/species';

	const regionCode = $derived(page.params.region as string);

	// The code is the identifier and goes straight to the API. The name and the region total are
	// only labels, read from the geojson the root layout has already loaded.
	const feature = $derived.by<RegionFeature | undefined>(() => {
		const geo = page.data.regionsGeoJSON as RegionFeatureCollection | undefined;
		return geo?.features.find(
			(f) => (f.properties?.LEVEL3_COD ?? f.properties?.code) === regionCode
		);
	});

	const regionName = $derived.by<string | null>(() => {
		const name = feature?.properties?.LEVEL3_NAM ?? feature?.properties?.area;
		return typeof name === 'string' && name.length > 0 ? name : null;
	});

	// The tree is filtered by the same selection the map uses, so its headline count is already
	// the filtered one. What the panel adds is the unfiltered total, for context.
	const occurrenceFilter = fromStore(occurrenceFilterStore);
	const occurrence = $derived.by<{ status: string; regionTotal: number } | null>(() => {
		const { status } = occurrenceFilter.current;
		if (!status) return null;
		const total = feature?.properties?.unique_count;
		return { status, regionTotal: typeof total === 'number' ? total : 0 };
	});

	function handleClose() {
		goto(`${base}/map`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>{regionName ?? regionCode} | World Checklist of Food Plants</title>
</svelte:head>

{#snippet facetSlot()}
	<OccurrenceFacet
		facets={occurrenceFilter.current.facets}
		value={occurrenceFilter.current.status}
		onChange={setOccurrenceStatus}
		layout="chips"
	/>
{/snippet}

<SpeciesPanel {regionCode} {regionName} {occurrence} {facetSlot} onClose={handleClose} />
