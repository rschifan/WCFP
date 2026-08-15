<script lang="ts">
	import type { MultiChipSectionModel } from '$lib/types/filters';
	import FilterChipButton from './FilterChipButton.svelte';

	interface Props {
		section: MultiChipSectionModel;
	}

	let { section }: Props = $props();
</script>

<div>
	<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{section.title}</span>
	<div class="mt-1.5 flex flex-wrap gap-1">
		{#each section.options as option (option.id)}
			<FilterChipButton {option} onClick={() => section.onToggle(option.id)} />
		{/each}
	</div>
</div>
