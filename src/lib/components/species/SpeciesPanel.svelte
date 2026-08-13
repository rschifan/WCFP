<script lang="ts">
	import { createRegionTaxonomySource } from '$lib/components/taxonomy-browser';
	import type { TaxonomyBrowserSource } from '$lib/types/taxonomy-browser';
	import SpeciesPanelView from './SpeciesPanelView.svelte';

	interface Props {
		selectedRegion: string | null;
		isMobile?: boolean;
		onClose?: () => void;
	}

	let { selectedRegion, isMobile = false, onClose }: Props = $props();

	const browserSource = $derived.by<TaxonomyBrowserSource | null>(() => {
		const region = selectedRegion?.trim();
		return region ? createRegionTaxonomySource(region) : null;
	});
</script>

<SpeciesPanelView {selectedRegion} {isMobile} {browserSource} {onClose} />
