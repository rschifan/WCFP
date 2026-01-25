<script lang="ts">
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
</script>

<svelte:head>
	<title>About | Plant Explorer</title>
</svelte:head>

<div class="flex min-h-screen w-full flex-col">
	<header class="shrink-0">
		<TopBar />
	</header>

	<main class="flex-1">
		<section class="mx-auto max-w-5xl px-6 py-10">
			<div class="space-y-8">
				<div class="space-y-3">
					<h1 class="text-3xl font-semibold">General description</h1>
					<p class="text-base leading-relaxed">
						The World Checklist of Food Plants 2025 (WCFP) is the most comprehensive global
						inventory of plant species used as food by humans.
					</p>
					<p class="text-base leading-relaxed">
						The checklist includes 26,632 plant species across more than 5,000 genera and 400
						families, including both cultivated and wild plant species traditionally gathered for
						food.
					</p>
					<p class="text-base leading-relaxed">
						The portal provides an interactive environment to explore food plant diversity across
						geographic, taxonomic, and functional dimensions. It is designed as a reference tool for
						researchers, policymakers, conservation practitioners, and anyone interested in
						understanding the breadth and distribution of plant diversity supporting human food
						systems.
					</p>
				</div>

				<div class="space-y-3">
					<h2 class="text-2xl font-semibold">Map view</h2>
					<p class="text-base leading-relaxed">
						The Map allows users to explore the geographic distribution of food plant diversity
						worldwide. Species richness (number of food plant species) is visualised by areas
						defined by the Taxonomic Databases Working Group – Biodiversity Information Standards
						(TDWG), specifically at TDWG Level 3, which corresponds to countries or subnational
						units (see TDWG geographic standard:
						<a
							href="https://www.tdwg.org/"
							class="text-[#80cbc4] hover:underline"
							rel="noopener noreferrer"
							target="_blank">https://www.tdwg.org/</a
						>).
					</p>
					<p class="text-base leading-relaxed">Users can interact with the map to:</p>
					<ul class="list-disc space-y-1 pl-5 text-base">
						<li>identify global and regional hotspots of food plant diversity,</li>
						<li>compare countries and regions,</li>
						<li>access detailed species lists associated with a selected area.</li>
					</ul>
					<p class="text-base leading-relaxed">
						The map highlights broad biogeographic patterns, including the concentration of food
						plant diversity in tropical and subtropical regions, while also reflecting global
						differences in documentation intensity and research coverage.
					</p>
				</div>

				<div class="space-y-3">
					<h2 class="text-2xl font-semibold">Taxonomic navigation</h2>
					<p class="text-base leading-relaxed">
						The Taxonomy view enables hierarchical exploration of food plants across the botanical
						classification system. Users can navigate from higher to lower taxonomic ranks—Kingdom,
						Phylum, Class, Order, Family, Genus and Species—and view the number of food plant
						species associated with each group.
					</p>
				</div>

				<div class="space-y-3">
					<h2 class="text-2xl font-semibold">Species traits</h2>
					<p class="text-base leading-relaxed">
						The portal provides access to a set of species-level traits that describe key biological
						and use-related characteristics of food plants, enabling more detailed exploration and
						analysis of the dataset.
					</p>
					<ul class="list-disc space-y-2 pl-5 text-base">
						<li>
							<span class="font-semibold">Life form</span>
							<span> Indicates the plant growth form (e.g. tree, shrub, herb, climber). </span>
						</li>
						<li>
							<span class="font-semibold">Uses</span>
							<span>
								Multiple use categories based on the World Checklist of Useful Plants (WCUP).
							</span>
						</li>
						<li>
							<span class="font-semibold">Crop Wild Relatives (CWR)</span>
							<span>
								Identifies species recognised as edible crop wild relatives, highlighting taxa that
								are genetically related to cultivated crops and represent an important resource for
								crop diversity, adaptation, and future food system resilience.
							</span>
						</li>
						<li>
							<span class="font-semibold">Cultivated status</span>
							<span>
								Indicates whether a species is cultivated, distinguishing domesticated food plants
								from species that are wild-harvested or managed outside of formal cultivation
								systems.
							</span>
						</li>
					</ul>
				</div>

				<div class="space-y-3">
					<h2 class="text-2xl font-semibold">Contributors</h2>
					<ul class="list-disc space-y-1 pl-5 text-base">
						<li>
							Mauricio Diazgranados – The New York Botanical Garden; Royal Botanic Gardens, Kew
						</li>
						<li>Maraeva Gianella – University of Turin</li>
						<li>
							Laura Kor – University of Kent; King’s College London; Royal Botanic Gardens, Kew
						</li>
						<li>Benedetta Gori – Royal Botanic Gardens, Kew; University of Cagliari</li>
						<li>Colin K. Khoury – The New York Botanical Garden</li>
						<li>Sarah L. Gora – Independent consultant</li>
						<li>Hannes Dempewolf – Gothenburg Botanical Garden; Global Crop Diversity Trust</li>
						<li>Alex C. McAlvay – The New York Botanical Garden</li>
						<li>
							Stefano Diulgheroff – Food and Agriculture Organization of the United Nations (FAO)
						</li>
						<li>Rossano Schifanella - University of Turin; ISI Foundation</li>
						<li>Tiziana Ulian – Royal Botanic Gardens, Kew; University of Turin</li>
					</ul>
				</div>
			</div>
		</section>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
