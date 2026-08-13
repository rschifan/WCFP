<script lang="ts">
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
	import type { TaxonomyBrowserSource, TaxonomyBrowserSummary } from '$lib/types/taxonomy-browser';
	import TaxonomyPanelDesktop from './TaxonomyPanelDesktop.svelte';
	import TaxonomyPanelMobile from './TaxonomyPanelMobile.svelte';

	interface Props {
		isMobile: boolean;
		mode?: 'standalone' | 'detail';
		selectedNormalizedNode: { node: TaxonomyNodeNormalized; path: string } | null;
		source: TaxonomyBrowserSource;
		onNodeSelect: (node: TaxonomyNodeNormalized, path: string) => void;
		isNodeClickable: (node: TaxonomyNodeNormalized) => boolean;
		onClose?: () => void;
		distributionAreaCount?: number;
		onSummaryChange?: (summary: TaxonomyBrowserSummary) => void;
	}

	let {
		isMobile,
		mode = 'detail',
		selectedNormalizedNode,
		source,
		onNodeSelect,
		isNodeClickable,
		onClose,
		distributionAreaCount = 0,
		onSummaryChange
	}: Props = $props();
</script>

{#if isMobile}
	<TaxonomyPanelMobile
		{mode}
		{selectedNormalizedNode}
		{source}
		{onNodeSelect}
		{isNodeClickable}
		{onClose}
		{distributionAreaCount}
		{onSummaryChange}
	/>
{:else}
	<TaxonomyPanelDesktop
		{mode}
		{selectedNormalizedNode}
		{source}
		{onNodeSelect}
		{isNodeClickable}
		{onClose}
		{distributionAreaCount}
		{onSummaryChange}
	/>
{/if}
