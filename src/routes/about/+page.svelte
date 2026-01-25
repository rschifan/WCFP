<script lang="ts">
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ContributorCard from '$lib/components/about/ContributorCard.svelte';
	import { contributors } from '$lib/data/contributors';
</script>

<svelte:head>
	<title>About | World Checklist of Food Plants</title>
	<meta
		name="description"
		content="The World Checklist of Food Plants (WCFP) - the most comprehensive global inventory of plant species used as food by humans."
	/>
</svelte:head>

<div class="flex min-h-screen w-full flex-col">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main class="flex-1 bg-surface-50-950-token">
		<div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
			<div class="space-y-8">
				<!-- Hero Section -->
				<div class="card p-8 md:p-10">
					<h1 class="mb-4 text-4xl font-bold text-on-surface-token md:text-5xl">
						World Checklist of Food Plants
					</h1>
					<div class="prose prose-lg max-w-none text-on-surface-700-token">
						<p class="text-lg leading-relaxed">
							The World Checklist of Food Plants 2025 (WCFP) is the most comprehensive global
							inventory of plant species used as food by humans.
						</p>
						<p class="leading-relaxed">
							The checklist includes <strong>26,632 plant species</strong> across more than
							<strong>5,000 genera</strong> and <strong>400 families</strong>, including both
							cultivated and wild plant species traditionally gathered for food.
						</p>
						<p class="leading-relaxed">
							The portal provides an interactive environment to explore food plant diversity across
							geographic, taxonomic, and functional dimensions. It is designed as a reference tool for
							researchers, policymakers, conservation practitioners, and anyone interested in
							understanding the breadth and distribution of plant diversity supporting human food
							systems.
						</p>
					</div>
				</div>

				<!-- Features Section -->
				<div class="space-y-6">
					<!-- Map View Feature -->
					<div class="card p-6 md:p-8">
						<h2 class="mb-4 text-2xl font-semibold text-on-surface-token md:text-3xl">
							Map View
						</h2>
						<div class="prose max-w-none text-on-surface-700-token">
							<p class="leading-relaxed">
								The Map allows users to explore the geographic distribution of food plant diversity
								worldwide. Species richness (number of food plant species) is visualised by areas
								defined by the Taxonomic Databases Working Group – Biodiversity Information Standards
								(TDWG), specifically at TDWG Level 3, which corresponds to countries or subnational
								units (see TDWG geographic standard:
								<a
									href="https://www.tdwg.org/"
									class="text-[#80cbc4] hover:text-[#6bb3ad] underline transition-colors"
									rel="noopener noreferrer"
									target="_blank"
									>https://www.tdwg.org/</a
								>).
							</p>
							<p class="mt-3 leading-relaxed">Users can interact with the map to:</p>
							<ul class="mt-2 list-disc space-y-1 pl-6">
								<li>identify global and regional hotspots of food plant diversity,</li>
								<li>compare countries and regions,</li>
								<li>access detailed species lists associated with a selected area.</li>
							</ul>
							<p class="mt-3 leading-relaxed">
								The map highlights broad biogeographic patterns, including the concentration of food
								plant diversity in tropical and subtropical regions, while also reflecting global
								differences in documentation intensity and research coverage.
							</p>
						</div>
					</div>

					<!-- Taxonomic Navigation Feature -->
					<div class="card p-6 md:p-8">
						<h2 class="mb-4 text-2xl font-semibold text-on-surface-token md:text-3xl">
							Taxonomic Navigation
						</h2>
						<div class="prose max-w-none text-on-surface-700-token">
							<p class="leading-relaxed">
								The Taxonomy view enables hierarchical exploration of food plants across the botanical
								classification system. Users can navigate from higher to lower taxonomic ranks—Kingdom,
								Phylum, Class, Order, Family, Genus and Species—and view the number of food plant
								species associated with each group.
							</p>
						</div>
					</div>

					<!-- Species Traits Feature -->
					<div class="card p-6 md:p-8">
						<h2 class="mb-4 text-2xl font-semibold text-on-surface-token md:text-3xl">
							Species Traits
						</h2>
						<div class="prose max-w-none text-on-surface-700-token">
							<p class="leading-relaxed">
								The portal provides access to a set of species-level traits that describe key biological
								and use-related characteristics of food plants, enabling more detailed exploration and
								analysis of the dataset.
							</p>
							<ul class="mt-4 space-y-3">
								<li>
									<span class="font-semibold text-on-surface-token">Life form</span>
									<span class="text-on-surface-700-token">
										– Indicates the plant growth form (e.g. tree, shrub, herb, climber).
									</span>
								</li>
								<li>
									<span class="font-semibold text-on-surface-token">Uses</span>
									<span class="text-on-surface-700-token">
										– Multiple use categories based on the World Checklist of Useful Plants (WCUP).
									</span>
								</li>
								<li>
									<span class="font-semibold text-on-surface-token">Crop Wild Relatives (CWR)</span>
									<span class="text-on-surface-700-token">
										– Identifies species recognised as edible crop wild relatives, highlighting taxa
										that are genetically related to cultivated crops and represent an important
										resource for crop diversity, adaptation, and future food system resilience.
									</span>
								</li>
								<li>
									<span class="font-semibold text-on-surface-token">Cultivated status</span>
									<span class="text-on-surface-700-token">
										– Indicates whether a species is cultivated, distinguishing domesticated food
										plants from species that are wild-harvested or managed outside of formal
										cultivation systems.
									</span>
								</li>
							</ul>
						</div>
					</div>
				</div>

				<!-- Contributors Section -->
				<div class="space-y-6">
					<div class="card p-6 md:p-8">
						<div class="text-center md:text-left">
							<h2 class="text-3xl font-bold text-on-surface-token md:text-4xl">Contributors</h2>
							<p class="mt-2 text-on-surface-700-token">
								The World Checklist of Food Plants is made possible by the contributions of researchers
								and institutions worldwide.
							</p>
						</div>
					</div>

					<div
						class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
						role="list"
						aria-label="List of contributors"
					>
						{#each contributors as contributor (contributor.name)}
							<div role="listitem" class="flex">
								<ContributorCard {contributor} />
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
