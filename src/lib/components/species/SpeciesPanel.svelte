<script lang="ts">
	import { fromStore } from 'svelte/store';
	import { createRegionTaxonomySource } from '$lib/components/taxonomy-browser';
	import { occurrenceFilterStore } from '$lib/stores/occurrence-filter';
	import type { TaxonomyBrowserSource } from '$lib/types/taxonomy-browser';
	import SpeciesPanelView from './SpeciesPanelView.svelte';

	interface Props {
		/** TDWG Level-3 code — the region identifier used by the API. */
		regionCode: string | null;
		/** Display label for the heading. */
		regionName: string | null;
		onClose?: () => void;
	}

	let {
		regionCode,
		regionName,
		onClose
	}: Props = $props();

	const occurrence = fromStore(occurrenceFilterStore);

	const browserSource = $derived.by<TaxonomyBrowserSource | null>(() => {
		const code = regionCode?.trim();
		return code ? createRegionTaxonomySource(code, occurrence.current.status) : null;
	});
</script>

<SpeciesPanelView {regionName} {browserSource} {onClose} />
