<script lang="ts">
	import type { FeatureCollection, GeoJsonProperties } from 'geojson';
	import Legend from '../Legend.svelte';
	import { APP_MAP_PALETTE, type MapPalette } from '$lib/constants/palette';
	import { computeFillColor, type ValueRange } from '$lib/map/color-scale';

	interface Props {
		geoJSON: FeatureCollection;
		distributionData: Map<string, number>;
		palette?: MapPalette;
		showLegend?: boolean;
	}

	interface TooltipState {
		x: number;
		y: number;
		name: string;
		count: number | null;
	}

	interface ProjectedFeature {
		id: string;
		name: string;
		count: number | null;
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

	let { geoJSON, distributionData, palette = APP_MAP_PALETTE, showLegend = true }: Props = $props();

	let tooltip = $state<TooltipState | null>(null);

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

	function fillColor(count: number | null, range: ValueRange): string {
		return computeFillColor(count, range, palette, palette.noData);
	}

	function expandBounds(
		coords: unknown,
		bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }
	) {
		if (
			Array.isArray(coords) &&
			coords.length >= 2 &&
			typeof coords[0] === 'number' &&
			typeof coords[1] === 'number'
		) {
			const [lng, lat] = coords as [number, number];
			bounds.minLng = Math.min(bounds.minLng, lng);
			bounds.minLat = Math.min(bounds.minLat, lat);
			bounds.maxLng = Math.max(bounds.maxLng, lng);
			bounds.maxLat = Math.max(bounds.maxLat, lat);
			return;
		}

		if (Array.isArray(coords)) {
			for (const child of coords) {
				expandBounds(child, bounds);
			}
		}
	}

	function buildProjector(bounds: {
		minLng: number;
		minLat: number;
		maxLng: number;
		maxLat: number;
	}) {
		const width = Math.max(bounds.maxLng - bounds.minLng, 1);
		const height = Math.max(bounds.maxLat - bounds.minLat, 1);
		const scale = Math.min(
			(VIEWBOX_WIDTH - PADDING * 2) / width,
			(VIEWBOX_HEIGHT - PADDING * 2) / height
		);
		const contentWidth = width * scale;
		const contentHeight = height * scale;
		const offsetX = (VIEWBOX_WIDTH - contentWidth) / 2;
		const offsetY = (VIEWBOX_HEIGHT - contentHeight) / 2;

		return ([lng, lat]: [number, number]) => ({
			x: offsetX + (lng - bounds.minLng) * scale,
			y: offsetY + (bounds.maxLat - lat) * scale
		});
	}

	function ringToPath(
		ring: unknown[],
		project: (coord: [number, number]) => { x: number; y: number }
	): string {
		let path = '';

		for (const [index, point] of ring.entries()) {
			if (!Array.isArray(point) || point.length < 2) {
				continue;
			}

			const { x, y } = project([Number(point[0]), Number(point[1])]);
			path += `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
		}

		return `${path}Z`;
	}

	function geometryToPath(
		geometry: FeatureCollection['features'][number]['geometry'],
		project: (coord: [number, number]) => { x: number; y: number }
	): string {
		if (!geometry) {
			return '';
		}

		if (geometry.type === 'Polygon') {
			const polygonCoordinates = geometry.coordinates as unknown[][];
			return polygonCoordinates.map((ring) => ringToPath(ring, project)).join(' ');
		}

		if (geometry.type === 'MultiPolygon') {
			const multiPolygonCoordinates = geometry.coordinates as unknown[][][];
			return multiPolygonCoordinates
				.map((polygon) => polygon.map((ring) => ringToPath(ring, project)).join(' '))
				.join(' ');
		}

		return '';
	}

	const prepared = $derived.by(() => {
		const counts: number[] = [];
		const allBounds = {
			minLng: Infinity,
			minLat: Infinity,
			maxLng: -Infinity,
			maxLat: -Infinity
		};
		const activeBounds = {
			minLng: Infinity,
			minLat: Infinity,
			maxLng: -Infinity,
			maxLat: -Infinity
		};

		const baseFeatures = geoJSON.features.map((feature, index) => {
			const props = toProps(feature.properties);
			const code = getRegionCode(props);
			const count = code ? (distributionData.get(code) ?? null) : null;
			const hasData = count !== null && count > 0;

			if (hasData) {
				counts.push(count);
				expandBounds(feature.geometry?.coordinates, activeBounds);
			}

			expandBounds(feature.geometry?.coordinates, allBounds);

			return {
				id: code ?? `feature-${index}`,
				name: getRegionName(props),
				count,
				hasData,
				geometry: feature.geometry
			};
		});

		const hasActiveBounds = isFinite(activeBounds.minLng);
		const hasAllBounds = isFinite(allBounds.minLng);
		const bounds = hasActiveBounds
			? activeBounds
			: hasAllBounds
				? allBounds
				: { minLng: -180, minLat: -60, maxLng: 180, maxLat: 85 };
		const project = buildProjector(bounds);

		const features: ProjectedFeature[] = baseFeatures.map((feature) => ({
			id: feature.id,
			name: feature.name,
			count: feature.count,
			hasData: feature.hasData,
			path: geometryToPath(feature.geometry, project)
		}));

		const range =
			counts.length === 0
				? { min: 0, max: 0, mid: 0 }
				: {
						min: Math.min(...counts),
						max: Math.max(...counts),
						mid: Math.round((Math.min(...counts) + Math.max(...counts)) / 2)
					};

		return { features, range };
	});

	const projectedFeatures = $derived(prepared.features);
	const countRange = $derived(prepared.range);

	function showTooltip(event: MouseEvent, feature: ProjectedFeature) {
		const svg = (event.currentTarget as SVGElement).ownerSVGElement;
		const rect = svg?.getBoundingClientRect();
		tooltip = {
			x: event.clientX - (rect?.left ?? 0),
			y: event.clientY - (rect?.top ?? 0),
			name: feature.name,
			count: feature.count
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
		<rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#ffffff"></rect>

		{#each projectedFeatures as feature (feature.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<path
				d={feature.path}
				fill={fillColor(feature.count, countRange)}
				stroke={feature.hasData ? '#b45353' : '#9ca3af'}
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
				{#if tooltip.count !== null}
					Count: <span class="font-medium text-white">{tooltip.count.toLocaleString()}</span>
				{:else}
					<span class="font-medium text-white">No data</span>
				{/if}
			</div>
		</div>
	{/if}

	{#if showLegend && countRange.max > 0}
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
