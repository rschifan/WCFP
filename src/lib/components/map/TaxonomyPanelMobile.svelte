<script lang="ts">
	import { fade } from 'svelte/transition';
	import { spring } from 'svelte/motion';
	import type { TaxonomyNodeNormalized, TaxonomyTreeIndex } from '$lib/types/taxonomy';
	import TaxonomyList from '$lib/components/visualization/TaxonomyList.svelte';
	import TaxonomySearchFilterBar from './TaxonomySearchFilterBar.svelte';
	import { ArrowLeft, ChevronDown } from 'lucide-svelte';
	import { formatCount } from '$lib/utils/format';

	interface Props {
		selectedNormalizedNode: { node: TaxonomyNodeNormalized; path: string } | null;
		normalizedData: TaxonomyTreeIndex;
		startFromId?: string;
		onNodeSelect: (node: TaxonomyNodeNormalized, path: string) => void;
		isNodeClickable: (node: TaxonomyNodeNormalized) => boolean;
		onClose?: () => void;
		distributionAreaCount?: number;
	}

	let {
		selectedNormalizedNode,
		normalizedData,
		startFromId,
		onNodeSelect,
		isNodeClickable,
		onClose,
		distributionAreaCount = 0
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

	// Search and filter state
	let searchQuery = $state('');
	let showOnlySpatial = $state(false);

	// Create filter function that uses isNodeClickable when showOnlySpatial is true
	const filterNodes = $derived.by(() => {
		if (showOnlySpatial && isNodeClickable) {
			return isNodeClickable;
		}
		return () => true; // Show all nodes when filter is off
	});

	// Extract selected node ID for passing to TaxonomyList
	const selectedNodeId = $derived(selectedNormalizedNode?.node.id);

	$effect(() => {
		if (!isDragging) {
			animatedHeight.set(POSITIONS[sheetPosition]);
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
		const newHeight = Math.min(POSITIONS.full, Math.max(POSITIONS.peek, startHeight + deltaPercent));
		animatedHeight.set(newHeight, { hard: true });
	}

	function endDrag() {
		if (!isDragging) return;
		isDragging = false;

		const currentHeight = $animatedHeight;
		const velocity = currentHeight - startHeight;

		// Find nearest snap position
		let nearest: SheetPosition = 'half';
		let minDistance = Infinity;
		for (const [pos, height] of Object.entries(POSITIONS) as [SheetPosition, number][]) {
			const distance = Math.abs(currentHeight - height);
			if (distance < minDistance) {
				minDistance = distance;
				nearest = pos;
			}
		}

		// Velocity-based override for quick swipes
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
</script>

{#if !isAtPeek}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
		onclick={onClose}
		transition:fade={{ duration: 200 }}
		aria-label="Close panel"
	></button>
{/if}

<div
	class="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl"
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
				class="mb-2 flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"
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
					<h2 class="truncate text-lg font-semibold text-slate-900">{selectedNormalizedNode.node.name}</h2>
					{#if selectedNormalizedNode}
						<p class="text-sm text-slate-600">
							<span>{selectedNormalizedNode.node.rank || 'Selected'}</span>
							{#if distributionAreaCount > 0}
								<span> · present in {formatCount(distributionAreaCount)} {distributionAreaCount === 1 ? 'area' : 'areas'}</span>
							{/if}
						</p>
					{/if}
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
		<TaxonomySearchFilterBar
			{searchQuery}
			onSearchChange={(q) => (searchQuery = q)}
			{showOnlySpatial}
			onFilterChange={(show) => (showOnlySpatial = show)}
		/>
		<div class="flex-1 overflow-y-auto overscroll-contain">
			<TaxonomyList
				data={normalizedData}
				{startFromId}
				onNodeSelect={onNodeSelect}
				{isNodeClickable}
				{searchQuery}
				{filterNodes}
				{selectedNodeId}
				class="h-full w-full"
			/>
		</div>
	</div>
</div>
