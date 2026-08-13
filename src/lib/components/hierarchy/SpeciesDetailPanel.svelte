<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import OverlayPanel from './OverlayPanel.svelte';
	import { buildRegionSpeciesBadges } from './presets';
	import HierarchyEntryBadges from './HierarchyEntryBadges.svelte';
	import { getSpeciesUseCategories } from '$lib/utils/species/metadata';
	import type { Species } from '$lib/types/species';

	interface Props {
		species?: Species | null;
		onClose: () => void;
		returnFocusTo?: HTMLElement | null;
	}

	let { species = null, onClose, returnFocusTo = null }: Props = $props();

	const titleId = $derived(
		species ? `species-detail-title-${species.wcfpId}` : 'species-detail-title'
	);
	const badges = $derived(species ? buildRegionSpeciesBadges(species) : []);
	const useCategories = $derived(species ? getSpeciesUseCategories(species) : []);
</script>

<OverlayPanel
	open={Boolean(species)}
	{titleId}
	{onClose}
	{returnFocusTo}
	panelClass="max-w-[min(56rem,100%)]"
>
	{#if species}
		<div class="space-y-6 sm:space-y-7">
			<div class="space-y-3">
				<p class="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
					Species details
				</p>
				<div class="space-y-2">
					<h2 id={titleId} class="pr-10 text-2xl leading-tight text-slate-900 sm:text-3xl">
						<span class="italic">{species.name}</span>
						{#if species.authors}
							<span class="ml-2 text-base text-slate-500 not-italic sm:text-lg">
								{species.authors}
							</span>
						{/if}
					</h2>
					<p class="text-sm text-slate-500 sm:text-base">
						{species.family}
						{#if species.genus}
							<span> · {species.genus}</span>
						{/if}
					</p>
				</div>
			</div>

			{#if badges.length > 0}
				<section class="rounded-2xl border border-white/60 bg-slate-50/80 p-4">
					<p class="mb-3 text-xs font-medium tracking-[0.12em] text-slate-600 uppercase">Traits</p>
					<HierarchyEntryBadges {badges} />
				</section>
			{/if}

			<div class="grid gap-4 sm:grid-cols-2">
				<section class="rounded-2xl border border-white/60 bg-slate-50/80 p-4">
					<p class="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">Life form</p>
					<p class="mt-2 text-sm text-slate-700 sm:text-base">
						{species.lifeform ?? 'Not recorded'}
					</p>
				</section>

				<section class="rounded-2xl border border-white/60 bg-slate-50/80 p-4">
					<p class="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">
						Crop wild relative
					</p>
					<p class="mt-2 text-sm text-slate-700 sm:text-base">{species.cwr ? 'Yes' : 'No'}</p>
				</section>
			</div>

			<section class="rounded-2xl border border-white/60 bg-slate-50/80 p-4">
				<p class="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">Uses</p>
				{#if useCategories.length > 0}
					<p class="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
						{useCategories.map((category) => category.label).join(', ')}
					</p>
				{:else}
					<p class="mt-2 text-sm text-slate-700 sm:text-base">No documented uses</p>
				{/if}
			</section>

			{#if species.sourceLink}
				<section class="rounded-2xl border border-white/60 bg-slate-50/80 p-4">
					<p class="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">
						Main taxonomic source
					</p>
					<a
						href={species.sourceLink}
						target="_blank"
						rel="external noreferrer"
						class="app-accent-text mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline sm:text-base"
					>
						<span>Open source link</span>
						<ExternalLink class="h-4 w-4" aria-hidden="true" />
					</a>
				</section>
			{/if}

			<section class="rounded-2xl border border-white/60 bg-slate-50/80 p-4">
				<p class="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">Sources</p>
				{#if species.referencesAll?.length}
					<ul class="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
						{#each species.referencesAll as reference, index (`${species.wcfpId}-${index}`)}
							<li>{reference}</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-2 text-sm text-slate-500">No source references listed.</p>
				{/if}
			</section>
		</div>
	{/if}
</OverlayPanel>
