<script lang="ts">
	/**
	 * The record card for one taxon, and the only place a taxon is presented.
	 *
	 * It is deliberately presentational: hosts fetch the distribution and pass it in, so the same
	 * component serves the dialog (client fetch) and `/species/[wcfpId]` (server load) without a
	 * second layout or a second copy of the source-link rendering.
	 *
	 * Rank decides the shape. A species has a record and a distribution, so it gets tabs; a genus
	 * or family has only a distribution, so it gets the map and no tab bar.
	 */
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	import { base } from '$app/paths';
	import { ChevronRight, ExternalLink, Link2, Check } from 'lucide-svelte';
	import TaxonomyDistributionMap from '$lib/components/map/TaxonomyDistributionMap.svelte';
	import ReferenceList from '$lib/components/references/ReferenceList.svelte';
	import { ABOUT_USE_CATEGORIES } from '$lib/constants/portal-help';
	import { OCCURRENCE_LABELS, OCCURRENCE_ORDER } from '$lib/map/color-scale';
	import { APP_MAP_PALETTE } from '$lib/constants/palette';
	import { getSourceCitation, getSourceLinkLabel } from '$lib/utils/species/source-link';
	import { formatCount } from '$lib/utils/format';
	import type { Species } from '$lib/types/species';
	import type { TaxonomyNodeNormalized } from '$lib/types/taxonomy';
	import type { FeatureCollection } from 'geojson';
	import type { RegionFeatureCollection } from '$lib/stores/region-geometry';
	import type { TaxonDistribution } from '$lib/services/spatial-distribution/load-distribution';

	export type SchedaView = 'overview' | 'distribution';

	export type DistributionState =
		| { status: 'idle' }
		| { status: 'loading' }
		| { status: 'success'; distribution: TaxonDistribution }
		| { status: 'no-data' }
		| { status: 'error'; message: string };

	interface Props {
		taxon: TaxonomyNodeNormalized;
		/** The full record. Present for species, null while it loads and for higher taxa. */
		species?: Species | null;
		distribution: DistributionState;
		/** The shared region geometry, whose features may carry a null geometry. */
		geoJSON?: RegionFeatureCollection | null;
		view: SchedaView;
		onViewChange: (view: SchedaView) => void;
		onRetryDistribution?: () => void;
		/** Absolute or root-relative URL for the copy-link control. Omitted for higher taxa. */
		permalink?: string | null;
		titleId: string;
	}

	let {
		taxon,
		species = null,
		distribution,
		geoJSON = null,
		view,
		onViewChange,
		onRetryDistribution,
		permalink = null,
		titleId
	}: Props = $props();

	const isSpecies = $derived(taxon.rank === 'species');
	const hasDistribution = $derived(taxon.hasDistribution === true);
	// Tabs only earn their place when there is a second thing to switch to.
	const showTabs = $derived(isSpecies && hasDistribution);

	const lineage = $derived(
		[
			species?.kingdom,
			species?.phylum,
			species?.class,
			species?.order,
			species?.family,
			species?.genus
		].filter((rank): rank is string => Boolean(rank))
	);

	const areaCount = $derived(
		distribution.status === 'success'
			? distribution.distribution.areaCount
			: (taxon.distributionAreaCount ?? 0)
	);

	const totalUseCategories = ABOUT_USE_CATEGORIES.filter((category) =>
		Boolean(category.key)
	).length;
	/** Only what is recorded. An absent category is not a finding worth its own chip. */
	const recordedUses = $derived(
		ABOUT_USE_CATEGORIES.filter(
			(category) => category.key && Boolean(species?.uses?.[category.key])
		).map((category) => ({ label: category.label, icon: category.icon }))
	);

	/** Every recorded field, stated once. Omitted rows mean "not recorded", not "not shown". */
	const facts = $derived.by(() => {
		if (!species) return [];
		const rows: Array<{ label: string; value: string }> = [
			{ label: 'WCFP ID', value: String(species.wcfpId) },
			{ label: 'Family', value: species.family }
		];
		if (species.genus) rows.push({ label: 'Genus', value: species.genus });
		if (species.lifeform) rows.push({ label: 'Life form', value: species.lifeform });
		rows.push({ label: 'Crop wild relative', value: species.cwr ? 'Yes' : 'No' });
		if (areaCount > 0) {
			rows.push({
				label: 'Recorded areas',
				value: `${formatCount(areaCount)} worldwide`
			});
		}
		return rows;
	});

	const sourceLabel = $derived(getSourceLinkLabel(species?.sourceLink));
	// The header link is the action; under Sources the same URL is a citation, so it carries the
	// registry and its record id instead of repeating the call to action.
	const sourceCitation = $derived(getSourceCitation(species?.sourceLink) ?? 'External registry');

	const references = $derived(species?.referencesAll ?? []);
	/** Free text, so no href — the list detects any DOIs and URLs inside each citation. */
	const referenceEntries = $derived(references.map((label) => ({ label })));
	/** Beyond this the bibliography stops being skimmable and starts burying the rest of the card. */
	const REFERENCE_PREVIEW_LIMIT = 8;

	/**
	 * One height for both panes, so switching tab never resizes the card around the reader.
	 *
	 * The panes simply fill whatever height the host gives the scheda — no size of their own, in
	 * pixels or otherwise. Each host decides: the dialog is a fixed share of the viewport, the
	 * standalone page sets a floor. That keeps the two tabs identical in both without the
	 * component guessing at a height that could exceed a small screen.
	 */
	const TAB_PANE_CLASS = 'min-h-0 flex-1 overflow-y-auto pt-4';

	/** Only statuses this taxon actually has. A row of zeroes is noise, not information. */
	const occurrenceStats = $derived.by(() => {
		if (distribution.status !== 'success' || !distribution.distribution.occurrenceCounts) return [];
		const counts = distribution.distribution.occurrenceCounts;
		return OCCURRENCE_ORDER.filter((status) => counts[status] > 0).map((status) => ({
			status,
			label: OCCURRENCE_LABELS[status],
			count: counts[status],
			color: APP_MAP_PALETTE.occurrence[status]
		}));
	});

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyPermalink() {
		if (!permalink) return;
		const absolute = new URL(permalink, window.location.origin).toString();
		try {
			await navigator.clipboard.writeText(absolute);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 2000);
		} catch (error) {
			console.error('[TaxonScheda] Could not copy the permalink:', error);
		}
	}
