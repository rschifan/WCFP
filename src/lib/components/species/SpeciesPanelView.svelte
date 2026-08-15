<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Inbox, X } from 'lucide-svelte';
	import { buildTaxonomyTraitBadges } from '$lib/components/hierarchy';
	import { TaxonomyBrowser } from '$lib/components/taxonomy-browser';
	import { formatCount } from '$lib/utils/format';
	import type { TaxonomyBrowserSource, TaxonomyBrowserSummary } from '$lib/types/taxonomy-browser';
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
	import type { HierarchyEntryBadge } from '$lib/types/hierarchy';

	// On desktop (≥768px) the panel is a sidebar — grow its width so the map
	// reflows smoothly. On mobile it's a bottom sheet — slide up + fade.
	function panelTransition(node: HTMLElement) {
		const isDesktop =
			typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
		if (isDesktop) {
			const width = node.getBoundingClientRect().width || 416;
			return {
				duration: 220,
				easing: cubicOut,
				css: (t: number) =>
					`width: ${t * width}px; min-width: 0; overflow: hidden; opacity: ${0.6 + t * 0.4};`
			};
		}
		return fly(node, { y: 24, duration: 200, easing: cubicOut });
	}

	interface Props {
		regionName: string | null;
		browserSource: TaxonomyBrowserSource | null;
		onClose?: () => void;
	}

	let {
		regionName,
		browserSource,
		onClose
	}: Props = $props();

	let browserSummary = $state<TaxonomyBrowserSummary>({
		totalSpeciesCount: 0,
		visibleSpeciesCount: 0,
		hasActiveQuery: false
	});

	const totalSpeciesCount = $derived(browserSummary.totalSpeciesCount);
	const visibleSpeciesCount = $derived(browserSummary.visibleSpeciesCount);

	function handleBrowserSummaryChange(summary: TaxonomyBrowserSummary) {
		browserSummary = summary;
	}

	function getNodeBadges(node: TaxonomyNodeNormalized): readonly HierarchyEntryBadge[] {
		if (node.rank !== 'species') {
			return [];
		}

		return buildTaxonomyTraitBadges(node.traits, {
			idPrefix: `region:${node.path ?? node.id}`,
			showLifeformLabel: true
		});
	}

	function getSpeciesDetailSource(node: TaxonomyNodeNormalized) {
		if (node.rank !== 'species' || typeof node.wcfpId !== 'number') {
			return null;
		}

		return { wcfpId: node.wcfpId };
	}
</script>

{#snippet emptyState()}
	<div class="flex h-48 items-center justify-center px-6 text-center" transition:fade={{ duration: 150 }}>
		<div>
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
				<Inbox class="h-8 w-8 text-slate-400" strokeWidth={1.5} />
			</div>
			<p class="mt-4 font-semibold text-slate-700">No species data available</p>
			<p class="mt-2 text-sm text-slate-500">Choose a region on the map to browse its species.</p>
		</div>
	</div>
{/snippet}

{#if regionName}
	{#if onClose}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
			onclick={onClose}
			transition:fade={{ duration: 150 }}
			aria-label="Close panel"
		></button>
	{/if}

	<section
		class="fixed inset-x-0 bottom-0 z-50 flex h-[72vh] max-h-[92vh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl md:relative md:inset-auto md:z-auto md:h-full md:w-[26rem] md:max-w-[42vw] md:rounded-none md:border-0 md:border-r md:border-slate-200 md:shadow-none"
		role="complementary"
		aria-label="Species panel"
		transition:panelTransition
	>
		<div class="shrink-0 border-b border-slate-200 bg-white">
			<div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
				<h2 class="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
					{regionName}
					{#if totalSpeciesCount > 0}
						<span class="ml-1 text-sm font-normal text-slate-500">
							{#if browserSummary.hasActiveQuery && visibleSpeciesCount !== totalSpeciesCount}
								· <span class="app-accent-text font-medium">{formatCount(visibleSpeciesCount)}</span> of {formatCount(totalSpeciesCount)} taxa
							{:else}
								· {formatCount(totalSpeciesCount)} taxa
							{/if}
						</span>
					{/if}
				</h2>

				{#if onClose}
					<button
						type="button"
						onclick={onClose}
						class="-mr-1 shrink-0 self-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
						aria-label="Close panel"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			{#if browserSource}
				<TaxonomyBrowser
					source={browserSource}
					showStartNode={false}
					showGeographicFilter={false}
					searchPlaceholder="Search"
					emptyMessage="No matching taxonomy nodes found."
					getNodeBadges={getNodeBadges}
					getSpeciesDetailSource={getSpeciesDetailSource}
					onSummaryChange={handleBrowserSummaryChange}
				/>
			{:else}
				{@render emptyState()}
			{/if}
		</div>
	</section>
{/if}
