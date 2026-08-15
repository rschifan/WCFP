<script lang="ts">
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { buildRootPaletteCss } from '$lib/constants/palette';
	import type { RegionFeatureCollection } from '$lib/stores/region-geometry';
	import { primeRegionGeometryStore } from '$lib/stores/region-geometry';

	let {
		children,
		data
	}: {
		children: Snippet;
		data: { regionsGeoJSON: RegionFeatureCollection };
	} = $props();
	const rootPaletteCss = buildRootPaletteCss().trim();

	if (!rootPaletteCss) {
		throw new Error('Palette CSS must not be empty.');
	}

	$effect(() => {
		if (!browser || !data?.regionsGeoJSON) {
			return;
		}

		primeRegionGeometryStore(data.regionsGeoJSON);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<style>{rootPaletteCss}</style>
</svelte:head>
{@render children()}
