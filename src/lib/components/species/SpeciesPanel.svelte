<script lang="ts">
	import { createRegionTaxonomySource } from '$lib/components/taxonomy-browser';
	import type { TaxonomyBrowserSource } from '$lib/types/taxonomy-browser';
	import SpeciesPanelView from './SpeciesPanelView.svelte';

	interface Props {
		/** TDWG Level-3 code — the region identifier used by the API. */
		regionCode: string | null;
		/** Display label for the heading. */
		regionName: string | null;
		/** Active occurrence filter, if any — narrows the tree and is shown in the header. */
		occurrence?: { status: string; regionTotal: number } | null;
		facetSlot?: import('svelte').Snippet;
		isMobile?: boolean;
		onClose?: () => void;
	}

	let {
		regionCode,
		regionName,
		occurrence = null,
		facetSlot,
		isMobile = false,
		onClose
	}: Props = $props();

	// Rebuilding the source on a status change is what makes the whole tree — bootstrap and
	// every lazily-loaded child — honour the filter.
	const browserSource = $derived.by<TaxonomyBrowserSource | null>(() => {
		const code = regionCode?.trim();
		return code ? createRegionTaxonomySource(code, occurrence?.status ?? null) : null;
	});
</script>

<SpeciesPanelView {regionName} {occurrence} {facetSlot} {isMobile} {browserSource} {onClose} />
