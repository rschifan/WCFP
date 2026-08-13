<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { ActiveFilterChip } from '$lib/types/filters';

	interface Props {
		chips: ActiveFilterChip[];
	}

	let { chips }: Props = $props();
</script>

<div class="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2">
	{#each chips as chip (chip.id)}
		<button
			type="button"
			onclick={chip.onRemove}
			class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
		>
			{#if chip.icon}
				{@const Icon = chip.icon}
				<Icon class="h-3 w-3" aria-hidden="true" />
			{/if}
			{chip.label}
			<X class="h-3 w-3" />
		</button>
	{/each}
</div>
