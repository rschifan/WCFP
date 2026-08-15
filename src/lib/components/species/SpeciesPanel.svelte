<script lang="ts">
	import { createRegionTaxonomySource } from '$lib/components/taxonomy-browser';
	import type { TaxonomyBrowserSource } from '$lib/types/taxonomy-browser';
	import SpeciesPanelView from './SpeciesPanelView.svelte';

	interface Props {
		/** TDWG Level-3 code — the region identifier used by the API. */
		regionCode: string | null;
		/** Display label for the heading. */
		regionName: string | null;
		/** Active map occurrence filter, if any — shown alongside the total. */
		occurrence?: { status: string; count: number } | null;
		isMobile?: boolean;
		onClose?: () => void;
	}

	let { regionCode, regionName, occurrence = null, isMobile = false, onClose }: Props = $props();

	const browserSource = $derived.by<TaxonomyBrowserSource | null>(() => {
		const code = regionCode?.trim();
		return code ? createRegionTaxonomySource(code) : null;
	});
</script>

<SpeciesPanelView {regionName} {occurrence} {isMobile} {browserSource} {onClose} />
