<script lang="ts">
	/**
	 * What the choropleth is coloured by. A map-level control, deliberately separate from the
	 * filters in the region panel: this changes the world view, those narrow one region's list.
	 */
	export type MapMode = 'all' | 'native' | 'introduced' | 'extinct' | 'doubtful' | 'pct';

	interface Props {
		value: MapMode;
		onChange: (value: MapMode) => void;
		/** Set when a mode's data is still loading, so the bar can say so without moving. */
		loading?: boolean;
	}

	let { value, onChange, loading = false }: Props = $props();

	const OCCURRENCE: { id: MapMode; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'native', label: 'Native' },
		{ id: 'introduced', label: 'Introduced' },
		{ id: 'extinct', label: 'Extinct' },
		{ id: 'doubtful', label: 'Doubtful' }
	];
</script>

<div
	class="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-slate-200 bg-white px-6 py-2"
	role="radiogroup"
	aria-label="Colour the map by"
	aria-busy={loading}
>
	{#each OCCURRENCE as option (option.id)}
		<button
			type="button"
			role="radio"
			aria-checked={value === option.id}
			onclick={() => onChange(option.id)}
			class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {value === option.id
				? 'bg-slate-900 text-white'
				: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
		>
			{option.label}
		</button>
	{/each}

	<span class="mx-2 h-4 w-px bg-slate-200" aria-hidden="true"></span>

	<button
		type="button"
		role="radio"
		aria-checked={value === 'pct'}
		title="WCFP taxa as a percentage of each area's total accepted vascular flora — the paper's Fig. 4, which removes the distortion caused by the very uneven size of TDWG areas"
		onclick={() => onChange('pct')}
		class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {value === 'pct'
			? 'bg-slate-900 text-white'
			: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
	>
		% of flora
	</button>
</div>
