<script lang="ts">
	import type { FeatureCollection, GeoJsonProperties } from 'geojson';
	import { geoPath } from 'd3-geo';
	import { fitFocus } from '$lib/map/projection';
	import Legend from '../Legend.svelte';
	import { APP_MAP_PALETTE, type MapPalette } from '$lib/constants/palette';
	import {
		computeFillColor,
		occurrenceFillColor,
		OCCURRENCE_LABELS,
		OCCURRENCE_ORDER,
		type ValueRange
	} from '$lib/map/color-scale';
	import type { OccurrenceStatusFilter } from '$lib/types/taxonomy';

	interface Props {
		geoJSON: FeatureCollection;
		distributionData: Map<string, number>;
		/**
		 * Single-species maps only. Every area a species reaches counts the same — one — so the
		 * count ramp has nothing to say; what matters is whether the species is native there or
		 * was introduced. Supplying this switches the map and its legend to categories.
		 */
		occurrenceData?: Map<string, OccurrenceStatusFilter>;
		palette?: MapPalette;
		showLegend?: boolean;
	}

	interface TooltipState {
		x: number;
		y: number;
		name: string;
		count: number | null;
		status: OccurrenceStatusFilter | null;
	}

	interface ProjectedFeature {
		id: string;
		name: string;
		count: number | null;
		status: OccurrenceStatusFilter | null;
		hasData: boolean;
		path: string;
	}

	interface MapFeatureProperties extends Record<string, unknown> {
		LEVEL3_COD?: string;
		LEVEL3_NAM?: string;
		code?: string;
		area?: string;
	}

	const VIEWBOX_WIDTH = 1000;
	const VIEWBOX_HEIGHT = 620;
	const PADDING = 28;

	let {
		geoJSON,
		distributionData,
		occurrenceData,
		palette = APP_MAP_PALETTE,
		showLegend = true
	}: Props = $props();

	let tooltip = $state<TooltipState | null>(null);

	const isCategorical = $derived(occurrenceData !== undefined);

	/** Only the statuses actually present, so a legend never advertises an empty class. */
	const legendCategories = $derived.by(() => {
		if (!occurrenceData) return [];
		const present = new Set(occurrenceData.values());
		return OCCURRENCE_ORDER.filter((status) => present.has(status)).map((status) => ({
			label: OCCURRENCE_LABELS[status],
			color: palette.occurrence[status]
		}));
	});

	function toProps(raw?: GeoJsonProperties | null): MapFeatureProperties {
		return (raw && typeof raw === 'object' ? raw : {}) as MapFeatureProperties;
	}

	function getRegionCode(raw?: GeoJsonProperties | null): string | null {
		const props = toProps(raw);
		if (typeof props.LEVEL3_COD === 'string' && props.LEVEL3_COD) {
			return props.LEVEL3_COD;
		}

		if (typeof props.code === 'string' && props.code) {
			return props.code;
		}

		return null;
	}

	function getRegionName(raw?: GeoJsonProperties | null): string {
		const props = toProps(raw);
		if (typeof props.LEVEL3_NAM === 'string' && props.LEVEL3_NAM) {
			return props.LEVEL3_NAM;
		}

		if (typeof props.area === 'string' && props.area) {
			return props.area;
		}

		return 'Unknown';
	}

	function fillColor(feature: ProjectedFeature, range: ValueRange): string {
		if (isCategorical) {
			return occurrenceFillColor(feature.status, palette.occurrence, palette.noData);
		}
		return computeFillColor(feature.count, range, palette, palette.noData);
	}

	const prepared = $derived.by(() => {
		const counts: number[] = [];
		const highlighted: FeatureCollection['features'] = [];

		const baseFeatures = geoJSON.features.map((feature, index) => {
			const props = toProps(feature.properties);
			const code = getRegionCode(props);
			const count = code ? (distributionData.get(code) ?? null) : null;
			const status = code ? (occurrenceData?.get(code) ?? null) : null;
			// Whichever map is being drawn decides what "has data" means. In categorical mode the
			// status is the record; keying off the count would give a status-only area a
			// categorical fill while excluding it from the fit and stroking it as no-data.
			const hasData = isCategorical ? status !== null : count !== null && count > 0;

			if (hasData) {
				// Counts only mean something on the graduated map; a species' values are all 1.
				if (!isCategorical && count !== null) counts.push(count);
				if (feature.geometry) highlighted.push(feature);
			}

			return {
				id: code ?? `feature-${index}`,
				name: getRegionName(props),
				count,
				status,
				hasData,
				geometry: feature.geometry
			};
		});

		// Fit to the highlighted areas, but never closer than the zoom cap — a taxon recorded in
		// one region should still be shown against its continent, not filling the frame alone.
		const focus: FeatureCollection | null =
			highlighted.length > 0 ? { type: 'FeatureCollection', features: highlighted } : null;
		const projection = fitFocus(
			{ width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT, padding: PADDING },
			focus
		);
		const toPath = geoPath(projection);

		const features: ProjectedFeature[] = baseFeatures.map((feature) => ({
			id: feature.id,
			name: feature.name,
			count: feature.count,
			status: feature.status,
			hasData: feature.hasData,
			path: feature.geometry ? (toPath(feature.geometry) ?? '') : ''
		}));

		const range =
			counts.length === 0
				? { min: 0, max: 0, mid: 0 }
				: {
						min: Math.min(...counts),
						max: Math.max(...counts),
						mid: Math.round((Math.min(...counts) + Math.max(...counts)) / 2)
					};

		return { features, range, outline: toPath({ type: 'Sphere' }) ?? '' };
	});

	const projectedFeatures = $derived(prepared.features);
	const countRange = $derived(prepared.range);
	const sphereOutline = $derived(prepared.outline);

	function showTooltip(event: MouseEvent, feature: ProjectedFeature) {
		const svg = (event.currentTarget as SVGElement).ownerSVGElement;
		const rect = svg?.getBoundingClientRect();
		tooltip = {
			x: event.clientX - (rect?.left ?? 0),
			y: event.clientY - (rect?.top ?? 0),
			name: feature.name,
			count: feature.count,
			status: feature.status
		};
	}

	function hideTooltip() {
		tooltip = null;
	}
