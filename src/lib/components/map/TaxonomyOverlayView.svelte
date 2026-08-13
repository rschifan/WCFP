<script lang="ts">
	import { fromStore } from 'svelte/store';
	import { base } from '$app/paths';
	import OverlayPanel from '$lib/components/hierarchy/OverlayPanel.svelte';
	import { createGlobalTaxonomySource } from '$lib/components/taxonomy-browser';
	import { regionGeometryStore } from '$lib/stores/region-geometry';
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
	import { formatCount } from '$lib/utils/format';
	import { profileApiQuery } from '$lib/utils/api-profiler';
	import TaxonomyPanel from './TaxonomyPanel.svelte';
	import TaxonomyDistributionMap from './TaxonomyDistributionMap.svelte';

	type Selection = { node: TaxonomyNodeNormalized; path: string };

	interface Props {
		isMobile?: boolean;
		class?: string;
	}

	interface DistributionApiRow {
		code: string;
		count?: number;
	}

	type OverlayState =
		| { status: 'idle' }
		| { status: 'loading' }
		| { status: 'success'; distributionData: Map<string, number> }
		| { status: 'no-data' }
		| { status: 'error'; message: string };

	let { isMobile = false, class: className = '' }: Props = $props();

	const taxonomySource = createGlobalTaxonomySource();
	const VALID_API_RANKS = new Set(['kingdom', 'phylum', 'class', 'order', 'family', 'genus']);

	let selectedNormalizedNode = $state<Selection | null>(null);
	let overlayState = $state<OverlayState>({ status: 'idle' });
	let currentAbortController: AbortController | null = null;
	let activeLoadId = 0;

	const regionGeometryState = fromStore(regionGeometryStore);
	const hasSelection = $derived(selectedNormalizedNode !== null);
	const selectedNode = $derived(selectedNormalizedNode?.node ?? null);
	const titleId = $derived(
		selectedNode
			? `taxonomy-distribution-title-${selectedNode.id.replaceAll('/', '-')}`
			: 'taxonomy-distribution-title'
	);
	const distributionAreaCount = $derived.by(() => {
		if (overlayState.status === 'success') {
			return overlayState.distributionData.size;
		}

		return selectedNormalizedNode?.node.distributionAreaCount ?? 0;
	});
	const mapGeoJSON = $derived(regionGeometryState.current.geoJSON);
	const hasOnlyOneUniqueValue = $derived.by(() => {
		if (overlayState.status !== 'success' || overlayState.distributionData.size === 0) {
			return false;
		}

		return new Set(overlayState.distributionData.values()).size === 1;
	});

	function isNodeClickable(node: TaxonomyNodeNormalized): boolean {
		return node.hasDistribution === true;
	}

	function buildDistributionUrl(node: TaxonomyNodeNormalized): string | null {
		if (node.rank === 'species' && typeof node.wcfpId === 'number') {
			return `${base}/api/v1/distribution?rank=species&wcfp_id=${node.wcfpId}`;
		}

		if (VALID_API_RANKS.has(node.rank)) {
			return `${base}/api/v1/distribution?rank=${encodeURIComponent(node.rank)}&name=${encodeURIComponent(node.name)}`;
		}

		return null;
	}

	async function loadDistributionRows(
		node: TaxonomyNodeNormalized,
		signal: AbortSignal
	): Promise<DistributionApiRow[]> {
		const url = buildDistributionUrl(node);
		if (!url) {
			return [];
		}

		return profileApiQuery(url, async () => {
			const response = await fetch(url, {
				signal,
				cache: 'no-store'
			});

			if (!response.ok) {
				throw new Error(`Failed to load distribution: ${response.status}`);
			}

			const body = (await response.json()) as { data: DistributionApiRow[] };
			return body.data;
		});
	}

	function buildDistributionDataMap(apiRows: DistributionApiRow[]): Map<string, number> {
		return new Map(
			apiRows.map((row) => [row.code, typeof row.count === 'number' ? Number(row.count) : 1])
		);
	}

	function getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}

		return String(error);
	}

	async function openOverlay(selection: Selection): Promise<void> {
		const loadId = ++activeLoadId;
		currentAbortController?.abort();

		const controller = new AbortController();
		currentAbortController = controller;
		selectedNormalizedNode = selection;
		overlayState = { status: 'loading' };

		try {
			const apiRows = await loadDistributionRows(selection.node, controller.signal);

			if (controller.signal.aborted || loadId !== activeLoadId) {
				return;
			}

			if (apiRows.length === 0) {
				overlayState = { status: 'no-data' };
				return;
			}

			const regionFeaturesByCode = regionGeometryState.current.featuresByCode;
			if (regionFeaturesByCode.size === 0) {
				throw new Error('Shared region geometry store is not ready');
			}

			overlayState = {
				status: 'success',
				distributionData: buildDistributionDataMap(apiRows)
			};
		} catch (error) {
			if (controller.signal.aborted || loadId !== activeLoadId) {
				return;
			}

			overlayState = { status: 'error', message: getErrorMessage(error) };
			console.error('[TaxonomyOverlayView] Failed to load overlay data:', error);
		} finally {
			if (currentAbortController === controller) {
				currentAbortController = null;
			}
		}
	}

	function handleNodeClick(node: TaxonomyNodeNormalized, path: string): void {
		if (!isNodeClickable(node)) {
			return;
		}

		void openOverlay({ node, path });
	}

	function closeOverlay(): void {
		activeLoadId += 1;
		currentAbortController?.abort();
		currentAbortController = null;
		selectedNormalizedNode = null;
		overlayState = { status: 'idle' };
	}

	function retryOverlayLoad(): void {
		if (selectedNormalizedNode) {
			void openOverlay(selectedNormalizedNode);
		}
	}
