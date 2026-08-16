<script lang="ts">
	import {
		HierarchyEntryRow,
		createSpeciesRowInteraction,
		getTaxonomicEntryAppearance,
		taxonomyBrowserPreset
	} from '$lib/components/hierarchy';
	import TaxonSchedaDialog from '$lib/components/taxon/TaxonSchedaDialog.svelte';
	import type { SchedaView } from '$lib/components/taxon/TaxonScheda.svelte';
	import type { HierarchyEntryBadge, HierarchyEntryModel } from '$lib/types/hierarchy';
	import type { TaxonomyNodeNormalized, TaxonomyTreeIndex } from '$lib/types/taxonomy';

	interface Props {
		data: TaxonomyTreeIndex;
		startFromId?: string;
		showStartNode?: boolean;
		expandedIds: Set<string>;
		onToggleExpanded?: (node: TaxonomyNodeNormalized) => void;
		loadingNodeIds?: Set<string>;
		onNodeSelect?: (node: TaxonomyNodeNormalized, path: string) => void;
		class?: string;
		isNodeClickable?: (node: TaxonomyNodeNormalized) => boolean;
		selectedNodeId?: string;
		getNodeBadges?: (node: TaxonomyNodeNormalized) => readonly HierarchyEntryBadge[] | undefined;
		highlightQuery?: string;
	}

	let {
		data,
		startFromId,
		showStartNode = true,
		expandedIds,
		onToggleExpanded,
		loadingNodeIds,
		onNodeSelect,
		class: className = '',
		isNodeClickable,
		selectedNodeId: externalSelectedNodeId,
		getNodeBadges,
		highlightQuery = ''
	}: Props = $props();

	const rootId = $derived(startFromId ?? data.rootId);
	const nodesById = $derived(data.nodesById);
	const visibleRootIds = $derived.by(() => {
		if (showStartNode) {
			return [rootId];
		}

		const startNode = nodesById.get(rootId);
		return startNode ? [...startNode.childrenIds] : [];
	});
	// The list owns the scheda, so every surface that renders a taxonomy tree — the region panel
	// and the taxonomy browser alike — gets the same dialog from the same gestures.
	let schedaTaxon = $state<TaxonomyNodeNormalized | null>(null);
	let schedaView = $state<SchedaView>('overview');
	let schedaTrigger = $state<HTMLElement | null>(null);
	let selectedId = $state<string | null>(null);

	function openScheda(
		node: TaxonomyNodeNormalized,
		nodeId: string,
		view: SchedaView,
		trigger?: HTMLElement | null
	) {
		selectNode(node, nodeId);
		schedaView = view;
		schedaTrigger = trigger ?? null;
		schedaTaxon = node;
	}

	$effect(() => {
		if (externalSelectedNodeId !== undefined && externalSelectedNodeId !== selectedId) {
			selectedId = externalSelectedNodeId;
		}
	});

	function safelyEvaluateNodePredicate(
		node: TaxonomyNodeNormalized,
		predicate: ((node: TaxonomyNodeNormalized) => boolean) | undefined,
		label: 'clickability'
	): boolean {
		if (!predicate) return false;

		try {
			return predicate(node);
		} catch (err) {
			console.warn(`[TaxonomyList] Error checking node ${label}:`, err);
			return false;
		}
	}

	function getNodeBadgesFor(node: TaxonomyNodeNormalized): readonly HierarchyEntryBadge[] {
		return getNodeBadges?.(node) ?? [];
	}

	function getNodeAppearance(node: TaxonomyNodeNormalized) {
		return getTaxonomicEntryAppearance(node.rank ?? 'default');
	}

	function selectNode(node: TaxonomyNodeNormalized, nodeId: string) {
		selectedId = nodeId;
		onNodeSelect?.(node, node.path ?? nodeId);
	}

	function buildTaxonomyEntry(
		node: TaxonomyNodeNormalized,
		nodeId: string,
		hasKids: boolean,
		expanded: boolean,
		selected: boolean,
		isClickable: boolean,
		badges: readonly HierarchyEntryBadge[],
		appearance: ReturnType<typeof getNodeAppearance>
	): HierarchyEntryModel {
		return {
			id: nodeId,
			title: node.name,
			subtitle: node.authors,
			subtitleDisplay: node.authors ? 'inline' : undefined,
			count: hasKids ? node.childCount : undefined,
			badges,
			selected,
			expandable: hasKids,
			expanded,
			interactive: !hasKids && isClickable,
			...appearance
		};
	}

	function buildSpeciesInteraction(
		node: TaxonomyNodeNormalized,
		nodeId: string,
		selected: boolean,
		isClickable: boolean,
		badges: readonly HierarchyEntryBadge[],
		appearance: ReturnType<typeof getNodeAppearance>
	) {
		if (node.rank !== 'species' || typeof node.wcfpId !== 'number') {
			return null;
		}

		return createSpeciesRowInteraction({
			id: nodeId,
			title: node.name,
			subtitle: node.authors,
			badges,
			selected,
			appearance,
			onOpenDetails: (trigger) => openScheda(node, nodeId, 'overview', trigger),
			mapAction: isClickable
				? {
						enabled: true,
						areaCount: node.distributionAreaCount ?? 0,
						onOpenMap: (trigger) => openScheda(node, nodeId, 'distribution', trigger)
					}
				: undefined
		});
	}

	function handleNodeRowClick(
		node: TaxonomyNodeNormalized,
		nodeId: string,
		hasKids: boolean,
		isClickable: boolean,
		speciesInteraction: ReturnType<typeof buildSpeciesInteraction>,
		trigger?: HTMLElement | null
	) {
		if (speciesInteraction) {
			speciesInteraction.onRowClick(trigger);
			return;
		}

		if (hasKids) {
			onToggleExpanded?.(node);
			return;
		}

		// A genus or family has no record to show, only where its species are.
		if (isClickable) {
			openScheda(node, nodeId, 'distribution', trigger);
		}
	}

	function handleKeyDown(event: KeyboardEvent, node: TaxonomyNodeNormalized, hasKids: boolean) {
		if (event.key === 'ArrowRight' && hasKids && !expandedIds.has(node.id)) {
			event.preventDefault();
			onToggleExpanded?.(node);
			return;
		}

		if (event.key === 'ArrowLeft' && hasKids && expandedIds.has(node.id)) {
			event.preventDefault();
			onToggleExpanded?.(node);
		}
	}