</script>

<div class="relative h-full w-full overflow-hidden bg-white">
	<svg
		viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
		class="h-full w-full"
		role="img"
		aria-label="Taxonomy distribution map"
	>
		<path d={sphereOutline} fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"></path>

		{#each projectedFeatures as feature (feature.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<path
				d={feature.path}
				fill={fillColor(feature, countRange)}
				stroke={feature.hasData ? (isCategorical ? '#57534e' : '#b45353') : '#9ca3af'}
				stroke-width={feature.hasData ? 0.9 : 0.7}
				stroke-linejoin="round"
				stroke-linecap="round"
				onmousemove={(event) => showTooltip(event, feature)}
				onmouseleave={hideTooltip}
			></path>
		{/each}
	</svg>

	{#if tooltip}
		<div
			class="pointer-events-none absolute z-10 rounded-lg bg-slate-900 px-3 py-2 text-white shadow-xl"
			style={`left:${tooltip.x + 12}px; top:${tooltip.y + 12}px;`}
		>
			<div class="text-sm font-semibold">{tooltip.name}</div>
			<div class="text-xs text-slate-300">
				{#if isCategorical}
					{#if tooltip.status}
						<span class="font-medium text-white">{OCCURRENCE_LABELS[tooltip.status]}</span>
					{:else}
						<span class="font-medium text-white">Not recorded</span>
					{/if}
				{:else if tooltip.count !== null}
					Count: <span class="font-medium text-white">{tooltip.count.toLocaleString()}</span>
				{:else}
					<span class="font-medium text-white">No data</span>
				{/if}
			</div>
		</div>
	{/if}

	{#if showLegend && isCategorical && legendCategories.length > 0}
		<Legend
			min={0}
			mid={0}
			max={0}
			title="Occurrence"
			showTitle={false}
			position="bottom"
			categories={legendCategories}
		/>
	{:else if showLegend && !isCategorical && countRange.max > 0}
		<Legend
			min={countRange.min}
			mid={countRange.mid}
			max={countRange.max}
			title="Count"
			position="bottom"
			colors={{ low: palette.low, mid: palette.mid, high: palette.high }}
			noDataColor={palette.noData}
		/>
	{/if}
</div>
