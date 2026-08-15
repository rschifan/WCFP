<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { RegionFeature, RegionFeatureCollection } from '$lib/stores/region-geometry';
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

	function handleClose() {
		goto(`${base}/map`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>{regionName ?? regionCode} | World Checklist of Food Plants</title>
</svelte:head>

<SpeciesPanel {regionCode} {regionName} onClose={handleClose} />
