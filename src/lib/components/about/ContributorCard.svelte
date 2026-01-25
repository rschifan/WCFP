<script lang="ts">
	import type { Contributor } from '$lib/types/contributor';

	interface Props {
		contributor: Contributor;
	}

	let { contributor }: Props = $props();

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
	class="card flex flex-col items-center gap-3 p-4 text-center transition-colors hover:bg-surface-hover-token"
	role="article"
	aria-label="Contributor: {contributor.name}"
>
	<!-- Avatar -->
	{#if contributor.photo}
		<img
			src={contributor.photo}
			alt={contributor.name}
			class="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-surface-200-800-token"
		/>
	{:else}
		<div
			class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xl font-semibold text-on-primary-token ring-2 ring-surface-200-800-token"
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
				rel="noopener noreferrer"
				class="block"
			>
				<h3
					class="text-base font-semibold text-[#80cbc4] hover:text-[#6bb3ad] transition-colors"
				>
					{contributor.name}
				</h3>
			</a>
		{:else}
			<h3 class="text-base font-semibold text-on-surface-token">{contributor.name}</h3>
		{/if}
	</div>

	<!-- Affiliations -->
	<div class="w-full space-y-1">
		{#each contributor.affiliations as affiliation}
			<p class="text-xs leading-relaxed text-on-surface-600-token">{affiliation}</p>
		{/each}
	</div>
</div>
