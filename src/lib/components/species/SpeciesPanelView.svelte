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
		occurrence?: { status: string; count: number } | null;
		isMobile?: boolean;
		browserSource: TaxonomyBrowserSource | null;
		onClose?: () => void;
	}

	let {
		regionName,
		occurrence = null,
		isMobile: _isMobile = false,
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
		<div class="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
			<div class="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
				<div class="min-w-0 flex-1">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Region</p>
					<h2 class="mt-1 truncate text-lg font-semibold text-slate-900">{regionName}</h2>
					{#if totalSpeciesCount > 0}
						<p class="mt-1 text-sm text-slate-600">
							{#if browserSummary.hasActiveQuery && visibleSpeciesCount !== totalSpeciesCount}
								<span class="app-accent-text font-medium">{formatCount(visibleSpeciesCount)}</span> of {formatCount(totalSpeciesCount)} taxa
							{:else}
								{formatCount(totalSpeciesCount)} taxa found
							{/if}
						</p>
						{#if occurrence}
							<p class="mt-0.5 text-xs text-slate-500">
								{formatCount(occurrence.count)} recorded as {occurrence.status}
							</p>
						{/if}
					{/if}
				</div>

				{#if onClose}
					<button
						type="button"
						onclick={onClose}
						class="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
						aria-label="Close panel"
					>
						<X class="h-5 w-5" />
					</button>
				{/if}
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			{#if browserSource}
				<TaxonomyBrowser
					source={browserSource}
					showStartNode={false}
					searchPlaceholder="Search families, genera, or species..."
					emptyMessage="No matching taxonomy nodes found."
					getNodeBadges={getNodeBadges}
					getSpeciesDetailSource={getSpeciesDetailSource}
					onSummaryChange={handleBrowserSummaryChange}
					class="h-full w-full"
				/>
			{:else}
				{@render emptyState()}
			{/if}
		</div>
	</section>
{/if}
