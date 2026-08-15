<script lang="ts">
	/**
	 * Segmented control selecting which occurrence records the choropleth counts.
	 *
	 * "All" is the default and costs nothing: the unfiltered counts already ship embedded in the
	 * regions GeoJSON, so no request is made until a status is chosen.
	 */
	export type OccurrenceFilterValue = 'all' | 'native' | 'introduced';

	interface Props {
		value: OccurrenceFilterValue;
		onChange: (value: OccurrenceFilterValue) => void;
		loading?: boolean;
	}

	let { value, onChange, loading = false }: Props = $props();

	const options: { id: OccurrenceFilterValue; label: string; hint: string }[] = [
		{ id: 'all', label: 'All', hint: 'Every recorded occurrence' },
		{ id: 'native', label: 'Native', hint: 'Occurrences recorded as native' },
		{ id: 'introduced', label: 'Introduced', hint: 'Occurrences recorded as introduced' }
	];
</script>

<div
	class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
	role="radiogroup"
	aria-label="Filter map by occurrence status"
	aria-busy={loading}
>
	{#each options as option (option.id)}
		<button
			type="button"
			role="radio"
			aria-checked={value === option.id}
			title={option.hint}
			onclick={() => onChange(option.id)}
			class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {value === option.id
				? 'bg-white text-slate-900 shadow-sm'
				: 'text-slate-600 hover:text-slate-900'}"
		>
			{option.label}
		</button>
	{/each}
</div>
