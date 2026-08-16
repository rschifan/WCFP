<script lang="ts">
	/**
	 * The standalone taxonomy browser.
	 *
	 * Opening a taxon is the list's job — `TaxonomyList` owns the scheda dialog, so this view and
	 * the region panel behave identically without either of them wiring it up. What is left here
	 * is the panel and which node it shows as selected.
	 */
	import { createGlobalTaxonomySource } from '$lib/components/taxonomy-browser';
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
	import TaxonomyPanel from './TaxonomyPanel.svelte';

	type Selection = { node: TaxonomyNodeNormalized; path: string };

	interface Props {
		isMobile?: boolean;
		class?: string;
	}

	let { isMobile = false, class: className = '' }: Props = $props();

	const taxonomySource = createGlobalTaxonomySource();

	let selectedNormalizedNode = $state<Selection | null>(null);

	const distributionAreaCount = $derived(selectedNormalizedNode?.node.distributionAreaCount ?? 0);

	function isNodeClickable(node: TaxonomyNodeNormalized): boolean {
		return node.hasDistribution === true;
	}

	function handleNodeClick(node: TaxonomyNodeNormalized, path: string): void {
		if (!isNodeClickable(node)) {
			return;
		}

		selectedNormalizedNode = { node, path };
	}
</script>

<div class="relative h-full w-full bg-white {className}">
	<TaxonomyPanel
		{isMobile}
		mode="standalone"
		{selectedNormalizedNode}
		source={taxonomySource}
		onNodeSelect={handleNodeClick}
		{isNodeClickable}
		{distributionAreaCount}
	/>
</div>
