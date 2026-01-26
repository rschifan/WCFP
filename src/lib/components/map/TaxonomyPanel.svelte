<script lang="ts">
	import type { TaxonomyNodeNormalized, TaxonomyTreeIndex } from '$lib/types/taxonomy';
	import TaxonomyPanelDesktop from './TaxonomyPanelDesktop.svelte';
	import TaxonomyPanelMobile from './TaxonomyPanelMobile.svelte';

	interface Props {
		isMobile: boolean;
		selectedNormalizedNode: { node: TaxonomyNodeNormalized; path: string } | null;
		normalizedData: TaxonomyTreeIndex;
		startFromId?: string;
		onNodeSelect: (node: TaxonomyNodeNormalized, path: string) => void;
		isNodeClickable: (node: TaxonomyNodeNormalized) => boolean;
		onClose?: () => void;
		distributionAreaCount?: number;
	}

	let {
		isMobile,
		selectedNormalizedNode,
		normalizedData,
		startFromId,
		onNodeSelect,
		isNodeClickable,
		onClose,
		distributionAreaCount = 0
	}: Props = $props();
</script>

{#if isMobile}
	<TaxonomyPanelMobile
		{selectedNormalizedNode}
		{normalizedData}
		{startFromId}
		{onNodeSelect}
		{isNodeClickable}
		{onClose}
		{distributionAreaCount}
	/>
{:else}
	<TaxonomyPanelDesktop
		{selectedNormalizedNode}
		{normalizedData}
		{startFromId}
		{onNodeSelect}
		{isNodeClickable}
		{onClose}
		{distributionAreaCount}
	/>
{/if}