</script>

{#snippet distributionPane()}
	{#if distribution.status === 'loading'}
		<div class="flex h-full min-h-[30dvh] flex-col items-center justify-center gap-3">
			<div
				class="size-8 animate-spin rounded-full border-2 border-surface-200-800 border-t-surface-600-400"
			></div>
			<p class="text-sm text-surface-600-400">Loading distribution…</p>
		</div>
	{:else if distribution.status === 'error'}
		<div class="flex h-full min-h-[30dvh] flex-col items-center justify-center gap-3 text-center">
			<p class="font-medium">Unable to load the distribution</p>
			<p class="text-sm text-surface-600-400">{distribution.message}</p>
			{#if onRetryDistribution}
				<button type="button" class="btn preset-tonal" onclick={onRetryDistribution}>Retry</button>
			{/if}
		</div>
	{:else if distribution.status === 'no-data'}
		<div class="flex h-full min-h-[30dvh] flex-col items-center justify-center gap-2 text-center">
			<p class="font-medium">No distribution recorded</p>
			<p class="text-sm text-surface-600-400">
				This taxon has no areas in the checklist's distribution table.
			</p>
		</div>
	{:else if distribution.status === 'success' && geoJSON}
		{@const data = distribution.distribution}
		{#if occurrenceStats.length > 0}
			<!-- A one-line summary rather than oversized tiles: these are small counts, and the
			     breakdown reads as a sentence, not a dashboard. -->
			<p class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<span class="font-medium">
					{formatCount(data.areaCount)}
					{data.areaCount === 1 ? 'area' : 'areas'}
				</span>
				{#each occurrenceStats as stat (stat.status)}
					<span class="flex items-center gap-1.5 text-surface-700-300">
						<span
							class="size-2 rounded-full"
							style={`background-color: ${stat.color};`}
							aria-hidden="true"
						></span>
						<span class="tabular-nums">{formatCount(stat.count)}</span>
						<span class="text-surface-600-400">{stat.label.toLowerCase()}</span>
					</span>
				{/each}
			</p>
		{/if}

		<div
			class="aspect-[1000/620] max-h-[45dvh] w-full overflow-hidden rounded-container border border-surface-200-800"
		>
			<!-- The map skips null geometries; only the geojson type insists they cannot occur. -->
			<TaxonomyDistributionMap
				geoJSON={geoJSON as FeatureCollection}
				distributionData={data.distributionData}
				occurrenceData={data.occurrenceData}
			/>
		</div>

		{#if data.areasByStatus}
			<!--
				One root per status rather than a flat list: a taxon can reach a hundred areas, and
				which ones are native is the question a reader actually has. `details` gives a real
				disclosure tree — keyboard operable and expandable — with no widget to maintain.
			-->
			<div class="mt-4 space-y-1.5">
				{#each occurrenceStats as stat (stat.status)}
					{@const areas = data.areasByStatus[stat.status]}
					{#if areas.length > 0}
						<!-- Every group starts open: which status a group holds is the point, and
						     collapsing some but not others hides part of the answer. -->
						<details open class="overflow-hidden rounded-container border border-surface-200-800">
							<summary
								class="flex cursor-pointer items-center gap-2 bg-surface-100-900 px-3 py-2 text-sm"
							>
								<span
									class="size-2.5 shrink-0 rounded-sm"
									style={`background-color: ${stat.color};`}
									aria-hidden="true"
								></span>
								<span class="font-medium">{stat.label}</span>
								<span class="text-xs text-surface-600-400">
									{formatCount(areas.length)}
									{areas.length === 1 ? 'area' : 'areas'}
								</span>
							</summary>
							<ul class="columns-1 gap-4 px-3 py-2 text-xs sm:columns-2 lg:columns-3">
								{#each areas as area (area.code)}
									<li class="break-inside-avoid py-0.5">
										<!-- Same destination as clicking the region on the main map. -->
										<a
											href={`${base}/map/${area.code}`}
											class="app-accent-text-hover text-surface-800-200 hover:underline"
										>
											{area.name}
										</a>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet overviewPane()}
	{#if !species}
		<div class="flex h-full min-h-[20dvh] items-center justify-center">
			<div
				class="size-8 animate-spin rounded-full border-2 border-surface-200-800 border-t-surface-600-400"
			></div>
		</div>
	{:else}
		<!-- The facts list is the only place a field appears; the header carries identity alone. -->
		<dl class="mb-6 divide-y divide-surface-200-800">
			{#each facts as fact (fact.label)}
				<div class="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
					<dt class="text-xs text-surface-600-400 sm:w-40 sm:shrink-0">{fact.label}</dt>
					<dd class="text-sm">{fact.value}</dd>
				</div>
			{/each}
		</dl>

		{#if recordedUses.length > 0}
			<p class="mb-2 text-xs text-surface-600-400">
				Uses — {recordedUses.length} of {totalUseCategories} categories
			</p>
			<div class="mb-6 flex flex-wrap gap-1.5">
				{#each recordedUses as use (use.label)}
					{@const Icon = use.icon}
					<span class="chip preset-tonal-primary text-xs">
						<Icon class="size-3.5" aria-hidden="true" />
						<span>{use.label}</span>
					</span>
				{/each}
			</div>
		{/if}

		<!--
			References only. The registry record is cited in the header, where it is also the link,
			so repeating it here would name the same source twice on one card. The bibliography
			runs to 265 entries on the worst taxon, so it collapses once it stops being skimmable.
		-->
		<section class="rounded-container border border-surface-200-800">
			<div class="px-4 py-3">
				<ReferenceList
					references={referenceEntries}
					collapseAbove={REFERENCE_PREVIEW_LIMIT}
					emptyMessage="None recorded"
					idPrefix={`species-${species.wcfpId}`}
				/>
			</div>
		</section>
	{/if}
{/snippet}

<article class="flex h-full min-h-0 flex-col">
	<header class="shrink-0">
		{#if lineage.length > 0}
			<nav
				aria-label="Classification"
				class="mb-2 flex flex-wrap items-center gap-1 text-xs text-surface-600-400"
			>
				{#each lineage as rank, index (rank)}
					{#if index > 0}
						<ChevronRight class="size-3" aria-hidden="true" />
					{/if}
					<span class={index >= lineage.length - 2 ? 'text-surface-700-300' : ''}>{rank}</span>
				{/each}
			</nav>
		{/if}

		<h2 id={titleId} class="pr-10 text-2xl leading-tight sm:text-3xl">
			<span class={isSpecies ? 'italic' : ''}>{taxon.name}</span>
			{#if taxon.authors}
				<span class="ml-2 text-base font-normal text-surface-600-400 not-italic sm:text-lg">
					{taxon.authors}
				</span>
			{/if}
		</h2>

		<!--
			No badge row: life form, uses, area count and the WCFP ID all appear in the facts list
			below, and stating them twice made the card look busier than it is. A higher taxon has
			no facts list, so its rank is labelled here instead.
		-->
		{#if !isSpecies}
			<p class="mt-2 text-sm text-surface-600-400">
				<span class="capitalize">{taxon.rank}</span>
				{#if areaCount > 0}
					<span>
						· present in {formatCount(areaCount)}
						{areaCount === 1 ? 'area' : 'areas'}</span
					>
				{/if}
			</p>
		{/if}

		{#if species?.sourceLink || permalink}
			<div class="mt-3 flex flex-wrap items-center gap-4">
				{#if species?.sourceLink}
					<a
						href={species.sourceLink}
						target="_blank"
						rel="external noreferrer"
						class="app-accent-text inline-flex items-center gap-1.5 text-xs hover:underline"
						title={sourceLabel}
					>
						<ExternalLink class="size-3.5" aria-hidden="true" />
						<!-- Registry and record id: the citation and the link are the same thing. -->
						<span>{sourceCitation}</span>
					</a>
				{/if}
				{#if permalink}
					<button
						type="button"
						class="inline-flex items-center gap-1.5 text-xs text-surface-600-400 hover:text-surface-950-50"
						onclick={copyPermalink}
					>
						{#if copied}
							<Check class="size-3.5" aria-hidden="true" />
							<span>Link copied</span>
						{:else}
							<Link2 class="size-3.5" aria-hidden="true" />
							<span>Copy link</span>
						{/if}
					</button>
				{/if}
			</div>
		{/if}
	</header>

	{#if showTabs}
		<Tabs
			value={view}
			onValueChange={(details) => onViewChange(details.value as SchedaView)}
			class="mt-4 flex min-h-0 flex-1 flex-col"
		>
			<Tabs.List class="shrink-0">
				<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
				<Tabs.Trigger value="distribution">Geographical distribution</Tabs.Trigger>
				<Tabs.Indicator />
			</Tabs.List>
			<!--
				Both panes take the same fixed height and scroll inside it. Left to size themselves
				they differ wildly — a short record against a map plus a hundred listed areas — and
				the card jumped every time the reader switched tab.
			-->
			<Tabs.Content value="overview" class={TAB_PANE_CLASS}>
				{@render overviewPane()}
			</Tabs.Content>
			<Tabs.Content value="distribution" class={TAB_PANE_CLASS}>
				{@render distributionPane()}
			</Tabs.Content>
		</Tabs>
	{:else}
		<div class="mt-4 min-h-0 flex-1 overflow-y-auto">
			{#if isSpecies}
				{@render overviewPane()}
			{:else}
				{@render distributionPane()}
			{/if}
		</div>
	{/if}
</article>