</script>

<div class="relative h-full w-full bg-white {className}">
	<TaxonomyPanel
		{isMobile}
		mode="standalone"
		{selectedNormalizedNode}
		source={taxonomySource}
		onNodeSelect={handleNodeClick}
		{isNodeClickable}
		{distributionAreaCount}
	/>

	<OverlayPanel
		open={hasSelection}
		{titleId}
		onClose={closeOverlay}
		panelClass="max-w-[min(96rem,100%)]"
	>
		{#if selectedNode}
			<div class="flex h-[min(82vh,56rem)] min-h-[28rem] flex-col gap-4">
				<div class="shrink-0 space-y-3">
					<div class="space-y-2">
						<p class="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
							Distribution map
						</p>
						<h2 id={titleId} class="pr-10 text-2xl leading-tight text-slate-900 sm:text-3xl">
							{selectedNode.name}
						</h2>
						<p class="text-sm text-slate-500 sm:text-base">
							<span class="capitalize">{selectedNode.rank}</span>
							{#if distributionAreaCount > 0}
								<span>
									· present in {formatCount(distributionAreaCount)}
									{distributionAreaCount === 1 ? 'area' : 'areas'}</span
								>
							{/if}
						</p>
					</div>

				</div>

				{#if overlayState.status === 'loading'}
					<section class="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center">
						<div
							class="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500"
						></div>
						<p class="mt-4 text-base font-semibold text-slate-900">Loading distribution map...</p>
						<p class="mt-1 text-sm text-slate-500">
							The overlay is fetching live distribution data.
						</p>
					</section>
				{:else if overlayState.status === 'error'}
					<section class="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/80 p-5 text-center">
						<p class="text-base font-semibold text-red-900">Unable to load distribution data</p>
						<p class="mt-2 text-sm text-red-800">{overlayState.message}</p>
						<button
							type="button"
							class="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
							onclick={retryOverlayLoad}
						>
							Retry
						</button>
					</section>
				{:else if overlayState.status === 'no-data'}
					<section class="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center">
						<p class="text-lg font-semibold text-slate-900">No distribution data available</p>
						<p class="mt-2 text-sm text-slate-600">
							The API returned no distribution rows for this taxon.
						</p>
					</section>
				{:else if overlayState.status === 'success' && mapGeoJSON}
					<section class="min-h-0 flex-1 overflow-hidden">
						<div class="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
							<TaxonomyDistributionMap
								geoJSON={mapGeoJSON as import('geojson').FeatureCollection}
								distributionData={overlayState.distributionData}
								showLegend={!hasOnlyOneUniqueValue}
							/>
						</div>
					</section>
				{/if}
			</div>
		{/if}
	</OverlayPanel>
</div>
