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
		noDataLabel = 'No data'
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
			<div class="relative">
				<div class="h-2 w-60" style={gradientStyle}></div>
				<div class="absolute top-1/2 left-0 h-2 w-px -translate-y-1/2 bg-slate-800"></div>
				<div class="absolute top-1/2 left-1/2 h-2 w-px -translate-y-1/2 bg-slate-800"></div>
				<div class="absolute top-1/2 right-0 h-2 w-px -translate-y-1/2 bg-slate-800"></div>
			</div>

			<div class="grid grid-cols-3 text-xs text-slate-600">
				<div class="justify-self-start text-left">
					<div class="font-bold text-slate-700">{format ? format(min) : formatCountMaxDigits(min, maxDigits)}</div>
					{#if showLevelLabels}
						<div class="text-slate-500">Low</div>
					{/if}
				</div>
				<div class="text-center">
					<div class="font-bold text-slate-700">{format ? format(mid) : formatCountMaxDigits(mid, maxDigits)}</div>
					{#if showLevelLabels}
						<div class="text-slate-500">Medium</div>
					{/if}
				</div>
				<div class="justify-self-end text-right">
					<div class="font-bold text-slate-700">{format ? format(max) : formatCountMaxDigits(max, maxDigits)}</div>
					{#if showLevelLabels}
						<div class="text-slate-500">High</div>
					{/if}
				</div>
			</div>

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
