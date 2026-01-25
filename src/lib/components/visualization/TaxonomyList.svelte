<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { getRankColor, getRankLabel } from '$lib/constants/tree';
	import { Search, X, SquareArrowOutUpRight } from 'lucide-svelte';
	import type { TaxonomyNodeNormalized, TaxonomyTreeIndex } from '$lib/types/taxonomy';
	import { TaxonomySearchIndex } from '$lib/utils/taxonomy/search';

	interface Props {
		data: TaxonomyTreeIndex;
		startFromId?: string;
		initialExpandedDepth?: number;
		onNodeSelect?: (node: TaxonomyNodeNormalized, path: string) => void;
		class?: string;
		/** Function to check if a node is clickable */
		isNodeClickable?: (node: TaxonomyNodeNormalized) => boolean;
	}

	let {
		data,
		startFromId,
		initialExpandedDepth = 0,
		onNodeSelect,
		class: className = '',
		isNodeClickable
	}: Props = $props();

	const rootId = $derived(startFromId ?? data.rootId);
	const nodesById = $derived(data.nodesById);
	const searchIndex = $derived(new TaxonomySearchIndex(nodesById));
	
	let expandedNodes = new SvelteSet<string>();
	let selectedId = $state<string | null>(null);
	let searchQuery = $state('');
	let debouncedQuery = $state('');

	const searchTerm = $derived(debouncedQuery.trim().toLowerCase());
	const isSearching = $derived(searchTerm.length > 0);
	const MAX_VISIBLE_RESULTS = 500;

	$effect(() => {
		const currentQuery = searchQuery;
		const handle = setTimeout(() => {
			debouncedQuery = currentQuery;
		}, 200);
		return () => clearTimeout(handle);
	});

	const searchResult = $derived.by(() => {
		if (!searchTerm) return null;

		const matchedNodeIds = searchIndex.smartSearch(searchTerm);
		if (matchedNodeIds.size === 0) {
			return { childrenById: new Map<string, string[]>(), expanded: new Set<string>(), hasMatches: false };
		}

		const visibleSet = new Set<string>();
		
		// Build visible set with matched nodes and ancestors
		for (const nodeId of matchedNodeIds) {
			visibleSet.add(nodeId);
			const ancestors = searchIndex.getAncestors(nodeId);
			for (const ancestorId of ancestors) {
				visibleSet.add(ancestorId);
			}
			if (visibleSet.size > MAX_VISIBLE_RESULTS) break;
		}

		const childrenById: Map<string, string[]> = new Map();
		const expanded = new Set<string>();

		for (const nodeId of visibleSet) {
			const node = nodesById.get(nodeId);
			if (!node) continue;

			const filteredChildren = node.childrenIds.filter((childId) => visibleSet.has(childId));
			if (filteredChildren.length > 0) {
				childrenById.set(nodeId, filteredChildren);
				expanded.add(nodeId);
			}
		}

		return { childrenById, expanded, hasMatches: true };
	});

	$effect(() => {
		const root = rootId;
		expandedNodes.clear();
		if (initialExpandedDepth >= 0) {
			expandToDepth(root, 0, initialExpandedDepth);
		}
	});

	function expandToDepth(nodeId: string, currentDepth: number, maxDepth: number) {
		const node = nodesById.get(nodeId);
		if (!node || currentDepth > maxDepth) return;
		expandedNodes.add(nodeId);
		for (const childId of node.childrenIds) {
			expandToDepth(childId, currentDepth + 1, maxDepth);
		}
	}

	function getChildrenIds(nodeId: string): string[] {
		if (searchResult) {
			return searchResult.childrenById.get(nodeId) ?? [];
		}
		return nodesById.get(nodeId)?.childrenIds ?? [];
	}

	function isExpandedEffective(nodeId: string): boolean {
		return searchResult ? searchResult.expanded.has(nodeId) : expandedNodes.has(nodeId);
	}

	function splitByMatch(text: string, query: string): Array<{ text: string; isMatch: boolean }> {
		if (!query.trim()) return [{ text, isMatch: false }];
		const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escapedQuery})`, 'gi');
		const parts = text.split(regex);
		
		return parts
			.map((part, index) => ({ text: part, isMatch: index % 2 === 1 }))
			.filter((item) => item.text !== '');
	}

	function toggleExpanded(nodeId: string, event: Event) {
		event.stopPropagation();
		const wasExpanded = expandedNodes.has(nodeId);
		if (wasExpanded) {
			expandedNodes.delete(nodeId);
			console.log('[TaxonomyList] Collapsed node:', nodeId);
		} else {
			expandedNodes.add(nodeId);
			console.log('[TaxonomyList] Expanded node:', nodeId, 'expandedNodes size:', expandedNodes.size);
		}
	}

	function selectNode(node: TaxonomyNodeNormalized, nodeId: string) {
		selectedId = nodeId;
		onNodeSelect?.(node, node.path ?? nodeId);
	}

	function handleKeyDown(event: KeyboardEvent, nodeId: string, hasKids: boolean) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (hasKids && !isSearching) toggleExpanded(nodeId, event);
			// Navigation always works - don't call selectNode here
			// Map icon button handles selection for nodes with spatial data
		} else if (event.key === 'ArrowRight' && hasKids && !isExpandedEffective(nodeId) && !isSearching) {
			event.preventDefault();
			expandedNodes.add(nodeId);
		} else if (event.key === 'ArrowLeft' && isExpandedEffective(nodeId) && !isSearching) {
			event.preventDefault();
			expandedNodes.delete(nodeId);
		}
	}

</script>

{#snippet highlightedText(text: string, query: string)}
	{#each splitByMatch(text, query) as part, i (i)}
		{#if part.isMatch}
			<mark class="bg-amber-200 text-amber-900 rounded px-0.5">{part.text}</mark>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

	{#snippet nodeItem(nodeId: string, depth: number)}
	{@const node = nodesById.get(nodeId)}
	{#if node}
		{@const childIds = getChildrenIds(nodeId)}
		{@const hasKids = childIds.length > 0}
		{@const expanded = isExpandedEffective(nodeId)}
		{@const selected = selectedId === nodeId}
		{@const rankColor = getRankColor(node.rank)}
		{@const isClickable = isNodeClickable ? (() => {
			try {
				return isNodeClickable(node);
			} catch (err) {
				console.warn('[TaxonomyList] Error checking node clickability:', err);
				return false;
			}
		})() : false}

		<li
			class="m-0 list-none p-0"
			role="treeitem"
			aria-expanded={hasKids ? expanded : undefined}
			aria-selected={selected}
		>
			<div
				class="flex w-full items-start gap-2 px-2 py-2 transition-colors duration-150 {hasKids ? 'hover:bg-black/[0.04] active:bg-black/[0.08]' : ''} {selected ? 'bg-blue-500/10' : ''}"
				style:padding-left="{12 + depth * 16}px"
			>
				<!-- Navigation Button (expand/collapse) -->
				<button
					type="button"
					class="flex flex-1 items-start gap-2 border-none bg-transparent text-left min-w-0 relative z-10 {hasKids ? 'cursor-pointer' : 'cursor-default'}"
					onclick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						// Always allow navigation (expand/collapse) if node has children
						if (hasKids && !isSearching) {
							toggleExpanded(nodeId, event);
						}
					}}
					onkeydown={(e) => handleKeyDown(e, nodeId, hasKids)}
					aria-disabled={!hasKids || isSearching}
				>
					<!-- Expand/Collapse Chevron -->
					<div
						class="flex shrink-0 items-center justify-center w-5 h-5 mt-0.5 text-gray-400 {!hasKids ? 'invisible' : ''}"
					>
						<svg
							class="w-4 h-4 transition-transform duration-200 motion-reduce:transition-none {expanded ? 'rotate-90' : ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</div>

					<!-- Main Content -->
					<div class="flex-1 min-w-0">
						<!-- First Line: Name with Rank Dot -->
						<div class="flex items-center gap-2 mb-1">
							<span class="w-2.5 h-2.5 shrink-0 rounded-full" style:background-color={rankColor}></span>
							<span class="text-sm font-semibold text-gray-900 truncate">
								{#if isSearching}
									{@render highlightedText(node.name, debouncedQuery)}
								{:else}
									{node.name}
								{/if}
							</span>
						</div>

						<!-- Second Line: Rank Label and Actions -->
						<div class="flex items-center gap-2 ml-4.5">
							<span class="text-xs text-gray-500 capitalize">
								{getRankLabel(node.rank)}
							</span>
							{#if hasKids}
								<span class="text-xs text-gray-400">•</span>
								<span class="text-xs text-gray-500">
									{childIds.length} {childIds.length === 1 ? 'child' : 'children'}
								</span>
							{/if}
						</div>
					</div>
				</button>

				<!-- Map Icon Button (if clickable) - separate from navigation button -->
				{#if isClickable}
					<button
						type="button"
						class="flex shrink-0 items-center justify-center w-8 h-8 mt-0.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-gray-500 focus-visible:-outline-offset-2"
						title="View spatial distribution map"
						aria-label="View spatial distribution map for {node.name}"
						onclick={(event) => {
							event.stopPropagation();
							selectNode(node, nodeId);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								e.stopPropagation();
								selectNode(node, nodeId);
							}
						}}
					>
						<SquareArrowOutUpRight class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
			</div>

			{#if hasKids && expanded}
				<ul class="m-0 list-none p-0" role="group" transition:slide={{ duration: 200 }}>
					{#each childIds as childId (childId)}
						{@render nodeItem(childId, depth + 1)}
					{/each}
				</ul>
			{/if}
		</li>
	{/if}
{/snippet}

<div class="flex h-full flex-col overflow-hidden bg-slate-50 {className}">
	<div class="sticky top-0 z-10 bg-white px-3 py-2">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search"
				class="text-black w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-10 text-sm transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					aria-label="Clear search"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if isSearching && searchResult && !searchResult.hasMatches}
		<div class="flex flex-1 items-center justify-center text-sm text-slate-500">
			No results found
		</div>
	{:else}
		<ul class="m-0 flex-1 list-none overflow-y-auto overflow-x-hidden py-1" role="tree" aria-label="Taxonomy hierarchy">
			{@render nodeItem(rootId, 0)}
		</ul>
	{/if}
</div>
