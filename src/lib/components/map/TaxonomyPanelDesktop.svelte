<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { TaxonomyNodeNormalized, TaxonomyTreeIndex } from '$lib/types/taxonomy';
	import TaxonomyList from '$lib/components/visualization/TaxonomyList.svelte';
	import TaxonomySearchFilterBar from './TaxonomySearchFilterBar.svelte';
	import { ChevronLeft, ChevronRight, GripVertical, X } from 'lucide-svelte';
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

	const STORAGE_KEY = 'taxonomy-panel-width';
	const MIN_WIDTH = 300;
	const MAX_WIDTH = 800;
	const DEFAULT_WIDTH = 420;
	const COLLAPSED_WIDTH = 48;

	// Initialize width synchronously from localStorage (SSR-safe)
	function getInitialWidth(): number {
		if (typeof window === 'undefined') return DEFAULT_WIDTH;
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = parseInt(saved, 10);
			if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
				return parsed;
			}
		}
		return DEFAULT_WIDTH;
	}

	let panelWidth = $state(getInitialWidth());
	let isCollapsed = $state(false);
	let isResizing = $state(false);
	let isInitialLoad = $state(true);

	let displayWidth = $derived(isCollapsed ? COLLAPSED_WIDTH : panelWidth);

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

	// Mark initial load as complete after first render
	$effect(() => {
		if (isInitialLoad) {
			// Use a microtask to ensure this runs after the first render
			queueMicrotask(() => {
				isInitialLoad = false;
			});
		}
	});

	$effect(() => {
		if (!isCollapsed) {
			localStorage.setItem(STORAGE_KEY, panelWidth.toString());
		}
	});

	function startResize(e: MouseEvent) {
		e.preventDefault();
		isResizing = true;

		const startX = e.clientX;
		const startWidth = panelWidth;

		function onMouseMove(e: MouseEvent) {
			panelWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + e.clientX - startX));
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
</script>

<div
	class="relative flex h-full shrink-0 border-r border-slate-200 bg-white"
	style:width="{displayWidth}px"
	transition:fly={isInitialLoad ? undefined : { x: -displayWidth, duration: 300, easing: cubicOut }}
>
	{#if !isCollapsed}
		<button
			type="button"
			class="absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center bg-slate-100 hover:bg-sky-200"
			class:bg-sky-300={isResizing}
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
		<div class="flex h-full w-full flex-col items-center justify-center">
			<!-- Empty collapsed state - just shows collapse button -->
		</div>
		{:else}
		<div class="flex h-full w-full flex-col pr-2">
			{#if selectedNormalizedNode}
				<div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
					<div class="min-w-0 flex-1">
						<h2 class="truncate text-lg font-semibold text-slate-900">{selectedNormalizedNode.node.name}</h2>
						{#if selectedNormalizedNode}
							<p class="text-sm text-slate-600" transition:fade={{ duration: 150 }}>
								<span>{selectedNormalizedNode.node.rank || 'Selected'}</span>
								{#if distributionAreaCount > 0}
									<span> · present in {formatCount(distributionAreaCount)} {distributionAreaCount === 1 ? 'area' : 'areas'}</span>
								{/if}
							</p>
						{/if}
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

			<TaxonomySearchFilterBar
				{searchQuery}
				onSearchChange={(q) => (searchQuery = q)}
				{showOnlySpatial}
				onFilterChange={(show) => (showOnlySpatial = show)}
			/>
			<div class="flex-1 overflow-y-auto">
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
		{/if}
</div>
