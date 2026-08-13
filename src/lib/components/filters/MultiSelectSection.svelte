<script lang="ts">
	import type { MultiSelectSectionModel } from '$lib/types/filters';

	interface Props {
		section: MultiSelectSectionModel;
	}

	let { section }: Props = $props();

	function handleChange(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const selectedIds = Array.from(select.selectedOptions).map((option) => option.value);
		section.onChange(selectedIds);
	}
</script>

<div class="filter-group">
	<label for={section.selectId} class="text-xs font-semibold uppercase tracking-wide text-slate-500">
		{section.title}
	</label>
	<select
		id={section.selectId}
		multiple
		class="app-input-accent mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
		style="height: auto; max-height: 120px;"
		onchange={handleChange}
	>
		{#each section.options as option (option.id)}
			<option value={option.id} selected={option.selected}>
				{option.label}
			</option>
		{/each}
	</select>
	{#if section.helpText}
		<p class="mt-1 text-xs text-slate-400">{section.helpText}</p>
	{/if}
</div>
