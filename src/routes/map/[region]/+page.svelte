<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { RegionFeatureCollection } from '$lib/stores/region-geometry';
	import { SpeciesPanel } from '$lib/components/species';

	const regionCode = $derived(page.params.region as string);

	// The code is the identifier and goes straight to the API. The name is only a label for
	// the heading, resolved from the geojson the root layout has already loaded.
	const regionName = $derived.by<string | null>(() => {
		const geo = page.data.regionsGeoJSON as RegionFeatureCollection | undefined;
		const feature = geo?.features.find(
			(f) => (f.properties?.LEVEL3_COD ?? f.properties?.code) === regionCode
		);
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
