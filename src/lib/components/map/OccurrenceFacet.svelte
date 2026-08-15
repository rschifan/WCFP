<script lang="ts">
	import { formatCount } from '$lib/utils/format';
	import type { OccurrenceStatusFilter } from '$lib/types/taxonomy';

	interface Facet {
		occurrence_status: OccurrenceStatusFilter;
		count: number;
	}

	interface Props {
		facets: Facet[];
		value: OccurrenceStatusFilter | null;
		onChange: (value: OccurrenceStatusFilter | null) => void;
		/** Disabled when the active measure is published for all occurrences only. */
		disabled?: boolean;
		disabledReason?: string;
		/**
		 * `list` for the wide rail; `chips` inside the region panel, where the taxonomy tree
		 * needs the vertical space more than the filter does.
		 */
		layout?: 'list' | 'chips';
	}

	let {
		facets,
		value,
		onChange,
		disabled = false,
		disabledReason,
		layout = 'list'
	}: Props = $props();

	// Fixed order so the list does not reshuffle as counts change between regions.
	const ORDER: OccurrenceStatusFilter[] = ['native', 'introduced', 'extinct', 'doubtful'];
	const DOT: Record<OccurrenceStatusFilter, string> = {
		native: 'bg-emerald-600',
		introduced: 'bg-amber-600',
		extinct: 'bg-red-800',
		doubtful: 'bg-slate-400'
	};

	const rows = $derived(
		ORDER.map((status) => ({
			status,
			count: facets.find((f) => f.occurrence_status === status)?.count ?? 0
		})).filter((row) => row.count > 0)
	);
</script>

<div class="flex flex-col gap-1.5">
	<span class="text-[11px] font-semibold tracking-[0.11em] text-slate-500 uppercase">
		Occurrence
	</span>

	<div
		class={layout === 'chips' ? 'flex flex-wrap gap-1' : 'flex flex-col gap-0.5'}
		role="group"
		aria-label="Filter by occurrence status"
	>
		{#each rows as row (row.status)}
			<button
				type="button"
				{disabled}
				aria-pressed={value === row.status}
				title={disabled ? disabledReason : `Show only taxa recorded as ${row.status}`}
				onclick={() => onChange(value === row.status ? null : row.status)}
				class="flex items-center gap-1.5 rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40
					{layout === 'chips'
					? 'px-2 py-0.5 text-xs'
					: 'w-full justify-between px-2 py-1 text-left text-sm'}
					{value === row.status
					? 'border-slate-300 bg-white font-semibold text-slate-900'
					: 'border-transparent text-slate-700 hover:bg-slate-50'}"
			>
				<span class="flex min-w-0 items-center gap-1.5">
					<span class="h-2 w-2 shrink-0 rounded-full {DOT[row.status]}"></span>
					<span class="truncate capitalize">{row.status}</span>
				</span>
				<span class="text-xs tabular-nums text-slate-500">{formatCount(row.count)}</span>
			</button>
		{/each}
	</div>

	{#if disabled && disabledReason}
		<p class="text-[11px] leading-snug text-slate-400">{disabledReason}</p>
	{/if}
</div>
