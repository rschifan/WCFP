<script lang="ts">
	import type {
		TaxonomyNodeNormalized
	} from '$lib/types/taxonomy';
	import type { TaxonomyBrowserSource, TaxonomyBrowserSummary } from '$lib/types/taxonomy-browser';
	import { buildTaxonomyTraitBadges, SHARED_TRAIT_BADGE_LEVELS } from '$lib/components/hierarchy';
	import { TaxonomyBrowser } from '$lib/components/taxonomy-browser';
	import { ChevronLeft, ChevronRight, GripVertical, X } from 'lucide-svelte';
	import { formatCount } from '$lib/utils/format';

	interface Props {
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
		mode = 'detail',
		selectedNormalizedNode,
		source,
		onNodeSelect,
		isNodeClickable,
		onClose,
		distributionAreaCount = 0,
		onSummaryChange
	}: Props = $props();

	const STORAGE_KEY = 'taxonomy-panel-width';
	const MIN_WIDTH = 300;
	const MAX_WIDTH = 800;
	const DEFAULT_WIDTH = 420;
	const COLLAPSED_WIDTH = 48;

	function getInitialWidth(): number {
		if (typeof window === 'undefined') return DEFAULT_WIDTH;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = parseInt(saved, 10);
				if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
					return parsed;
				}
			}
		} catch {
			// localStorage unavailable
		}
		return DEFAULT_WIDTH;
	}

	let panelWidth = $state(getInitialWidth());
	let isCollapsed = $state(false);
	let isResizing = $state(false);

	let displayWidth = $derived(isCollapsed ? COLLAPSED_WIDTH : panelWidth);
	const selectedNodeId = $derived(selectedNormalizedNode?.node.id);

	$effect(() => {
		if (mode === 'detail' && !isCollapsed) {
			try {
				localStorage.setItem(STORAGE_KEY, panelWidth.toString());
			} catch {
				// localStorage unavailable
			}
		}
	});

	function startResize(e: MouseEvent) {
		e.preventDefault();
		isResizing = true;

		const startX = e.clientX;
		const startWidth = panelWidth;

		function onMouseMove(event: MouseEvent) {
			panelWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + event.clientX - startX));
		}

		function onMouseUp() {
			isResizing = false;
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
	}

	function getNodeBadges(node: TaxonomyNodeNormalized) {
		if (!SHARED_TRAIT_BADGE_LEVELS.includes(node.rank)) {
			return [];
		}

		return buildTaxonomyTraitBadges(node.traits, {
			idPrefix: `taxonomy:${node.path ?? node.id}`,
			showLifeformLabel: node.rank === 'species'
		});
	}
</script>

{#if mode === 'standalone'}
	<div class="h-full w-full bg-white">
		<div class="flex h-full w-full min-w-0 flex-col bg-white">
			<div class="border-b border-slate-200 px-4 py-4">
				<h2 class="text-xl font-semibold text-slate-900">Browse Taxonomy</h2>
				<p class="mt-1 text-sm text-slate-600">Select a taxon to view its geographic distribution.</p>
			</div>

			<TaxonomyBrowser
				{source}
				{onNodeSelect}
				{isNodeClickable}
				{selectedNodeId}
				{getNodeBadges}
				{onSummaryChange}
				class="h-full w-full"
			/>
		</div>
	</div>
{:else}
	<div
		class="relative flex h-full shrink-0 border-r border-slate-200 bg-white"
		style:width="{displayWidth}px"
	>
		{#if !isCollapsed}
			<button
				type="button"
				class="app-accent-surface-hover absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center bg-slate-100"
				class:app-accent-surface-active={isResizing}
				onmousedown={startResize}
				aria-label="Resize panel"
			>
				<div
					class="flex h-12 w-full items-center justify-center rounded-l opacity-0 transition-opacity hover:opacity-100"
					class:opacity-100={isResizing}
				>
					<GripVertical class="h-4 w-4 text-slate-400" />
				</div>
			</button>
		{/if}

		<button
			type="button"
			onclick={toggleCollapse}
			class="absolute top-1/2 -right-3 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50"
			aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
		>
			{#if isCollapsed}
				<ChevronRight class="h-4 w-4 text-slate-600" />
			{:else}
				<ChevronLeft class="h-4 w-4 text-slate-600" />
			{/if}
		</button>

		{#if isCollapsed}
			<div class="flex h-full w-full flex-col items-center justify-center"></div>
		{:else}
			<div class="flex h-full w-full flex-col pr-2">
				{#if selectedNormalizedNode}
					<div
						class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3"
					>
						<div class="min-w-0 flex-1">
							<h2 class="truncate text-lg font-semibold text-slate-900">
								{selectedNormalizedNode.node.name}
							</h2>
							<p class="text-sm text-slate-600">
								<span>{selectedNormalizedNode.node.rank || 'Selected'}</span>
								{#if distributionAreaCount > 0}
									<span>
										· present in {formatCount(distributionAreaCount)}
										{distributionAreaCount === 1 ? 'area' : 'areas'}</span
									>
								{/if}
							</p>
						</div>

						{#if onClose}
							<button
								type="button"
								onclick={onClose}
								class="shrink-0 rounded-lg p-2 text-slate-400 transition-all duration-150 hover:rotate-90 hover:bg-slate-200 hover:text-slate-600"
								aria-label="Close panel"
							>
								<X class="h-5 w-5" />
							</button>
						{/if}
					</div>
				{/if}

				<TaxonomyBrowser
					{source}
					{onNodeSelect}
					{isNodeClickable}
					{selectedNodeId}
					{getNodeBadges}
					{onSummaryChange}
					class="h-full w-full"
				/>

			</div>
		{/if}
	</div>
{/if}