</script>

{#snippet nodeItem(nodeId: string)}
	{@const node = nodesById.get(nodeId)}
	{#if node}
		{@const childIds = node.childrenIds}
		{@const hasKids = node.childrenLoaded ? childIds.length > 0 : node.childCount > 0}
		{@const expanded = expandedIds.has(nodeId)}
		{@const selected = selectedId === nodeId || externalSelectedNodeId === nodeId}
		{@const isClickable = safelyEvaluateNodePredicate(node, isNodeClickable, 'clickability')}
		{@const appearance = getNodeAppearance(node)}
		{@const badges = getNodeBadgesFor(node)}
		{@const speciesInteraction = buildSpeciesInteraction(
			node,
			nodeId,
			selected,
			isClickable,
			badges,
			appearance
		)}
		{@const entry = buildTaxonomyEntry(
			node,
			nodeId,
			hasKids,
			expanded,
			selected,
			isClickable,
			badges,
			appearance
		)}
		{@const isLoading = loadingNodeIds?.has(nodeId) ?? false}

		<li
			class="m-0 list-none p-0"
			role="treeitem"
			aria-expanded={hasKids ? expanded : undefined}
			aria-selected={selected}
		>
			<HierarchyEntryRow
				entry={speciesInteraction?.entry ?? entry}
				preset={taxonomyBrowserPreset}
				{highlightQuery}
				ariaDisabled={isLoading}
				onRowClick={(trigger) =>
					handleNodeRowClick(node, nodeId, hasKids, isClickable, speciesInteraction, trigger)}
				onRowKeyDown={(event) => handleKeyDown(event, node, hasKids)}
				onAction={speciesInteraction?.onAction}
			/>

			{#if expanded && isLoading}
				<div class="ml-5 border-l-2 border-slate-200 pl-4">
					<div class="flex items-center gap-2 py-2 text-sm text-slate-500">
						<span
							class="app-spinner-accent h-4 w-4 animate-spin rounded-full border-2 border-slate-300"
						></span>
						<span>Loading…</span>
					</div>
				</div>
			{:else if hasKids && expanded}
				<div class="ml-5 border-l-2 border-slate-200 pl-4">
					<ul class="m-0 list-none p-0" role="group">
						{#each childIds as childId (childId)}
							{@render nodeItem(childId)}
						{/each}
					</ul>
				</div>
			{/if}
		</li>
	{/if}
{/snippet}

<div class="flex h-full flex-col overflow-hidden bg-slate-50 {className}">
	<ul
		class="m-0 flex-1 list-none overflow-x-hidden overflow-y-auto px-2 pb-8"
		role="tree"
		aria-label="Taxonomy hierarchy"
	>
		{#each visibleRootIds as visibleRootId (visibleRootId)}
			{@render nodeItem(visibleRootId)}
		{/each}
	</ul>

	<TaxonSchedaDialog
		taxon={schedaTaxon}
		initialView={schedaView}
		returnFocusTo={schedaTrigger}
		onClose={() => (schedaTaxon = null)}
	/>
</div>
