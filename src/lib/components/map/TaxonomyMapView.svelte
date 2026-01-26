<script lang="ts">
	/**
	 * TaxonomyMapView - Container component for taxonomy map visualization
	 *
	 * This component orchestrates the TaxonomyList and ChoroplethMap.
	 * It manages state, handles node selection, and triggers distribution computation.
	 *
	 * Features:
	 * - State machine pattern for async data fetching (Svelte 5 best practice)
	 * - AbortController for request cancellation
	 * - TaxonomyNodeNormalized → TaxonomyNode conversion
	 * - Error boundaries and loading states
	 * - Responsive layout:
	 *   - Desktop: Split view (taxonomy left, map right, both always visible)
	 *   - Mobile: Full screen taxonomy initially, then split view when node selected
	 */

	import type { FeatureCollection } from 'geojson';
	import type {
		TaxonomyNode,
		FamilyLookup,
		TaxonomySchema,
		TaxonomyNodeNormalized
	} from '$lib/types/taxonomy';
	import TaxonomyPanel from './TaxonomyPanel.svelte';
	import ChoroplethMap from './ChoroplethMap.svelte';
	import { useSpatialDistributionService } from '$lib/services/spatial-distribution';
	import { normalizeTaxonomyTree } from '$lib/utils/taxonomy/normalize';
	import { findNodeByPath, getWcfpIdsForNode } from '$lib/utils/taxonomy/node-traversal';
	import { ServiceError, ServiceErrorCode } from '$lib/services/errors';

	// ============================================================================
	// Types
	// ============================================================================

	/**
	 * State machine for async distribution data fetching.
	 * Using discriminated unions ensures type-safe state transitions.
	 */
	type FetchState =
		| { status: 'idle' }
		| { status: 'loading'; hasTargetIds: boolean }
		| { status: 'success'; data: Map<string, number>; hasTargetIds: boolean; hasMatches: boolean }
		| { status: 'error'; message: string; hasTargetIds: boolean }
		| { status: 'no-data'; hasTargetIds: boolean }; // Has IDs but no distribution matches

	interface Props {
		/** Taxonomy tree data */
		taxonomyTree: TaxonomyNode;
		/** Family lookup data (from families.json) */
		families: FamilyLookup;
		/** GeoJSON feature collection with region data */
		geoJSON: FeatureCollection;
		/** Pre-computed WCFP_IDs with spatial data */
		wcfpIdsWithSpatialData: Set<number>;
		/** Whether the view is in mobile mode */
		isMobile?: boolean;
		/** Optional CSS class */
		class?: string;
	}

	// ============================================================================
	// Props & Context
	// ============================================================================

	let {
		taxonomyTree,
		families,
		geoJSON,
		wcfpIdsWithSpatialData,
		isMobile: isMobileProp,
		class: className = ''
	}: Props = $props();

	// Extract schema from taxonomyTree (derived to ensure reactivity)
	const schema = $derived((taxonomyTree as TaxonomyNode & { schema?: TaxonomySchema }).schema);

	// Get service from context
	// Note: This will throw if context is not set - ensure parent component
	// initializes services before rendering this component
	const distributionService = useSpatialDistributionService();

	// Normalize tree data (memoized with $derived)
	const normalizedData = $derived(normalizeTaxonomyTree(taxonomyTree));

	// Find startFromId using $derived.by for complex computation
	const startFromId = $derived.by(() => {
		for (const node of normalizedData.nodesById.values()) {
			if (node.name === 'Plantae') {
				return node.id;
			}
		}
		return undefined;
	});

	// ============================================================================
	// State
	// ============================================================================

	// Selected node from taxonomy list
	let selectedNormalizedNode = $state<{ node: TaxonomyNodeNormalized; path: string } | null>(null);

	// Async fetch state machine - single source of truth for loading/error/data
	let fetchState = $state<FetchState>({ status: 'idle' });

	// Responsive breakpoint (768px matches mobile breakpoint used elsewhere)
	const MOBILE_BREAKPOINT = 768;
	let containerElement = $state<HTMLDivElement | null>(null);
	let containerWidth = $state(0);

	// Module-level variable for AbortController (not reactive, component-scoped)
	let currentAbortController: AbortController | null = null;

	// ============================================================================
	// Derived State (Svelte 5 best practice: prefer $derived over $effect for computed values)
	// ============================================================================

	// Detect if mobile view - use prop if provided, otherwise determine internally
	const isMobileInternal = $derived(containerWidth > 0 && containerWidth < MOBILE_BREAKPOINT);
	const isMobile = $derived(isMobileProp ?? isMobileInternal);

	// Extract TaxonomyNode from normalized node (must be declared before showMap which depends on it)
	const selectedNode = $derived.by(() => {
		if (!selectedNormalizedNode) return null;
		const fullNode = findNodeByPath(taxonomyTree, selectedNormalizedNode.path);
		return fullNode || (selectedNormalizedNode.node as unknown as TaxonomyNode);
	});

	// View visibility - derived from isMobile and selectedNode (no $effect needed!)
	// On desktop, map is always visible. On mobile, map is visible when a node is selected.
	const showMap = $derived(isMobile ? !!selectedNode : true);

	// Convenience getters from fetch state (derived for type safety)
	const loading = $derived(fetchState.status === 'loading');
	const error = $derived(fetchState.status === 'error' ? fetchState.message : null);
	const distributionData = $derived(
		fetchState.status === 'success' ? fetchState.data : new Map<string, number>()
	);
	const hasTargetIdsForSelection = $derived(
		fetchState.status !== 'idle' && 'hasTargetIds' in fetchState ? fetchState.hasTargetIds : false
	);
	const hasMatchesForSelection = $derived(
		fetchState.status === 'success' ? fetchState.hasMatches : false
	);

	// Check if distribution data has only one unique value (hide legend in this case)
	const hasOnlyOneUniqueValue = $derived.by(() => {
		if (distributionData.size === 0) return false;
		const values = Array.from(distributionData.values());
		const uniqueValues = new Set(values);
		return uniqueValues.size === 1;
	});

	// ============================================================================
	// Effects (only for side effects that can't be expressed as derived values)
	// ============================================================================

	// Track container width for responsive behavior (legitimate side effect)
	// Only needed if isMobile prop is not provided
	$effect(() => {
		if (isMobileProp !== undefined || !containerElement) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = Math.floor(entry.contentRect.width);
			}
		});

		resizeObserver.observe(containerElement);
		return () => resizeObserver.disconnect();
	});

	// Fetch distribution data when selectedNormalizedNode changes
	// This is a legitimate use of $effect for async side effects
	$effect(() => {
		const current = selectedNormalizedNode;

		// Cancel previous request
		if (currentAbortController) {
			currentAbortController.abort();
			currentAbortController = null;
		}

		// If no node selected, reset to idle
		if (!current) {
			fetchState = { status: 'idle' };
			return;
		}

		// Resolve the taxonomy node from path
		const taxonomyNode = resolveTaxonomyNode(current.path);

		if (!taxonomyNode) {
			fetchState = { status: 'idle' };
			return;
		}

		// Check if node has WCFP_IDs
		const hasTargetIds = checkHasTargetIds(taxonomyNode);

		// Create new AbortController for this request
		const controller = new AbortController();
		currentAbortController = controller;

		// Set loading state
		fetchState = { status: 'loading', hasTargetIds };

		// Fetch distribution data
		distributionService
			.getDistributionForNode(taxonomyNode, families, geoJSON, controller.signal, taxonomyTree)
			.then((distribution) => {
				// Check if request was aborted
				if (controller.signal.aborted) return;

				const hasMatches = distribution.size > 0;

				// Transition to success or no-data state
				if (hasMatches) {
					fetchState = {
						status: 'success',
						data: new Map(distribution),
						hasTargetIds,
						hasMatches: true
					};
				} else {
					fetchState = { status: 'no-data', hasTargetIds };
				}
			})
			.catch((err) => {
				// Ignore abort errors
				if (controller.signal.aborted) return;

				// Handle typed ServiceError
				if (err instanceof ServiceError) {
					if (err.code === ServiceErrorCode.ABORTED) return;

					// Expected errors (DATA_NOT_FOUND) transition to no-data state
					if (err.isExpected()) {
						fetchState = { status: 'no-data', hasTargetIds };
						return;
					}

					// Unexpected errors transition to error state
					fetchState = { status: 'error', message: err.message, hasTargetIds };
					console.error('[TaxonomyMapView] Error loading distribution:', err);
					return;
				}

				// Unknown error type
				const message = err instanceof Error ? err.message : String(err);
				fetchState = {
					status: 'error',
					message: `Failed to load distribution: ${message}`,
					hasTargetIds
				};
				console.error('[TaxonomyMapView] Error loading distribution:', err);
			});

		// Cleanup: abort request on unmount or when dependencies change
		return () => {
			if (currentAbortController === controller && !controller.signal.aborted) {
				controller.abort();
				currentAbortController = null;
			}
		};
	});

	// ============================================================================
	// Helper Functions
	// ============================================================================

	/**
	 * Resolve taxonomy node from path, handling various path formats.
	 */
	function resolveTaxonomyNode(path: string): TaxonomyNode | null {
		let taxonomyNode = findNodeByPath(taxonomyTree, path);

		// Try adjusting path if initial lookup fails
		if (!taxonomyNode && path.startsWith('root/')) {
			const adjustedPath = path.replace(/^root\//, `${taxonomyTree.name}/`);
			taxonomyNode = findNodeByPath(taxonomyTree, adjustedPath);
		}

		if (!taxonomyNode && !path.startsWith(taxonomyTree.name)) {
			const prependedPath = `${taxonomyTree.name}/${path}`;
			taxonomyNode = findNodeByPath(taxonomyTree, prependedPath);
		}

		if (!taxonomyNode && import.meta.env.DEV) {
			console.warn('[TaxonomyMapView] Node not found in full tree');
		}

		return taxonomyNode;
	}

	/**
	 * Check if a taxonomy node has WCFP_IDs.
	 */
	function checkHasTargetIds(taxonomyNode: TaxonomyNode): boolean {
		if (schema && schema.ranks) {
			const ids = getWcfpIdsForNode(taxonomyNode, schema);
			return ids.size > 0;
		}
		if (import.meta.env.DEV) {
			console.warn(
				'[TaxonomyMapView] No schema found on taxonomyTree; WCFP_ID extraction unavailable'
			);
		}
		return false;
	}

	/**
	 * Handle node click from TaxonomyList.
	 */
	function handleNodeClick(node: TaxonomyNodeNormalized, path: string): void {
		selectedNormalizedNode = { node, path };
	}

	/**
	 * Check if a normalized node is clickable (family/genus/species rank + has WCFP_IDs).
	 * Simple check - no caching needed since WCFP_ID check is fast.
	 */
	function isNodeClickable(node: TaxonomyNodeNormalized): boolean {
		// Only family, genus, and species ranks are clickable
		if (node.rank !== 'family' && node.rank !== 'genus' && node.rank !== 'species') {
			return false;
		}

		// Check if node has WCFP_IDs
		const nodePath = node.path ?? '';
		const taxonomyNode = findNodeByPath(taxonomyTree, nodePath);

		if (!taxonomyNode) {
			return false;
		}

		if (node.rank === 'species') {
			const wcfpId = taxonomyNode.wcfpId;
			return typeof wcfpId === 'number' && wcfpIdsWithSpatialData.has(wcfpId);
		}

		if (!schema || !schema.ranks) {
			return false;
		}

		const ids = getWcfpIdsForNode(taxonomyNode, schema);
		for (const id of ids) {
			if (wcfpIdsWithSpatialData.has(id)) {
				return true;
			}
		}

		return false;
	}
</script>

<div class="relative h-full w-full bg-white {className}" bind:this={containerElement}>
	{#if !isMobile}
		<!-- Desktop: Split view layout (taxonomy left, map right) -->
		<div class="flex h-full w-full">
			<TaxonomyPanel
				{isMobile}
				selectedNormalizedNode={selectedNormalizedNode}
				{normalizedData}
				{startFromId}
				onNodeSelect={handleNodeClick}
				{isNodeClickable}
			/>

			<!-- Map View - Right side, flexible width -->
			<div class="min-w-0 flex-1 overflow-hidden bg-white">
				{#if error}
					<div class="flex h-full items-center justify-center">
						<div class="rounded-lg bg-red-100 p-6 text-red-800 shadow-lg">
							<p class="font-semibold">Error</p>
							<p class="mt-2 text-sm">{error}</p>
						</div>
					</div>
				{:else if loading}
					<div class="flex h-full items-center justify-center bg-white/80">
						<div class="flex items-center gap-3 text-slate-600">
							<span
								class="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500"
							></span>
							<span>Loading distribution...</span>
						</div>
					</div>
				{:else if selectedNode && hasTargetIdsForSelection && !hasMatchesForSelection}
					<div class="flex h-full items-center justify-center bg-slate-50">
						<div class="max-w-md px-4 text-center text-slate-500">
							<p class="text-lg font-semibold">No distribution data available</p>
							<p class="mt-2 text-sm">
								The selected taxon has valid WCFP_IDs, but none of them appear in the geographic
								distribution dataset. This likely means there is no coverage for this taxon in
								<code>1.geo_distr_taxa.csv</code>.
							</p>
						</div>
					</div>
				{:else if selectedNode && distributionData.size > 0}
					<ChoroplethMap
						{geoJSON}
						{distributionData}
						colors={{ low: '#e0f2f1', mid: '#80cbc4', high: '#00897b' }}
						hoverColor="#14532d"
						showLegend={!hasOnlyOneUniqueValue}
					/>
				{:else if selectedNode}
					<div class="flex h-full items-center justify-center bg-slate-50">
						<div class="text-center text-slate-500">
							<p class="text-lg font-semibold">Loading distribution...</p>
							<p class="mt-2 text-sm">Please wait while we fetch the data</p>
						</div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center bg-slate-50">
						<div class="text-center text-slate-500">
							<p class="text-lg font-semibold">Select a taxonomy node</p>
							<p class="mt-2 text-sm">
								Click on a node in the tree to view its geographical distribution
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Mobile: Map always visible, TaxonomyPanel as fixed overlay (handled by TaxonomyPanelMobile) -->
		<div class="relative h-full w-full">
			<!-- Map View - Always visible on mobile -->
			<div class="absolute inset-0 h-full w-full overflow-hidden bg-white">
				{#if error}
					<div class="flex h-full items-center justify-center">
						<div class="rounded-lg bg-red-100 p-6 text-red-800 shadow-lg">
							<p class="font-semibold">Error</p>
							<p class="mt-2 text-sm">{error}</p>
						</div>
					</div>
				{:else if loading}
					<div class="flex h-full items-center justify-center bg-white/80">
						<div class="flex items-center gap-3 text-slate-600">
							<span
								class="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500"
							></span>
							<span>Loading distribution...</span>
						</div>
					</div>
				{:else if selectedNode && hasTargetIdsForSelection && !hasMatchesForSelection}
					<div class="flex h-full items-center justify-center bg-slate-50">
						<div class="max-w-md px-4 text-center text-slate-500">
							<p class="text-lg font-semibold">No distribution data available</p>
							<p class="mt-2 text-sm">
								The selected taxon has valid WCFP_IDs, but none of them appear in the geographic
								distribution dataset. This likely means there is no coverage for this taxon in
								<code>1.geo_distr_taxa.csv</code>.
							</p>
						</div>
					</div>
				{:else if selectedNode && distributionData.size > 0}
					<ChoroplethMap
						{geoJSON}
						{distributionData}
						colors={{ low: '#e0f2f1', mid: '#80cbc4', high: '#00897b' }}
						hoverColor="#14532d"
						showLegend={!hasOnlyOneUniqueValue}
					/>
				{:else}
					<div class="flex h-full items-center justify-center bg-slate-50">
						<div class="text-center text-slate-500">
							<p class="text-lg font-semibold">Select a taxonomy node</p>
							<p class="mt-2 text-sm">
								Click on a node in the tree to view its geographical distribution
							</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Taxonomy Panel - Fixed bottom sheet overlay -->
			<TaxonomyPanel
				{isMobile}
				selectedNormalizedNode={selectedNormalizedNode}
				{normalizedData}
				{startFromId}
				onNodeSelect={handleNodeClick}
				{isNodeClickable}
			/>
		</div>
	{/if}
</div>
