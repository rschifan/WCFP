<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { MultiSelectSectionModel } from '$lib/types/filters';

	interface Props {
		section: MultiSelectSectionModel;
	}

	let { section }: Props = $props();

	const selected = $derived(section.options.filter((option) => option.selected));

	function handleChange(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const selectedIds = Array.from(select.selectedOptions).map((option) => option.value);
		section.onChange(selectedIds);
	}

	// Deselecting in a multi-select needs a Ctrl/Cmd-click nobody discovers, so each choice also
	// gets a chip that removes it.
	function remove(id: string) {
		section.onChange(selected.filter((option) => option.id !== id).map((option) => option.id));
	}
</script>

<div>
	<label for={section.selectId} class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
		{section.title}
	</label>
	<select
		id={section.selectId}
		multiple
		class="app-input-accent mt-1.5 w-full rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
		style="height: auto; max-height: 68px;"
		onchange={handleChange}
	>
		{#each section.options as option (option.id)}
			<option value={option.id} selected={option.selected}>
				{option.label}
			</option>
		{/each}
	</select>
	{#if selected.length > 0}
		<div class="mt-1.5 flex flex-wrap gap-1">
			{#each selected as option (option.id)}
				<button
					type="button"
					onclick={() => remove(option.id)}
					class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
					aria-label="Remove {option.label} filter"
				>
					{option.label}
					<X class="h-3 w-3" />
				</button>
			{/each}
		</div>
	{/if}
	{#if section.helpText}
		<p class="mt-1 text-[11px] text-slate-400">{section.helpText}</p>
	{/if}
</div>
