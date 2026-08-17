<script lang="ts">
	/**
	 * What the checklist is, how to get it, and what it records.
	 *
	 * Every figure on this page is read from the database at load time. They were literals until a
	 * post-submission audit moved the published total from 26,632 to 26,622 and the page went on
	 * showing the old number; deriving them means the page cannot disagree with the data it serves.
	 */
	import { Database, ExternalLink, Globe, ListTree, Scale } from 'lucide-svelte';
	import ContributorCard from '$lib/components/about/ContributorCard.svelte';
	import { HierarchyEntryBadges } from '$lib/components/hierarchy';
	import InfoSections from '$lib/components/help/InfoSections.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { WCFP_DATASET } from '$lib/constants/dataset';
	import { ADDITIONAL_USE_CATEGORIES } from '$lib/constants/portal-help';
	import { APP_MAP_PALETTE } from '$lib/constants/palette';
	import { aboutHelpSections, aboutReferences } from '$lib/data/about-help';
	import { contributors } from '$lib/data/contributors';
	import { OCCURRENCE_LABELS, OCCURRENCE_ORDER } from '$lib/map/color-scale';
	import { formatCount } from '$lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const summary = $derived(data.summary);

	const SECTION = 'border-b border-surface-200-800 py-10';
	const EYEBROW = 'text-sm font-semibold tracking-[0.18em] text-surface-600-400 uppercase';
	const H2 = 'mt-3 text-3xl font-bold tracking-tight md:text-4xl';
	const LEAD = 'mt-4 text-base leading-7 text-surface-700-300 md:text-lg';

	/**
	 * Human food is the inclusion criterion, not one facet among ten: only taxa with a documented
	 * human food use entered the checklist, so that count is always the total. Listing it beside the
	 * others would read as a distribution and invite a comparison the data does not support.
	 */
	const additionalUses = $derived(
		ADDITIONAL_USE_CATEGORIES.map((category) => ({
			...category,
			count: summary.uses[category.key]
		}))
			.sort((a, b) => b.count - a.count)
			// Rendered through the badge component the glossary table and the species rows use, so the
			// same nine categories carry the same icon and the same colour everywhere they appear.
			.map((category) => ({
				id: `about-use-count:${category.id}`,
				icon: category.icon,
				tone: category.tone,
				label: `${category.label} ${formatCount(category.count)}`,
				tooltip: category.label,
				description: category.definition
			}))
	);

	const occurrenceStats = $derived(
		OCCURRENCE_ORDER.filter((status) => summary.occurrenceRecords[status] > 0).map((status) => ({
			status,
			label: OCCURRENCE_LABELS[status],
			count: summary.occurrenceRecords[status],
			color: APP_MAP_PALETTE.occurrence[status]
		}))
	);

	const portalFeatures = [
		{
			title: 'Map',
			description:
				'Explore food plant diversity by geographic area through TDWG Level 3 regions, compare countries and territories, and examine the regional distribution of food plant richness.',
			icon: Globe
		},
		{
			title: 'Taxonomy',
			description:
				'Browse the checklist through botanical classification and traits, moving from higher taxonomic ranks to family, genus, and species-level information.',
			icon: ListTree
		}
	] as const;
</script>

<svelte:head>
	<title>About | World Checklist of Food Plants</title>
	<meta
		name="description"
		content="What the World Checklist of Food Plants records, how to download and cite the published dataset, and how to read the portal's glossary and data notes."
	/>
</svelte:head>

