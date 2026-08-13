<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { RegionFeatureCollection } from '$lib/stores/region-geometry';
	import { SpeciesPanel } from '$lib/components/species';

	const regionCode = $derived(page.params.region as string);

	// Look up the region name from the root layout's geojson payload — works SSR
	// and on the client, doesn't depend on store-priming order.
	const regionName = $derived.by<string | null>(() => {
		const geo = page.data.regionsGeoJSON as RegionFeatureCollection | undefined;
		if (!geo) return null;
		for (const feature of geo.features) {
			const props = feature.properties ?? {};
			const code = (props.LEVEL3_COD as string) ?? (props.code as string);
			if (code !== regionCode) continue;
			const name = (props.LEVEL3_NAM as string) ?? (props.area as string);
			return typeof name === 'string' && name.length > 0 ? name : null;
		}
		return null;
	});

	function handleClose() {
		goto(`${base}/map`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>{regionName ?? regionCode} | World Checklist of Food Plants</title>
</svelte:head>

{#if regionName}
	<SpeciesPanel selectedRegion={regionName} onClose={handleClose} />
{/if}
