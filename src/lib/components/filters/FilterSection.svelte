<script lang="ts">
	import type { FilterSectionModel } from '$lib/types/filters';
	import ToggleChipSection from './ToggleChipSection.svelte';
	import MultiChipSection from './MultiChipSection.svelte';
	import MultiSelectSection from './MultiSelectSection.svelte';

	interface Props {
		section: FilterSectionModel;
	}

	let { section }: Props = $props();
</script>

{#if section.kind === 'toggle-chip'}
	<ToggleChipSection section={section} />
{:else if section.kind === 'multi-chip'}
	<MultiChipSection section={section} />
{:else}
	<MultiSelectSection section={section} />
{/if}
