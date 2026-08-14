<script lang="ts">
	import { Globe, ListTree } from 'lucide-svelte';
	import ContributorCard from '$lib/components/about/ContributorCard.svelte';
	import InfoSections from '$lib/components/help/InfoSections.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import { aboutHelpSections } from '$lib/data/about-help';
	import { contributors } from '$lib/data/contributors';

	const summaryStats: { label: string; value: string; note?: string }[] = [
		{ label: 'Plant taxa', value: '26,622', note: '26,419 species' },
		{ label: 'Genera', value: '5,009' },
		{ label: 'Families', value: '412' }
	];

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
		content="Learn about the World Checklist of Food Plants, how the portal works, and how to interpret the glossary and data notes."
	/>
</svelte:head>

<div class="flex min-h-screen w-full flex-col bg-white">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main class="flex-1 bg-white">
		<div class="w-full px-4 py-8 md:px-6 md:py-12 lg:px-8 xl:px-10">
			<div>
				<section class="border-b border-slate-200 pb-10">
					<div class="grid gap-10 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
						<div>
							<p class="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
								About the Portal
							</p>
							<h1 class="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
								World Checklist of Food Plants
							</h1>
							<div class="mt-5 space-y-4 text-base leading-8 text-slate-700 md:text-lg">
								<p>
									The World Checklist of Food Plants 2026 is the most comprehensive global inventory
									of plant taxa used as food by humans, spanning both cultivated taxa and wild
									plants traditionally gathered for food.
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

						<div class="border-t border-slate-200 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
							<dl class="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-5">
								{#each summaryStats as stat (stat.label)}
									<div>
										<dt class="text-sm font-medium text-slate-500">{stat.label}</dt>
										<dd class="mt-2 text-3xl font-bold tracking-tight text-slate-900">
											{stat.value}
										</dd>
										{#if stat.note}
											<p class="mt-1 text-sm text-slate-500">{stat.note}</p>
										{/if}
									</div>
								{/each}
							</dl>
						</div>
					</div>
				</section>

				<section class="border-b border-slate-200 py-10">
					<div class="lg:max-w-4xl">
						<p class="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
							Portal Guide
						</p>
						<h2 class="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
							How to navigate the portal
						</h2>
						<p class="mt-4 text-base leading-7 text-slate-600 md:text-lg">
							The portal offers two main ways to explore the checklist. You can start from the map
							to examine food plant diversity by area, or from taxonomy to browse the checklist
							through botanical classification and associated traits.
						</p>
					</div>

					<div
						class="mt-8 divide-y divide-slate-200 border-y border-slate-200 md:grid md:grid-cols-2 md:divide-x md:divide-y-0"
					>
						{#each portalFeatures as feature (feature.title)}
							{@const Icon = feature.icon}
							<article class="px-0 py-5 md:px-6">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
									<Icon class="h-5 w-5 text-slate-600" />
								</div>
								<h3 class="mt-4 text-xl font-semibold text-slate-900">{feature.title}</h3>
								<p class="mt-3 text-sm leading-7 text-slate-600 md:text-base">
									{feature.description}
								</p>
							</article>
						{/each}
					</div>
				</section>

				<section class="border-b border-slate-200 py-10">
					<InfoSections
						title="Glossary and Data Notes"
						intro="This guide explains the main categories, trait labels, and distribution notes used throughout the portal so that the checklist can be interpreted consistently."
						sections={aboutHelpSections}
					/>
				</section>

				<section class="py-10">
					<div class="lg:max-w-4xl">
						<p class="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
							Contributors
						</p>
						<h2 class="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
							The team behind WCFP
						</h2>
						<p class="mt-4 text-base leading-7 text-slate-600 md:text-lg">
							The World Checklist of Food Plants is made possible by an international group of
							researchers and partner institutions contributing botanical, geographic, and data
							expertise.
						</p>
					</div>

					<div
						class="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
						role="list"
						aria-label="List of contributors"
					>
						{#each contributors as contributor (contributor.name)}
							<div role="listitem" class="flex">
								<ContributorCard {contributor} />
							</div>
						{/each}
					</div>
				</section>
			</div>
		</div>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
