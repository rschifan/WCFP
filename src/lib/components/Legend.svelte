<script lang="ts">
	import { formatCountMaxDigits } from '$lib/utils/format';

	type Position = 'top' | 'bottom' | 'bottom-left';

	interface LegendColors {
		low: string;
		mid: string;
		high: string;
	}

	interface Props {
		min: number;
		mid: number;
		max: number;
		title?: string;
		subtitle?: string;
		position?: Position;
		className?: string;
		colors?: LegendColors;
		showLevelLabels?: boolean;
		maxDigits?: number;
		/** Overrides the compact integer formatting — a share is not a count. */
		format?: (value: number) => string;
		noDataColor?: string;
		noDataLabel?: string;
		/**
		 * Present when the map classifies rather than stretches a ramp: one swatch per class,
		 * labelled with the class boundaries. `breaks` holds the interior edges, so there is
		 * always one more colour than break.
		 */
		steps?: { breaks: readonly number[]; palette: readonly string[] };
	}

	let {
		min,
		mid,
		max,
		title = 'Legend',
		subtitle,
		position = 'top',
		className = '',
		colors = { low: '#e5f5e0', mid: '#a1d99b', high: '#31a354' },
		showLevelLabels = false,
		maxDigits = 4,
		format,
		noDataColor,
		noDataLabel = 'No data',
		steps
	}: Props = $props();

	const subtitleId = $derived(
		`legend-subtitle-${
			title
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9]+/g, '-') || 'legend'
		}`
	);
	const positionClass = $derived(
		position === 'bottom-left' ? 'bottom-4 left-4' : position === 'bottom' ? 'bottom-2' : 'top-6'
	);
	const centerClass = $derived(position === 'bottom-left' ? '' : 'left-1/2 -translate-x-1/2');
	const fmt = $derived((value: number) => (format ? format(value) : formatCountMaxDigits(value, maxDigits)));
	const gradientStyle = $derived(
		`background: linear-gradient(to right, ${colors.low} 0%, ${colors.mid} 50%, ${colors.high} 100%);`
	);
</script>

<div
	class={`absolute ${centerClass} ${positionClass} z-10 ${className}`}
	role="group"
	aria-label={title}
	aria-describedby={subtitle ? subtitleId : undefined}
>
	<div class="flex items-center gap-4 rounded-xl bg-white px-3 py-3 shadow-xl">
		<div class="min-w-0">
			<div class="text-sm font-semibold text-slate-800">{title}</div>
			{#if subtitle}
				<div class="text-xs text-slate-500" id={subtitleId}>{subtitle}</div>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			{#if steps}
				<!-- Equal-count classes: the swatches are the scale, so no gradient and no midpoint. -->
				<div class="flex w-60">
					{#each steps.palette as color, index (index)}
						<div class="h-2 flex-1" style={`background-color: ${color};`}></div>
					{/each}
				</div>
				<div class="flex w-60 text-[10px] text-slate-600">
					<span class="flex-1 text-left tabular-nums">{fmt(min)}</span>
					{#each steps.breaks as value, index (index)}
						<span class="flex-1 text-right tabular-nums">{fmt(value)}</span>
					{/each}
					<span class="flex-1 text-right tabular-nums">{fmt(max)}</span>
				</div>
			{:else}
			<div class="relative">
				<div class="h-2 w-60" style={gradientStyle}></div>
				<div class="absolute top-1/2 left-0 h-2 w-px -translate-y-1/2 bg-slate-800"></div>
				<div class="absolute top-1/2 left-1/2 h-2 w-px -translate-y-1/2 bg-slate-800"></div>
				<div class="absolute top-1/2 right-0 h-2 w-px -translate-y-1/2 bg-slate-800"></div>
			</div>

			<div class="grid grid-cols-3 text-xs text-slate-600">
				<div class="justify-self-start text-left">
					<div class="font-bold text-slate-700">{fmt(min)}</div>
					{#if showLevelLabels}
						<div class="text-slate-500">Low</div>
					{/if}
				</div>
				<div class="text-center">
					<div class="font-bold text-slate-700">{fmt(mid)}</div>
					{#if showLevelLabels}
						<div class="text-slate-500">Medium</div>
					{/if}
				</div>
				<div class="justify-self-end text-right">
					<div class="font-bold text-slate-700">{fmt(max)}</div>
					{#if showLevelLabels}
						<div class="text-slate-500">High</div>
					{/if}
				</div>
			</div>
			{/if}

			{#if noDataColor}
				<div class="flex items-center gap-2 text-xs text-slate-600">
					<span
						class="h-3 w-3 border border-slate-300"
						style={`background-color: ${noDataColor};`}
						aria-hidden="true"
					></span>
					<span>{noDataLabel}</span>
				</div>
			{/if}
		</div>
	</div>
</div>
