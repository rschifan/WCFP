<script lang="ts">
	import { base } from '$app/paths';
	import type { Contributor } from '$lib/types/contributor';

	interface Props {
		contributor: Contributor;
	}

	let { contributor }: Props = $props();

	// Prepend base path only for site-relative URLs (starting with a single `/`).
	const photoSrc = $derived(
		contributor.photo && contributor.photo.startsWith('/') && !contributor.photo.startsWith('//')
			? `${base}${contributor.photo}`
			: contributor.photo
	);

	// Derived values (computed)
	const initials = $derived(
		contributor.name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);
</script>

<!--
	Two layouts, because a phone is a column and a desktop is a row of columns. Stacked and centred
	from `sm` up, where the card has a column of its own. Below that the grid is one card wide, and
	centring a portrait in 343px of width leaves the affiliations reading down a narrow gutter — so
	the card turns on its side: portrait left, name and affiliations right, filling the line.
-->
<div
	class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 p-2 text-left sm:flex sm:flex-col sm:gap-3 sm:text-center"
	role="article"
	aria-label="Contributor: {contributor.name}"
>
	<!-- Avatar -->
	{#if contributor.photo}
		<img
			src={photoSrc}
			alt={contributor.name}
			class="row-span-2 h-18 w-18 shrink-0 rounded-full object-cover ring-1 ring-surface-200-800 sm:h-28 sm:w-28"
		/>
	{:else}
		<div
			class="row-span-2 flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-surface-900 text-xl font-semibold text-white ring-1 ring-surface-200-800 sm:h-28 sm:w-28 sm:text-2xl"
			aria-label="Avatar for {contributor.name}"
		>
			{initials}
		</div>
	{/if}

	<!-- Name -->
	<div class="w-full min-w-0 self-end sm:self-auto">
		{#if contributor.website}
			<a
				href={contributor.website}
				target="_blank"
				rel="external noopener noreferrer"
				class="block"
			>
				<h3 class="app-accent-text app-accent-text-hover text-lg font-semibold transition-colors">
					{contributor.name}
				</h3>
			</a>
		{:else}
			<h3 class="text-lg font-semibold text-surface-950-50">{contributor.name}</h3>
		{/if}
	</div>

	<!-- Affiliations -->
	<div class="w-full space-y-1 self-start sm:self-auto">
		{#each contributor.affiliations as affiliation, index (`${contributor.name}-${index}`)}
			<p class="text-xs leading-relaxed text-surface-600-400">{affiliation}</p>
		{/each}
	</div>
</div>
