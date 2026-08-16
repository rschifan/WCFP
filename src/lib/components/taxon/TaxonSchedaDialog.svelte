<script lang="ts">
	/**
	 * The scheda as a dialog, for opening a taxon in place.
	 *
	 * Skeleton's Dialog is Zag-backed, so the focus trap, escape handling and focus restoration
	 * come with it — the portal used to hand-roll all three, and the distribution overlay never
	 * restored focus at all.
	 *
	 * Species get a URL through shallow routing, so Back closes the dialog and the link can be
	 * shared or reloaded. Higher taxa do not: a genus has no stable external identifier, and its
	 * map is navigation rather than something to cite.
	 */
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { X } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { fromStore } from 'svelte/store';
	import { base } from '$app/paths';
	import { pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import TaxonScheda, { type DistributionState, type SchedaView } from './TaxonScheda.svelte';
	import { regionGeometryStore } from '$lib/stores/region-geometry';
	import { fetchSpeciesDetail } from '$lib/services/species/detail-cache';
	import { loadTaxonDistribution } from '$lib/services/spatial-distribution/load-distribution';
	import type { Species } from '$lib/types/species';
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';

	interface Props {
		/** The open taxon, or null when the dialog is closed. */
		taxon: TaxonomyNodeNormalized | null;
		initialView?: SchedaView;
		onClose: () => void;
		returnFocusTo?: HTMLElement | null;
	}

	let { taxon, initialView = 'overview', onClose, returnFocusTo = null }: Props = $props();

	const regionGeometry = fromStore(regionGeometryStore);

	let view = $state<SchedaView>('overview');
	let species = $state<Species | null>(null);
	let distribution = $state<DistributionState>({ status: 'idle' });

	let distributionController: AbortController | null = null;
	let loadId = 0;
	/** True between our pushState and the matching pop, so close() knows to unwind history. */
	let pushedHistoryEntry = $state(false);

	const isSpecies = $derived(taxon?.rank === 'species');
	const open = $derived(taxon !== null);
	const titleId = $derived(
		taxon ? `taxon-scheda-${taxon.id.replaceAll('/', '-')}` : 'taxon-scheda'
	);
	const permalink = $derived(
		isSpecies && typeof taxon?.wcfpId === 'number' ? `${base}/species/${taxon.wcfpId}` : null
	);

	function speciesUrl(wcfpId: number, nextView: SchedaView): string {
		return `${base}/species/${wcfpId}${nextView === 'distribution' ? '?view=distribution' : ''}`;
	}

	/**
	 * Shallow routing needs the client router, which is absent before hydration and in component
	 * tests. The URL is an enhancement — losing it must not stop the scheda opening — so a failure
	 * here degrades to a dialog without history rather than throwing.
	 */
	function syncUrl(kind: 'push' | 'replace', wcfpId: number, nextView: SchedaView): boolean {
		const url = speciesUrl(wcfpId, nextView);
		const state = { scheda: { wcfpId, view: nextView } };
		try {
			if (kind === 'push') pushState(url, state);
			else replaceState(url, state);
			return true;
		} catch {
			return false;
		}
	}

	async function loadFor(node: TaxonomyNodeNormalized) {
		const id = ++loadId;
		distributionController?.abort();
		const controller = new AbortController();
		distributionController = controller;

		species = null;
		distribution = node.hasDistribution ? { status: 'loading' } : { status: 'no-data' };

		if (node.rank === 'species' && typeof node.wcfpId === 'number') {
			fetchSpeciesDetail(node.wcfpId)
				.then((detail) => {
					if (id === loadId) species = detail;
				})
				.catch((error) => {
					console.error('[TaxonSchedaDialog] Could not load the species record:', error);
				});
		}

		if (!node.hasDistribution) return;

		try {
			const result = await loadTaxonDistribution(node, { signal: controller.signal });
			if (id !== loadId || controller.signal.aborted) return;
			distribution =
				result.areaCount === 0
					? { status: 'no-data' }
					: { status: 'success', distribution: result };
		} catch (error) {
			if (id !== loadId || controller.signal.aborted) return;
			distribution = {
				status: 'error',
				message: error instanceof Error ? error.message : String(error)
			};
		}
	}

	// One effect per opened taxon: reset the view, load, and give a species a URL.
	$effect(() => {
		const node = taxon;
		if (!node) {
			distributionController?.abort();
			distribution = { status: 'idle' };
			species = null;
			return;
		}

		// untrack: pushState below writes page.state, and reading it as a dependency would make
		// this effect retrigger and load the distribution a second time.
		untrack(() => {
			view = node.hasDistribution && node.rank !== 'species' ? 'distribution' : initialView;

			if (node.rank === 'species' && typeof node.wcfpId === 'number' && !page.state.scheda) {
				pushedHistoryEntry = syncUrl('push', node.wcfpId, view);
			}

			void loadFor(node);
		});
	});

	// The browser Back button. A plain popstate listener, not `afterNavigate`: shallow-routing
	// pops do not reliably surface as navigations, and closing must never depend on that.
	//
	// `close()` below clears the flag before it calls `history.back()`, so the popstate raised by
	// our own unwinding finds nothing to do and cannot close the dialog twice.
	$effect(() => {
		function handlePop() {
			if (!pushedHistoryEntry) return;
			pushedHistoryEntry = false;
			onClose();
		}

		window.addEventListener('popstate', handlePop);
		return () => window.removeEventListener('popstate', handlePop);
	});

	function handleViewChange(next: SchedaView) {
		view = next;
		// replaceState, not pushState: switching tabs should not cost a Back press.
		if (pushedHistoryEntry && taxon && typeof taxon.wcfpId === 'number') {
			syncUrl('replace', taxon.wcfpId, next);
		}
	}

	/**
	 * Closing is synchronous, then the URL catches up.
	 *
	 * Routing first and closing on the resulting popstate left the dialog open for the whole
	 * round trip. `open` is a controlled prop, so while `taxon` was still set the prop kept
	 * re-asserting "open" against Zag's own close — the two fought, and dismissing the card took
	 * seconds. Tell the parent immediately, then unwind the history entry behind it.
	 */
	function close() {
		const hadHistoryEntry = pushedHistoryEntry;
		pushedHistoryEntry = false;
		onClose();
		if (hadHistoryEntry) history.back();
	}

	function retry() {
		if (taxon) void loadFor(taxon);
	}
</script>

<Dialog
	{open}
	onOpenChange={(details) => {
		if (!details.open) close();
	}}
	restoreFocus={true}
	finalFocusEl={returnFocusTo ? () => returnFocusTo : undefined}
>
	<Portal>
		<!--
			A dark scrim in both modes. `surface-50-950` resolved to near-white in light mode, so the
			backdrop tinted the page white and a white card vanished into it.
		-->
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
		<Dialog.Positioner
			class="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
		>
			<!--
				A fixed height, not a max: sized to its content the card grew and shrank as the reader
				moved between taxa and between tabs. Full screen on a phone, where a centred card wastes
				the margins, and a capped share of the viewport above that. `dvh` throughout, so a
				collapsing mobile address bar cannot leave the card taller than the screen.
			-->
			<Dialog.Content
				class="relative flex h-[100dvh] w-full flex-col bg-surface-50-950 p-4 sm:h-[85dvh] sm:max-h-[52rem] sm:max-w-4xl sm:rounded-container sm:border sm:border-surface-300-700 sm:p-6 sm:shadow-2xl"
				aria-labelledby={titleId}
			>
				<Dialog.CloseTrigger
					class="absolute top-3 right-3 z-10 btn-icon preset-tonal sm:top-4 sm:right-4"
					aria-label="Close"
				>
					<X class="size-4" />
				</Dialog.CloseTrigger>

				{#if taxon}
					<TaxonScheda
						{taxon}
						{species}
						{distribution}
						{view}
						{titleId}
						{permalink}
						geoJSON={regionGeometry.current.geoJSON}
						onViewChange={handleViewChange}
						onRetryDistribution={retry}
					/>
				{/if}
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
