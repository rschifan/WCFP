<script lang="ts">
	/**
	 * A species at its own URL — what a shared link, a reload or a new tab resolves to.
	 *
	 * It renders the same `TaxonScheda` the dialog does, so there is exactly one species layout
	 * and one place the taxonomic source is rendered.
	 */
	import { fromStore } from 'svelte/store';
	import { replaceState } from '$app/navigation';
	import { base } from '$app/paths';
	import { ArrowLeft } from 'lucide-svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import TaxonScheda, { type SchedaView } from '$lib/components/taxon/TaxonScheda.svelte';
	import { regionGeometryStore } from '$lib/stores/region-geometry';
	import { formatCount } from '$lib/utils/format';
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const regionGeometry = fromStore(regionGeometryStore);

	// The URL picks the tab; clicking one overrides it until the route changes again, so
	// navigating to another species never carries the previous one's open tab across.
	let chosenView = $state<SchedaView | null>(null);
	const view = $derived(chosenView ?? data.view);

	$effect(() => {
		data.species.wcfpId;
		chosenView = null;
	});

	// The scheda is driven by a taxonomy node; on this route we synthesise one from the record.
	const taxon = $derived<TaxonomyNodeNormalized>({
		id: `species/${data.species.wcfpId}`,
		name: data.species.name,
		nameLower: data.species.name.toLowerCase(),
		rank: 'species',
		count: 1,
		childCount: 0,
		childrenIds: [],
		childrenLoaded: true,
		parentId: null,
		path: `species/${data.species.wcfpId}`,
		depth: 3,
		wcfpId: data.species.wcfpId,
		...(data.species.authors ? { authors: data.species.authors } : {}),
		hasDistribution: data.distribution.areaCount > 0,
		distributionAreaCount: data.distribution.areaCount
	});

	const distribution = $derived(
		data.distribution.areaCount === 0
			? ({ status: 'no-data' } as const)
			: ({ status: 'success', distribution: data.distribution } as const)
	);

	const description = $derived(
		`${data.species.name} (${data.species.family}) in the World Checklist of Food Plants` +
			(data.distribution.areaCount > 0
				? `, recorded in ${formatCount(data.distribution.areaCount)} areas.`
				: '.')
	);

	function handleViewChange(next: SchedaView) {
		chosenView = next;
		const query = next === 'distribution' ? '?view=distribution' : '';
		replaceState(`${base}/species/${data.species.wcfpId}${query}`, {});
	}
</script>

<svelte:head>
	<title>{data.species.name} | World Checklist of Food Plants</title>
	<meta name="description" content={description} />
</svelte:head>

<div class="flex min-h-screen w-full flex-col">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
		<!--
			A reader who clicked a species inside the app gets this record as a dialog over what they
			were doing. A reader who arrived on the link itself has no such context to return to, so
			the page offers a way into one rather than stranding them on a single taxon.
		-->
		<a
			href={`${base}/taxonomy`}
			class="app-accent-text-hover mb-4 inline-flex items-center gap-1.5 text-sm text-surface-600-400"
		>
			<ArrowLeft class="size-4" aria-hidden="true" />
			<span>Browse all taxa</span>
		</a>

		<!--
			The page gives the scheda a height so its two tabs match, the way the dialog does with
			its own. A floor rather than a fixed height: the page can grow past it on a tall screen
			without the card fighting the document.
		-->
		<div class="flex min-h-[70dvh] flex-col">
			<TaxonScheda
				{taxon}
				species={data.species}
				{distribution}
				{view}
				titleId="species-scheda-title"
				permalink={`${base}/species/${data.species.wcfpId}`}
				geoJSON={regionGeometry.current.geoJSON}
				onViewChange={handleViewChange}
			/>
		</div>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
