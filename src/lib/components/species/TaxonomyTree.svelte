<script lang="ts">
	/**
	 * TaxonomyTree - Collapsible tree visualization of species taxonomy
	 * Hierarchy: Family → Genus → Species
	 */
	import { slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Species } from '$lib/types/species';
	import { formatCount } from '$lib/utils/format';
	import {
		Search,
		X,
		ChevronRight,
		Maximize2,
		Minimize2,
		Pill,
		Flame,
		Bug,
		Dna,
		Skull,
		Users,
		TreeDeciduous,
		Hammer,
		Globe,
		FlaskConical
	} from 'lucide-svelte';

	interface Props {
		species: Species[];
	}

	let { species }: Props = $props();

	// State
	let searchQuery = $state('');
	let expandedFamilies = new SvelteSet<string>();
	let expandedGenera = new SvelteSet<string>();
	let activeTooltip = $state<{ id: string; x: number; y: number } | null>(null);

	// Use icon configuration
	const USE_CONFIG: Record<string, { label: string; description: string; bg: string; icon: typeof Pill }> = {
		medicines: { label: 'Medicinal Uses', description: 'Used in traditional or modern medicine', bg: 'bg-rose-100 hover:bg-rose-200', icon: Pill },
		fuels: { label: 'Fuel Source', description: 'Used as firewood, charcoal, or biofuel', bg: 'bg-orange-100 hover:bg-orange-200', icon: Flame },
		materials: { label: 'Materials', description: 'Used for construction, fiber, or dyes', bg: 'bg-stone-100 hover:bg-stone-200', icon: Hammer },
		poisons: { label: 'Toxic/Poison', description: 'Contains toxic compounds', bg: 'bg-purple-100 hover:bg-purple-200', icon: Skull },
		animalFood: { label: 'Animal Feed', description: 'Used as fodder for livestock', bg: 'bg-lime-100 hover:bg-lime-200', icon: Bug },
		invertebrateFood: { label: 'Invertebrate Food', description: 'Food for bees or silkworms', bg: 'bg-lime-100 hover:bg-lime-200', icon: Bug },
		socialUses: { label: 'Social Uses', description: 'Used in ceremonies or rituals', bg: 'bg-blue-100 hover:bg-blue-200', icon: Users },
		environmentalUses: { label: 'Environmental', description: 'Used for erosion control or restoration', bg: 'bg-teal-100 hover:bg-teal-200', icon: Globe },
		geneSources: { label: 'Genetic Resource', description: 'Source of genetic material for breeding', bg: 'bg-indigo-100 hover:bg-indigo-200', icon: FlaskConical },
		cwr: { label: 'Crop Wild Relative', description: 'Wild ancestor of cultivated crops', bg: 'bg-amber-100 hover:bg-amber-200', icon: Dna },
		lifeform: { label: 'Life Form', description: 'Growth habit and life cycle', bg: 'bg-slate-100 hover:bg-slate-200', icon: TreeDeciduous }
	};

	const ICON_COLORS: Record<string, string> = {
		medicines: 'text-rose-600', fuels: 'text-orange-600', materials: 'text-stone-600',
		poisons: 'text-purple-600', animalFood: 'text-lime-600', invertebrateFood: 'text-lime-600',
		socialUses: 'text-blue-600', environmentalUses: 'text-teal-600', geneSources: 'text-indigo-600'
	};

	// Types
	interface GenusGroup {
		genus: string;
		species: Species[];
		count: number;
	}

	interface FamilyGroup {
		family: string;
		genera: GenusGroup[];
		speciesCount: number;
	}

	// Derived: Group species by family → genus
	let familyGroups = $derived.by((): FamilyGroup[] => {
		const familyMap = new Map<string, Map<string, Species[]>>();

		for (const sp of species) {
			const family = sp.family || 'Unknown';
			const genus = sp.genus || 'Unknown';

			if (!familyMap.has(family)) familyMap.set(family, new Map());
			const genusMap = familyMap.get(family)!;
			if (!genusMap.has(genus)) genusMap.set(genus, []);
			genusMap.get(genus)!.push(sp);
		}

		return Array.from(familyMap.entries())
			.map(([family, genusMap]) => {
				const genera = Array.from(genusMap.entries())
					.map(([genus, spp]) => ({
						genus,
						species: spp.sort((a, b) => a.name.localeCompare(b.name)),
						count: spp.length
					}))
					.sort((a, b) => b.count - a.count || a.genus.localeCompare(b.genus));

				return {
					family,
					genera,
					speciesCount: genera.reduce((sum, g) => sum + g.count, 0)
				};
			})
			.sort((a, b) => b.speciesCount - a.speciesCount || a.family.localeCompare(b.family));
	});

	// Derived: Filter by search query
	let filteredGroups = $derived.by((): FamilyGroup[] => {
		const query = searchQuery.toLowerCase().trim();
		if (!query) return familyGroups;

		return familyGroups
			.map((fam) => {
				const familyMatches = fam.family.toLowerCase().includes(query);
				const filteredGenera = fam.genera
					.map((gen) => {
						const genusMatches = gen.genus.toLowerCase().includes(query);
						const matchingSpecies = gen.species.filter(
							(sp) =>
								sp.name.toLowerCase().includes(query) ||
								sp.authors?.toLowerCase().includes(query)
						);
						if (genusMatches || matchingSpecies.length > 0) {
							return { ...gen, species: genusMatches ? gen.species : matchingSpecies, count: genusMatches ? gen.count : matchingSpecies.length };
						}
						return null;
					})
					.filter((g): g is GenusGroup => g !== null);

				if (familyMatches || filteredGenera.length > 0) {
					return {
						...fam,
						genera: familyMatches ? fam.genera : filteredGenera,
						speciesCount: familyMatches ? fam.speciesCount : filteredGenera.reduce((sum, g) => sum + g.count, 0)
					};
				}
				return null;
			})
			.filter((f): f is FamilyGroup => f !== null);
	});

	// Stats
	let totalSpecies = $derived(species.length);
	let totalFamilies = $derived(familyGroups.length);
	let visibleSpecies = $derived(filteredGroups.reduce((sum, f) => sum + f.speciesCount, 0));
	let visibleFamilies = $derived(filteredGroups.length);

	// Auto-expand when searching
	$effect(() => {
		if (searchQuery.trim()) {
			for (const fam of filteredGroups) {
				expandedFamilies.add(fam.family);
				for (const gen of fam.genera) {
					expandedGenera.add(`${fam.family}:${gen.genus}`);
				}
			}
		}
	});

	// Actions
	function toggleFamily(family: string) {
		expandedFamilies.has(family) ? expandedFamilies.delete(family) : expandedFamilies.add(family);
	}

	function toggleGenus(key: string) {
		expandedGenera.has(key) ? expandedGenera.delete(key) : expandedGenera.add(key);
	}

	function expandAll() {
		for (const fam of filteredGroups) {
			expandedFamilies.add(fam.family);
			for (const gen of fam.genera) expandedGenera.add(`${fam.family}:${gen.genus}`);
		}
	}

	function collapseAll() {
		expandedFamilies.clear();
		expandedGenera.clear();
	}

	function showTooltip(e: MouseEvent | FocusEvent, id: string) {
		const rect = (e.target as HTMLElement).getBoundingClientRect();
		activeTooltip = { id, x: rect.left + rect.width / 2, y: rect.top - 8 };
	}

	function hideTooltip() {
		activeTooltip = null;
	}

	function highlightMatches(text: string, query: string): Array<{ text: string; match: boolean }> {
		if (!query.trim()) return [{ text, match: false }];
		const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escaped})`, 'gi');
		return text.split(regex).filter(Boolean).map((part) => {
			const match = regex.test(part);
			regex.lastIndex = 0;
			return { text: part, match };
		});
	}
</script>

{#snippet highlight(text: string)}
	{#each highlightMatches(text, searchQuery) as { text: t, match }}
		{#if match}<mark class="bg-amber-200 text-amber-900 rounded px-0.5">{t}</mark>{:else}{t}{/if}
	{/each}
{/snippet}

{#snippet badge(id: string, label?: string)}
	{@const cfg = USE_CONFIG[id]}
	<button
		type="button"
		class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] cursor-help {cfg.bg}"
		class:text-slate-600={id === 'lifeform'}
		class:text-amber-700={id === 'cwr'}
		onmouseenter={(e) => showTooltip(e, id)}
		onmouseleave={hideTooltip}
		onfocus={(e) => showTooltip(e, id)}
		onblur={hideTooltip}
	>
		<svelte:component this={cfg.icon} class="h-2.5 w-2.5" />
		{#if label}{label}{/if}
	</button>
{/snippet}

{#snippet useIcon(id: string, active: boolean)}
	{#if active}
		{@const cfg = USE_CONFIG[id]}
		<button
			type="button"
			class="rounded p-0.5 cursor-help {cfg.bg}"
			onmouseenter={(e) => showTooltip(e, id)}
			onmouseleave={hideTooltip}
			onfocus={(e) => showTooltip(e, id)}
			onblur={hideTooltip}
			aria-label={cfg.label}
		>
			<svelte:component this={cfg.icon} class="h-2.5 w-2.5 {ICON_COLORS[id]}" />
		</button>
	{/if}
{/snippet}

<div class="taxonomy-tree flex flex-col h-full mt-2">
	<!-- Tooltip -->
	{#if activeTooltip}
		{@const cfg = USE_CONFIG[activeTooltip.id]}
		<div
			class="fixed z-[100] pointer-events-none"
			style:left="{activeTooltip.x}px"
			style:top="{activeTooltip.y}px"
			style:transform="translate(-50%, -100%)"
			transition:fade={{ duration: 100 }}
		>
			<div class="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs">
				<p class="font-semibold">{cfg?.label}</p>
				<p class="text-slate-300 mt-0.5">{cfg?.description}</p>
			</div>
			<div class="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900"></div>
		</div>
	{/if}

	<!-- Search -->
	<div class="sticky top-0 z-10 bg-white px-4 pb-3 pt-1">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search families, genera, or species..."
				class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-10 text-sm text-black placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					aria-label="Clear search"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>

		<!-- Stats -->
		<div class="mt-2 flex items-center justify-between text-xs text-slate-500">
			<span>
				{#if searchQuery}
					<span class="text-sky-600 font-medium">{visibleFamilies}</span> of {totalFamilies} families,
					<span class="text-sky-600 font-medium">{formatCount(visibleSpecies)}</span> of {formatCount(totalSpecies)} species
				{:else}
					{totalFamilies} families, {formatCount(totalSpecies)} species
				{/if}
			</span>
			<div class="flex gap-1">
				<button type="button" onclick={expandAll} class="rounded px-2 py-1 hover:bg-slate-100" title="Expand all" aria-label="Expand all">
					<Maximize2 class="h-3.5 w-3.5" />
				</button>
				<button type="button" onclick={collapseAll} class="rounded px-2 py-1 hover:bg-slate-100" title="Collapse all" aria-label="Collapse all">
					<Minimize2 class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	</div>

	<!-- Tree -->
	<div class="flex-1 overflow-y-auto px-2">
		{#if filteredGroups.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-center" transition:fade>
				<Search class="h-12 w-12 text-slate-300" strokeWidth={1.5} />
				<p class="mt-3 text-sm font-medium text-slate-600">No results found</p>
				<p class="mt-1 text-xs text-slate-400">Try a different search term</p>
			</div>
		{:else}
			{#each filteredGroups as fam (fam.family)}
				{@const famExpanded = expandedFamilies.has(fam.family)}
				<div transition:slide={{ duration: 200, easing: cubicOut }}>
					<button
						type="button"
						onclick={() => toggleFamily(fam.family)}
						aria-expanded={famExpanded}
						class="group flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-slate-100"
						class:bg-slate-50={famExpanded}
					>
						<ChevronRight class="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 {famExpanded ? 'rotate-90' : ''}" />
						<span class="flex-1 truncate font-semibold text-slate-700 text-sm">
							{#if searchQuery}{@render highlight(fam.family)}{:else}{fam.family}{/if}
						</span>
						<span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 group-hover:bg-slate-300">
							{formatCount(fam.speciesCount)}
						</span>
					</button>

					{#if famExpanded}
						<div class="ml-5 border-l-2 border-slate-200" transition:slide={{ duration: 200, easing: cubicOut }}>
							{#each fam.genera as gen (gen.genus)}
								{@const genKey = `${fam.family}:${gen.genus}`}
								{@const genExpanded = expandedGenera.has(genKey)}
								<div class="pl-4">
									<button
										type="button"
										onclick={() => toggleGenus(genKey)}
										aria-expanded={genExpanded}
										class="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-slate-100"
										class:bg-slate-50={genExpanded}
									>
										<ChevronRight class="h-3 w-3 text-slate-400 transition-transform duration-200 {genExpanded ? 'rotate-90' : ''}" />
										<span class="flex-1 truncate font-medium text-slate-600 text-sm italic">
											{#if searchQuery}{@render highlight(gen.genus)}{:else}{gen.genus}{/if}
										</span>
										<span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 group-hover:bg-slate-200">
											{gen.count}
										</span>
									</button>

									{#if genExpanded}
										<div class="ml-4 border-l border-slate-200 pl-3" transition:slide={{ duration: 150, easing: cubicOut }}>
											{#each gen.species as sp (sp.wcfpId)}
												<div class="rounded-md px-2 py-1 hover:bg-slate-100">
													<p class="text-sm text-slate-800">
														<span class="italic">{#if searchQuery}{@render highlight(sp.name)}{:else}{sp.name}{/if}</span>
														{#if sp.authors}<span class="text-slate-500 text-xs ml-1">{#if searchQuery}{@render highlight(sp.authors)}{:else}{sp.authors}{/if}</span>{/if}
													</p>
													{#if sp.lifeform || sp.cwr || sp.uses}
														<div class="flex flex-wrap items-center gap-1 mt-1">
															{#if sp.lifeform}{@render badge('lifeform', sp.lifeform)}{/if}
															{#if sp.cwr}{@render badge('cwr', 'CWR')}{/if}
															{#if sp.uses}
																<span class="inline-flex items-center gap-0.5 ml-1">
																	{@render useIcon('medicines', !!sp.uses.medicines)}
																	{@render useIcon('fuels', !!sp.uses.fuels)}
																	{@render useIcon('materials', !!sp.uses.materials)}
																	{@render useIcon('poisons', !!sp.uses.poisons)}
																	{@render useIcon('animalFood', !!sp.uses.animalFood)}
																	{@render useIcon('invertebrateFood', !!sp.uses.invertebrateFood)}
																	{@render useIcon('socialUses', !!sp.uses.socialUses)}
																	{@render useIcon('environmentalUses', !!sp.uses.environmentalUses)}
																	{@render useIcon('geneSources', !!sp.uses.geneSources)}
																</span>
															{/if}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
