<script lang="ts">
	import { spring } from 'svelte/motion';
	import type {
		TaxonomyNodeNormalized
	} from '$lib/types/taxonomy';
	import type { TaxonomyBrowserSource, TaxonomyBrowserSummary } from '$lib/types/taxonomy-browser';
	import { buildTaxonomyTraitBadges, SHARED_TRAIT_BADGE_LEVELS } from '$lib/components/hierarchy';
	import { TaxonomyBrowser } from '$lib/components/taxonomy-browser';
	import { ArrowLeft, ChevronDown } from 'lucide-svelte';
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

	type SheetPosition = 'peek' | 'half' | 'full';

	const POSITIONS: Record<SheetPosition, number> = {
		peek: 15,
		half: 50,
		full: 92
	};

	let sheetPosition = $state<SheetPosition>('half');
	let isDragging = $state(false);
	let startY = $state(0);
	let startHeight = $state(0);

	let animatedHeight = spring(POSITIONS.half, { stiffness: 0.2, damping: 0.8 });
	let isAtPeek = $derived(sheetPosition === 'peek');
	let isAtFull = $derived(sheetPosition === 'full');
	let lastSelectedPath = $state<string | null>(null);
	const selectedNodeId = $derived(selectedNormalizedNode?.node.id);

	$effect(() => {
		if (!isDragging) {
			animatedHeight.set(POSITIONS[sheetPosition]);
		}
	});

	$effect(() => {
		const currentPath = mode === 'detail' ? (selectedNormalizedNode?.path ?? null) : null;
		if (currentPath !== lastSelectedPath) {
			lastSelectedPath = currentPath;
			if (currentPath) {
				sheetPosition = 'half';
			}
		}
	});

	function startDrag(clientY: number) {
		isDragging = true;
		startY = clientY;
		startHeight = $animatedHeight;
	}

	function moveDrag(clientY: number) {
		if (!isDragging) return;
		const deltaPercent = ((startY - clientY) / window.innerHeight) * 100;
		const newHeight = Math.min(
			POSITIONS.full,
			Math.max(POSITIONS.peek, startHeight + deltaPercent)
		);
		animatedHeight.set(newHeight, { hard: true });
	}

	function endDrag() {
		if (!isDragging) return;
		isDragging = false;

		const currentHeight = $animatedHeight;
		const velocity = currentHeight - startHeight;

		let nearest: SheetPosition = 'half';
		let minDistance = Infinity;
		for (const [position, height] of Object.entries(POSITIONS) as [SheetPosition, number][]) {
			const distance = Math.abs(currentHeight - height);
			if (distance < minDistance) {
				minDistance = distance;
				nearest = position;
			}
		}

		if (Math.abs(velocity) > 10) {
			if (velocity > 0 && sheetPosition !== 'full') {
				nearest = sheetPosition === 'peek' ? 'half' : 'full';
			} else if (velocity < 0 && sheetPosition !== 'peek') {
				nearest = sheetPosition === 'full' ? 'half' : 'peek';
			}
		}

		sheetPosition = nearest;
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches[0]) startDrag(e.touches[0].clientY);
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches[0]) moveDrag(e.touches[0].clientY);
	}

	function handleMouseDown(e: MouseEvent) {
		startDrag(e.clientY);
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		moveDrag(e.clientY);
	}

	function handleMouseUp() {
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		endDrag();
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
	<div class="flex h-full w-full flex-col bg-white">
		<div class="border-b border-slate-200 px-4 py-4">
			<h2 class="text-xl font-semibold text-slate-900">Browse Taxonomy</h2>
			<p class="mt-1 text-sm text-slate-600">Select a taxon to view its geographic distribution.</p>
		</div>

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
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
	{#if !isAtPeek}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
			onclick={onClose}
			aria-label="Close panel"
		></button>
	{/if}

	<div
		class="fixed right-0 bottom-0 left-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl"
		style:height="{$animatedHeight}vh"
		style:max-height="92vh"
	>
		<div
			class="flex shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={endDrag}
			onmousedown={handleMouseDown}
			role="slider"
			aria-label="Drag to resize"
			aria-valuenow={$animatedHeight}
			tabindex="0"
		>
			<div class="h-1 w-10 rounded-full bg-slate-300"></div>
		</div>

		{#if isAtFull}
			<div class="shrink-0 border-b border-slate-200 px-4 pb-3">
				<button
					type="button"
					onclick={() => (sheetPosition = 'half')}
					class="app-accent-text app-accent-text-hover mb-2 flex items-center gap-1 text-sm"
				>
					<ArrowLeft class="h-4 w-4" />
					<span>Back to Map</span>
				</button>
			</div>
		{/if}

		{#if selectedNormalizedNode}
			<div class="shrink-0 border-b border-slate-200 px-4 pb-3">
				<div class="flex items-center justify-between">
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

					{#if isAtPeek}
						<button
							type="button"
							onclick={() => (sheetPosition = 'full')}
							class="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
						>
							<ChevronDown class="h-4 w-4 rotate-180" />
							<span>View</span>
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<div class="flex flex-1 flex-col overflow-hidden">
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
{/if}