<div class="flex min-h-screen w-full flex-col">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main class="flex-1">
		<div class="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
			<section class="border-b border-surface-200-800 pb-10">
				<div class="grid gap-10 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
					<div>
						<p class={EYEBROW}>About the Portal</p>
						<h1 class="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
							World Checklist of Food Plants
						</h1>
						<div class="mt-5 space-y-4 text-base leading-8 text-surface-700-300 md:text-lg">
							<p>
								The World Checklist of Food Plants 2026 is the most comprehensive global inventory
								of plant taxa used as food by humans, spanning both cultivated taxa and wild plants
								traditionally gathered for food.
							</p>
							<p>
								This portal provides a structured environment for exploring food plant diversity
								across geography, taxonomy, and species characteristics. It is intended as a
								reference resource for researchers, conservation practitioners, policymakers, and
								all users interested in how food plant diversity is documented and distributed
								worldwide.
							</p>
						</div>
					</div>

					<div
						class="border-t border-surface-200-800 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
					>
						<dl class="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-5">
							<div>
								<dt class="text-sm font-medium text-surface-600-400">Plant taxa</dt>
								<dd class="mt-2 text-3xl font-bold tracking-tight tabular-nums">
									{formatCount(summary.taxa)}
								</dd>
								<p class="mt-1 text-sm text-surface-600-400">
									{formatCount(summary.species)} species
								</p>
							</div>
							<div>
								<dt class="text-sm font-medium text-surface-600-400">Genera</dt>
								<dd class="mt-2 text-3xl font-bold tracking-tight tabular-nums">
									{formatCount(summary.genera)}
								</dd>
							</div>
							<div>
								<dt class="text-sm font-medium text-surface-600-400">Families</dt>
								<dd class="mt-2 text-3xl font-bold tracking-tight tabular-nums">
									{formatCount(summary.families)}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</section>

			<!--
				The deposit, second on the page. The manuscript links here from four places and the data
				is the reason most readers arrive, so it sits above the navigation guide rather than
				below the glossary. Nothing is served from this site: figshare is the repository of
				record and the DOI is the download.
			-->
			<section class={SECTION}>
				<p class={EYEBROW}>Data availability</p>
				<h2 class={H2}>Download the dataset</h2>
				<p class={LEAD}>
					The complete checklist behind this portal is deposited on {WCFP_DATASET.repository} under a
					persistent DOI. It is the same data the portal serves, published openly and citable.
				</p>

				<div class="mt-6 rounded-container border border-surface-200-800 bg-surface-50-950 p-5">
					<div class="flex flex-wrap items-center gap-x-6 gap-y-4">
						<a
							href={WCFP_DATASET.url}
							target="_blank"
							rel="external noopener noreferrer"
							class="app-accent-button btn"
						>
							<Database class="size-4" aria-hidden="true" />
							<span>Get the data on {WCFP_DATASET.repository}</span>
							<ExternalLink class="size-3.5" aria-hidden="true" />
						</a>

						<dl class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
							<div class="flex items-center gap-2">
								<Scale class="size-4 text-surface-600-400" aria-hidden="true" />
								<dt class="sr-only">Licence</dt>
								<dd>
									<a
										href={WCFP_DATASET.licenceUrl}
										target="_blank"
										rel="external noopener noreferrer"
										class="app-accent-text hover:underline">{WCFP_DATASET.licence}</a
									>
								</dd>
							</div>
							<div>
								<dt class="sr-only">Archive</dt>
								<dd class="text-surface-600-400">
									{WCFP_DATASET.archive} · {WCFP_DATASET.archiveSize}
								</dd>
							</div>
							<div>
								<dt class="sr-only">Deposit version</dt>
								<dd class="text-surface-600-400">
									{WCFP_DATASET.version} · {WCFP_DATASET.posted}
								</dd>
							</div>
						</dl>
					</div>

					<div class="mt-5 border-t border-surface-200-800 pt-4">
						<div class="flex items-baseline justify-between gap-4">
							<h3 class="text-xs text-surface-600-400">Cite the dataset as</h3>
							<CopyButton
								value={WCFP_DATASET.citation}
								label="Copy citation"
								copiedLabel="Citation copied"
							/>
						</div>
						<p class="mt-2 text-sm leading-relaxed text-surface-800-200">
							{WCFP_DATASET.citation}
						</p>
					</div>
				</div>
			</section>

			<section class={SECTION}>
				<p class={EYEBROW}>Contents</p>
				<h2 class={H2}>What the checklist records</h2>
				<p class={LEAD}>
					Every taxon here has a documented human food use — that is the criterion for inclusion, so
					all {formatCount(summary.taxa)} qualify. Everything below describes that set.
				</p>

				<div class="mt-8 grid gap-8 md:grid-cols-2">
					<div>
						<h3 class="text-xs text-surface-600-400">Taxonomic scope</h3>
						<p class="mt-1 text-sm leading-6 text-surface-700-300">
							{formatCount(summary.taxa)} accepted records — {formatCount(summary.species)} species,
							{formatCount(summary.hybrids)} hybrids and {summary.graftChimaerae} graft-chimaerae — across
							{formatCount(summary.genera)} genera, {formatCount(summary.families)} families,
							{formatCount(summary.orders)} orders, {formatCount(summary.classes)} classes and
							{formatCount(summary.phyla)} phyla. Counts on this portal are taxa unless stated otherwise.
						</p>
						<!--
							Two independent GRIN flags, so these do not partition the checklist: a taxon can
							be cultivated, an edible crop wild relative, both, or neither.
						-->
						<p class="mt-3 text-sm text-surface-700-300">
							{formatCount(summary.cultivated)} are cultivated taxa and {formatCount(summary.cwr)}
							are edible crop wild relatives; a taxon may be either, both or neither.
						</p>
					</div>

					<div>
						<h3 class="text-xs text-surface-600-400">Geographic coverage</h3>
						<p class="mt-1 text-sm leading-6 text-surface-700-300">
							{formatCount(summary.distributionRecords)} records place
							{formatCount(summary.taxaWithDistribution)} taxa across
							{formatCount(summary.areas)} TDWG Level 3 areas, each classified by occurrence status.
						</p>
						<!--
							The same swatches the maps use, so a reader arriving here from a species map
							recognises them without a second legend to learn.
						-->
						<ul class="mt-3 space-y-1.5">
							{#each occurrenceStats as stat (stat.status)}
								<li class="flex items-center gap-2 text-sm">
									<span
										class="size-2.5 shrink-0 rounded-sm"
										style={`background-color: ${stat.color};`}
										aria-hidden="true"
									></span>
									<span class="tabular-nums">{formatCount(stat.count)}</span>
									<span class="text-surface-600-400">{stat.label.toLowerCase()}</span>
								</li>
							{/each}
						</ul>
					</div>
				</div>

				<div class="mt-8">
					<h3 class="text-xs text-surface-600-400">Uses recorded in addition to human food</h3>
					<p class="mt-1 text-sm leading-6 text-surface-700-300">
						A taxon may fall into several of these, or none. They are counts within the checklist,
						not a breakdown of it.
					</p>
					<div class="mt-3">
						<HierarchyEntryBadges badges={additionalUses} />
					</div>
				</div>
			</section>

			<section class={SECTION}>
				<div class="lg:max-w-4xl">
					<p class={EYEBROW}>Portal Guide</p>
					<h2 class={H2}>How to navigate the portal</h2>
					<p class={LEAD}>
						The portal offers two main ways to explore the checklist. You can start from the map to
						examine food plant diversity by area, or from taxonomy to browse the checklist through
						botanical classification and associated traits.
					</p>
				</div>

				<div
					class="mt-8 divide-y divide-surface-200-800 border-y border-surface-200-800 md:grid md:grid-cols-2 md:divide-x md:divide-y-0"
				>
					{#each portalFeatures as feature (feature.title)}
						{@const Icon = feature.icon}
						<article class="px-0 py-5 md:px-6">
							<div class="flex size-10 items-center justify-center rounded-lg bg-surface-100-900">
								<Icon class="size-5 text-surface-600-400" aria-hidden="true" />
							</div>
							<h3 class="mt-4 text-xl font-semibold">{feature.title}</h3>
							<p class="mt-3 text-sm leading-7 text-surface-700-300 md:text-base">
								{feature.description}
							</p>
						</article>
					{/each}
				</div>
			</section>

			<section class={SECTION}>
				<InfoSections
					title="Glossary and Data Notes"
					intro="This guide explains the main categories, trait labels, and distribution notes used throughout the portal so that the checklist can be interpreted consistently."
					sections={aboutHelpSections}
					references={aboutReferences}
					referencesTitle="Sources"
				/>
			</section>

			<section class="py-10">
				<div class="lg:max-w-4xl">
					<p class={EYEBROW}>Contributors</p>
					<h2 class={H2}>The team behind WCFP</h2>
					<p class={LEAD}>
						The World Checklist of Food Plants is made possible by an international group of
						researchers and partner institutions contributing botanical, geographic, and data
						expertise.
					</p>
				</div>

				<div
					class="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:auto-rows-fr sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] sm:gap-y-8"
					role="list"
					aria-label="List of contributors"
				>
					{#each contributors as contributor (contributor.name)}
						<div role="listitem">
							<ContributorCard {contributor} />
						</div>
					{/each}
				</div>
			</section>
		</div>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
