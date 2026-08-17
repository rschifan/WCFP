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

<div
	class="flex flex-col items-center gap-3 p-2 text-center"
	role="article"
	aria-label="Contributor: {contributor.name}"
>
	<!-- Avatar -->
	{#if contributor.photo}
		<img
			src={photoSrc}
			alt={contributor.name}
			class="h-28 w-28 shrink-0 rounded-full object-cover ring-1 ring-surface-200-800"
		/>
	{:else}
		<div
			class="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-surface-900 text-2xl font-semibold text-white ring-1 ring-surface-200-800"
			aria-label="Avatar for {contributor.name}"
		>
			{initials}
		</div>
	{/if}

	<!-- Name -->
	<div class="w-full min-w-0">
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
	<div class="w-full space-y-1">
		{#each contributor.affiliations as affiliation, index (`${contributor.name}-${index}`)}
			<p class="text-xs leading-relaxed text-surface-600-400">{affiliation}</p>
		{/each}
	</div>
</div>
