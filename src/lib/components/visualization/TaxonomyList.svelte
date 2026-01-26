<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getRankLabel } from '$lib/constants/tree';
	import { Search, X, ChevronRight, SquareArrowOutUpRight } from 'lucide-svelte';
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
		/** Optional external search query (if provided, uses this instead of internal state) */
		searchQuery?: string;
		/** Optional filter function to filter nodes (returns true to show node) */
		filterNodes?: (node: TaxonomyNodeNormalized) => boolean;
		/** Optional selected node ID for external selection highlighting */
		selectedNodeId?: string;
	}

	let {
		data,
		startFromId,
		initialExpandedDepth = 0,
		onNodeSelect,
		class: className = '',
		isNodeClickable,
		searchQuery: externalSearchQuery,
		filterNodes,
		selectedNodeId: externalSelectedNodeId
	}: Props = $props();

	const rootId = $derived(startFromId ?? data.rootId);
	const nodesById = $derived(data.nodesById);
	const searchIndex = $derived(new TaxonomySearchIndex(nodesById));

	let expandedNodes = new SvelteSet<string>();
	let selectedId = $state<string | null>(null);
	let internalSearchQuery = $state('');
	let debouncedQuery = $state('');

	// Sync external selectedNodeId with internal selectedId
	$effect(() => {
		if (externalSelectedNodeId !== undefined && externalSelectedNodeId !== selectedId) {
			selectedId = externalSelectedNodeId;
		}
	});

	// Use external searchQuery if provided, otherwise use internal state
	const searchQuery = $derived(externalSearchQuery ?? internalSearchQuery);
	const hasExternalSearch = $derived(externalSearchQuery !== undefined);

	const searchTerm = $derived(debouncedQuery.trim().toLowerCase());
	const isSearching = $derived(searchTerm.length > 0);
	const MAX_VISIBLE_RESULTS = 500;

	// Debounce search query (only if using internal state)
	$effect(() => {
		if (hasExternalSearch) {
			// Use external query directly, no debounce needed
			debouncedQuery = searchQuery.trim();
			return;
		}
		const currentQuery = internalSearchQuery;
		const handle = setTimeout(() => {
			debouncedQuery = currentQuery;
		}, 200);
		return () => clearTimeout(handle);
	});

	const searchResult = $derived.by(() => {
		if (!searchTerm) return null;

		const matchedNodeIds = searchIndex.smartSearch(searchTerm);
		if (matchedNodeIds.size === 0) {
			return {
				childrenById: new Map<string, string[]>(),
				expanded: new Set<string>(),
				hasMatches: false
			};
		}

		const visibleSet = new Set<string>();

		// Build visible set with matched nodes and ancestors
		for (const nodeId of matchedNodeIds) {
			const node = nodesById.get(nodeId);
			if (!node) continue;

			// Apply filter if provided
			if (filterNodes && !filterNodes(node)) {
				continue;
			}

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

	// Expand nodes on mount and when rootId changes
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
		
		const allChildren = nodesById.get(nodeId)?.childrenIds ?? [];
		
		// Apply filter if provided and not searching
		if (filterNodes) {
			return allChildren.filter((childId) => {
				const childNode = nodesById.get(childId);
				if (!childNode) return false;
				
				// Show node if it matches filter OR has descendants that match filter
				if (filterNodes(childNode)) {
					return true;
				}
				
				// Check if any descendant matches filter (ancestors should be visible)
				function hasMatchingDescendant(id: string): boolean {
					const node = nodesById.get(id);
					if (!node) return false;
					if (filterNodes!(node)) return true;
					for (const childId of node.childrenIds) {
						if (hasMatchingDescendant(childId)) return true;
					}
					return false;
				}
				
				return hasMatchingDescendant(childId);
			});
		}
		
		return allChildren;
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
			console.log(
				'[TaxonomyList] Expanded node:',
				nodeId,
				'expandedNodes size:',
				expandedNodes.size
			);
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
		} else if (
			event.key === 'ArrowRight' &&
			hasKids &&
			!isExpandedEffective(nodeId) &&
			!isSearching
		) {
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
			<mark class="rounded bg-amber-200 px-0.5 text-amber-900">{part.text}</mark>
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
			{@const hasOriginalChildren = (node.childrenIds?.length ?? 0) > 0}
			{@const expanded = isExpandedEffective(nodeId)}
			{@const selected = selectedId === nodeId || externalSelectedNodeId === nodeId}
			{@const isClickable = isNodeClickable
				? (() => {
						try {
							return isNodeClickable(node);
						} catch (err) {
							console.warn('[TaxonomyList] Error checking node clickability:', err);
							return false;
						}
					})()
				: false}
			{@const isFamilyOrBelow = node.rank === 'family' || node.rank === 'genus' || node.rank === 'species'}
			{@const shouldShowIcon = isClickable && hasOriginalChildren && isFamilyOrBelow}
			{@const shouldShowIconDebug = isClickable && hasOriginalChildren}

		<li
			class="m-0 list-none p-0"
			role="treeitem"
			aria-expanded={hasKids ? expanded : undefined}
			aria-selected={selected}
		>
			<div
				class="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 transition-colors duration-150 {hasKids
					? 'hover:bg-slate-100'
					: ''} {selected ? 'bg-slate-50' : ''}"
			>
				<!-- Navigation Button (expand/collapse) -->
				<button
					type="button"
					class="group relative z-10 flex min-w-0 flex-1 items-center gap-1.5 border-none bg-transparent text-left {hasKids || isClickable
						? 'cursor-pointer'
						: 'cursor-default'}"
					onclick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						// Leaf nodes (no children) that are clickable should open the map directly
						if (!hasKids && isClickable) {
							console.log('[TaxonomyList] Clicking leaf node with spatial data:', node.name, nodeId);
							selectNode(node, nodeId);
							return;
						}
						// If node has children, expand/collapse
						if (hasKids && !isSearching) {
							toggleExpanded(nodeId, event);
						}
					}}
					onkeydown={(e) => {
						if (!hasKids && isClickable && (e.key === 'Enter' || e.key === ' ')) {
							e.preventDefault();
							e.stopPropagation();
							selectNode(node, nodeId);
						} else {
							handleKeyDown(e, nodeId, hasKids);
						}
					}}
					aria-disabled={hasKids ? (isSearching ? true : false) : false}
					aria-expanded={hasKids ? expanded : undefined}
				>
					<!-- Expand/Collapse Chevron -->
					<ChevronRight
						class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 {expanded
							? 'rotate-90'
							: ''} {!hasKids ? 'invisible' : ''}"
					/>

					<!-- Main Content -->
					<span class="min-w-0 flex-1 truncate text-sm font-semibold {isClickable ? 'text-[#80cbc4]' : 'text-slate-700'} {selected ? 'underline' : ''}">
						{#if isSearching}
							{@render highlightedText(node.name, debouncedQuery)}
						{:else}
							{node.name}
						{/if}
					</span>
				</button>

				<!-- Map Icon (if clickable and has children, and is family or below) - before count badge -->
				{#if shouldShowIcon}
					<!-- Debug: {node.name} (rank: {node.rank}) - isClickable: {isClickable}, hasOriginalChildren: {hasOriginalChildren}, isFamilyOrBelow: {isFamilyOrBelow}, childrenIds.length: {node.childrenIds?.length ?? 0}, shouldShowIcon: {shouldShowIcon} -->
					<button
						type="button"
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#80cbc4] transition-colors duration-150 hover:bg-slate-100 hover:text-[#80cbc4] focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-500 active:bg-slate-200"
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
						<SquareArrowOutUpRight class="h-3.5 w-3.5" aria-hidden="true" />
					</button>
				{/if}

				<!-- Count Badge (if has children) - fixed width for alignment -->
				{#if hasKids}
					<span
						class="flex min-w-[2rem] items-center justify-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 group-hover:bg-slate-300"
					>
						{childIds.length}
					</span>
				{/if}
			</div>

			{#if hasKids && expanded}
				<div class="ml-5 border-l-2 border-slate-200 pl-4">
					<ul class="m-0 list-none p-0" role="group">
						{#each childIds as childId (childId)}
							{@render nodeItem(childId, depth + 1)}
						{/each}
					</ul>
				</div>
			{/if}
		</li>
		{/if}
{/snippet}

<div class="flex h-full flex-col overflow-hidden bg-slate-50 {className}">
	{#if !hasExternalSearch}
		<!-- Internal search UI - only show if external searchQuery prop is not provided -->
		<div class="sticky top-0 z-10 bg-white px-3 py-2">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
				<input
					type="text"
					value={internalSearchQuery}
					oninput={(e) => (internalSearchQuery = e.currentTarget.value)}
					placeholder="Search"
					class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-10 text-sm text-black transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none"
				/>
				{#if internalSearchQuery}
					<button
						type="button"
						onclick={() => (internalSearchQuery = '')}
						class="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						aria-label="Clear search"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if isSearching && searchResult && !searchResult.hasMatches}
		<div class="flex flex-1 items-center justify-center text-sm text-slate-500">
			No results found
		</div>
	{:else}
		<ul
			class="m-0 flex-1 list-none overflow-x-hidden overflow-y-auto px-2 pb-8"
			role="tree"
			aria-label="Taxonomy hierarchy"
		>
			{@render nodeItem(rootId, 0)}
		</ul>
	{/if}
</div>
