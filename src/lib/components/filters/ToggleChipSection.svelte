<script lang="ts">
	import type { ToggleChipSectionModel } from '$lib/types/filters';
	import FilterChipButton from './FilterChipButton.svelte';

	interface Props {
		section: ToggleChipSectionModel;
	}

	let { section }: Props = $props();
</script>

<div class="filter-group">
	<span class="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.title}</span>
	<div class="mt-2 flex flex-wrap gap-1.5">
		{#each section.options as option (option.id)}
			<FilterChipButton {option} onClick={() => section.onToggle(option.id)} />
		{/each}
	</div>
</div>
