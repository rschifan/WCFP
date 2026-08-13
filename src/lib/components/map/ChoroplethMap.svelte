<script lang="ts">
	import type { FeatureCollection, GeoJsonProperties, Feature } from 'geojson';
	import { geoNaturalEarth1, geoPath } from 'd3-geo';
	import { zoom as d3zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
	import { select } from 'd3-selection';
	import Legend from '../Legend.svelte';
	import { APP_MAP_PALETTE, type MapPalette } from '$lib/constants/palette';

	// ---------------------------------------------------------------------------
	// Types
	// ---------------------------------------------------------------------------

	interface CountRange {
		min: number;
		max: number;
		mid: number;
	}

	interface TooltipState {
		x: number;
		y: number;
		name: string;
		count: number | null;
		hasData: boolean;
	}

	interface ProjectedFeature {
		code: string | null;
		name: string;
		count: number | null;
		hasData: boolean;
		d: string;
		centroid: [number, number];
	}

	interface MapFeatureProperties extends Record<string, unknown> {
		LEVEL3_COD?: string;
		LEVEL3_NAM?: string;
		area?: string;
		unique_count?: number | null;
		has_data?: boolean;
	}

	interface EnrichedResult {
		geoJSON: FeatureCollection;
		range: CountRange;
		missingCodes: string[];
	}

	interface Props {
		geoJSON: FeatureCollection;
		/** Replace the Map reference (don't mutate in-place) to trigger reactivity. */
		distributionData: Map<string, number>;
		selectedRegion?: string | null;
		/** External hover preview — renders a hover border without pointer interaction. */
		previewRegion?: string | null;
		onRegionClick?: (regionCode: string) => void;
		/** Choropleth gradient colors — overrides palette.low/mid/high. */
		colors?: { low: string; mid: string; high: string };
		palette?: MapPalette;
		/** Hover border color — overrides palette.hover. */
		hoverColor?: string;
		/** Selected region border color — overrides palette.selected. */
		selectedColor?: string;
		/** Selected region fill overlay color — overrides palette.selectedFill. */
		selectedFillColor?: string;
		/** Opacity of the selected region fill overlay (0–1, default 0.3). */
		selectedFillOpacity?: number;
		/** Stroke width of the selected region border in SVG user-units (default 3). */
		selectedStrokeWidth?: number;
		tooltipOffset?: number;
		showLegend?: boolean;
		legendTitle?: string;
		legendSubtitle?: string;
		legendPosition?: 'top' | 'bottom' | 'bottom-left';
		autoFitBounds?: boolean;
	}

	// ---------------------------------------------------------------------------
	// Constants
	// ---------------------------------------------------------------------------

	const PADDING = 20;
	const LABEL_ZOOM_THRESHOLD = 4;

	// ---------------------------------------------------------------------------
	// Pure utility functions
	// ---------------------------------------------------------------------------

	function toProps(raw?: GeoJsonProperties | null): MapFeatureProperties {
		return (raw && typeof raw === 'object' ? raw : {}) as MapFeatureProperties;
	}

	function getRegionName(raw?: GeoJsonProperties | null): string {
		const p = toProps(raw);
		if (typeof p.LEVEL3_NAM === 'string' && p.LEVEL3_NAM) return p.LEVEL3_NAM;
		if (typeof p.area === 'string' && p.area) return p.area;
		return 'Unknown';
	}

	function getRegionCode(raw?: GeoJsonProperties | null): string | null {
		const p = toProps(raw);
		return typeof p.LEVEL3_COD === 'string' && p.LEVEL3_COD ? p.LEVEL3_COD : null;
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	function hexToRgb(hex: string): [number, number, number] {
		const normalized = hex.replace('#', '');
		const full =
			normalized.length === 3
				? normalized
						.split('')
						.map((c) => `${c}${c}`)
						.join('')
				: normalized;
		const value = parseInt(full, 16);
		return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	}

	function interpolateColor(from: string, to: string, ratio: number): string {
		const t = clamp(ratio, 0, 1);
		const [r1, g1, b1] = hexToRgb(from);
		const [r2, g2, b2] = hexToRgb(to);
		return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
	}

	function computeFillColor(
		count: number | null,
		range: CountRange,
		cols: { low: string; mid: string; high: string },
		noDataColor: string
	): string {
		if (count === null || count <= 0 || range.max <= 0) return noDataColor;
		if (range.min === range.max) return cols.mid;
		if (count <= range.mid) {
			return interpolateColor(
				cols.low,
				cols.mid,
				(count - range.min) / Math.max(range.mid - range.min, 1)
			);
		}
		return interpolateColor(
			cols.mid,
			cols.high,
			(count - range.mid) / Math.max(range.max - range.mid, 1)
		);
	}

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		geoJSON,
		distributionData,
		selectedRegion = null,
		previewRegion = null,
		onRegionClick,
		colors,
		palette = APP_MAP_PALETTE,
		hoverColor,
		selectedColor,
		selectedFillColor,
		selectedFillOpacity = 0.3,
		selectedStrokeWidth = 3,
		tooltipOffset = 10,
		showLegend = true,
		legendTitle = 'Count',
		legendSubtitle,
		legendPosition = 'bottom',
		autoFitBounds = true
	}: Props = $props();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let containerEl = $state<HTMLDivElement | null>(null);
	let svgEl = $state<SVGSVGElement | null>(null);
	// innerG: d3 sets its `transform` attribute directly — never goes through Svelte
	// Both managed directly by d3 — never go through Svelte's reactive system
	let innerG: SVGGElement | null = null;
	let labelsG: SVGGElement | null = null;
	let width = $state(800);
	let height = $state(500);
	let hoveredCode = $state<string | null>(null);
	const effectiveHovered = $derived(previewRegion ?? hoveredCode);
	let tooltip = $state<TooltipState | null>(null);
	// Hidden until the first auto-fit completes so we never show the default 800×500 flash
	let mapReady = $state(false);

	// ---------------------------------------------------------------------------
	// Derived colours
	// ---------------------------------------------------------------------------

	const effectiveColors = $derived(
		colors ?? { low: palette.low, mid: palette.mid, high: palette.high }
	);
	const effectiveHoverColor = $derived(hoverColor ?? palette.hover);
	const effectiveSelectedColor = $derived(selectedColor ?? palette.selected);
	const effectiveSelectedFill = $derived(selectedFillColor ?? palette.selectedFill);

	// ---------------------------------------------------------------------------
	// Single-pass enrichment
	// ---------------------------------------------------------------------------

	const enriched = $derived.by((): EnrichedResult => {
		const EMPTY: EnrichedResult = {
			geoJSON: { type: 'FeatureCollection', features: [] },
			range: { min: 0, max: 0, mid: 0 },
			missingCodes: []
		};

		if (!geoJSON) return EMPTY;

		const hasDistribution = distributionData.size > 0;
		const knownCodes = new Set<string>();
		const counts: number[] = [];

		const features = geoJSON.features.map((feature) => {
			const p = toProps(feature.properties);
			const regionName = getRegionName(p);
			const regionCode = getRegionCode(p);

			if (regionCode) knownCodes.add(regionCode);

			let rawCount: number | undefined;
			if (hasDistribution) {
				rawCount = regionCode ? distributionData.get(regionCode) : undefined;
			} else {
				const preCount = p.unique_count;
				rawCount = typeof preCount === 'number' && preCount > 0 ? preCount : undefined;
			}
			const hasData = typeof rawCount === 'number' && rawCount > 0;
			if (hasData) counts.push(rawCount as number);

			return {
				...feature,
				properties: {
					...p,
					unique_count: hasData ? rawCount : null,
					has_data: hasData,
					LEVEL3_NAM: regionName
				}
			};
		});

		const missingCodes = hasDistribution
			? [...distributionData.keys()].filter((c) => !knownCodes.has(c))
			: [];

		let range: CountRange = { min: 0, max: 0, mid: 0 };
		if (counts.length > 0) {
			const min = Math.min(...counts);
			const max = Math.max(...counts);
			range = { min, max, mid: Math.round((min + max) / 2) };
		}

		return { geoJSON: { type: 'FeatureCollection', features }, range, missingCodes };
	});

	const countRange = $derived(enriched.range);

	// ---------------------------------------------------------------------------
	// Warning for unmatched distribution codes
	// ---------------------------------------------------------------------------

	let _lastMissingSignature = '';
	$effect(() => {
		const sig = enriched.missingCodes.slice().sort().join(',');
		if (sig && sig !== _lastMissingSignature) {
			console.warn(
				'[ChoroplethMap] Distribution codes missing from GeoJSON:',
				enriched.missingCodes
			);
		}
		_lastMissingSignature = sig;
	});

	// ---------------------------------------------------------------------------
	// Projection + projected features (recomputed on resize or data change)
	// ---------------------------------------------------------------------------

	const computed = $derived.by(() => {
		const fc = enriched.geoJSON;
		const w = Math.max(width, PADDING * 2 + 1);
		const h = Math.max(height, PADDING * 2 + 1);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitTarget: any = fc.features.length > 0 ? fc : { type: 'Sphere' };
		const proj = geoNaturalEarth1().fitExtent(
			[
				[PADDING, PADDING],
				[w - PADDING, h - PADDING]
			],
			fitTarget
		);
		const pg = geoPath(proj);

		const features: ProjectedFeature[] = fc.features.map((f: Feature) => {
			const props = f.properties ?? {};
			const code = getRegionCode(props);
			const name = getRegionName(props);
			const rawCount = props.unique_count;
			const count = typeof rawCount === 'number' ? rawCount : null;
			const hasData = Boolean(props.has_data);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const centroid = pg.centroid(f as any) as [number, number];
			return {
				code,
				name,
				count: hasData ? count : null,
				hasData,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				d: pg(f as any) ?? '',
				centroid
			};
		});

		return { features, pg };
	});

	const projectedFeatures = $derived(computed.features);

	// ---------------------------------------------------------------------------
	// d3-zoom setup
	// ---------------------------------------------------------------------------

	// At k=1 the Natural Earth projection already fills the viewport — never zoom below that.
	// Both DOM mutations go directly to the element — zero Svelte reactivity in the hot path.
	// translateExtent([[0,0],[w,h]]) locks the content to the viewport: at k=1 panning is
	// impossible; at k>1 the user can pan exactly as far as the map overflows the viewport.
	// No custom constrain — the standard d3 algorithm handles both constraints cleanly.
	const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
		.scaleExtent([1, 20])
		.on('zoom', (event) => {
			if (innerG) innerG.setAttribute('transform', event.transform.toString());
			if (labelsG) labelsG.style.opacity = event.transform.k >= LABEL_ZOOM_THRESHOLD ? '1' : '0';
		});

	$effect(() => {
		if (!svgEl) return;
		const svgSel = select(svgEl);
		svgSel.call(zoomBehavior);

		// d3's default wheel handler centers the zoom on the cursor, which makes the map
		// drift sideways while zooming and then snap when k hits 1. Replace it with a handler
		// that always zooms toward the viewport center — zoom-out then tracks cleanly to
		// identity with no lateral movement and no snap.
		function onWheel(event: WheelEvent) {
			event.preventDefault();
			const t = zoomTransform(svgEl!);
			// Same delta formula as d3-zoom internally (supports pixels / lines / pages mode).
			const delta =
				-event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
			const k1 = Math.max(1, Math.min(20, t.k * Math.pow(2, delta)));
			if (k1 === t.k) return; // already at a scale extent boundary
			const ratio = k1 / t.k;
			const cx = width / 2;
			const cy = height / 2;
			// Scale centered on viewport center (not cursor position)
			let x1 = cx + (t.x - cx) * ratio;
			let y1 = cy + (t.y - cy) * ratio;
			// Clamp so no blank space outside content bounds
			x1 = Math.min(0, Math.max(x1, width * (1 - k1)));
			y1 = Math.min(0, Math.max(y1, height * (1 - k1)));
			svgSel.call(zoomBehavior.transform, zoomIdentity.translate(x1, y1).scale(k1));
		}

		// Remove d3's wheel.zoom listener and use ours instead.
		// Native addEventListener is required so { passive: false } can call preventDefault.
		svgSel.on('wheel.zoom', null);
		svgEl.addEventListener('wheel', onWheel, { passive: false });

		return () => {
			svgEl?.removeEventListener('wheel', onWheel);
			svgSel.on('.zoom', null);
		};
	});

	// Keep pan bounds in sync with the viewport.
	// At k=1 (world fills viewport) translateExtent === viewport → translate is clamped to (0,0)
	// and panning is impossible. At k>1 the map overflows the viewport and panning is allowed.
	$effect(() => {
		zoomBehavior
			.extent([
				[0, 0],
				[width, height]
			])
			.translateExtent([
				[0, 0],
				[width, height]
			]);
	});

	// ---------------------------------------------------------------------------
	// Auto-fit / focus to bounds of regions
	// ---------------------------------------------------------------------------

	/** Fit the viewport to the union of the given features' bounds. */
	function fitToFeatures(features: FeatureCollection['features'], padding = 0.9): boolean {
		if (!svgEl || features.length === 0) return false;
		const { pg } = computed;
		let x0 = Infinity,
			y0 = Infinity,
			x1 = -Infinity,
			y1 = -Infinity;
		for (const f of features) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const b = pg.bounds(f as any);
			if (!isFinite(b[0][0])) continue;
			x0 = Math.min(x0, b[0][0]);
			y0 = Math.min(y0, b[0][1]);
			x1 = Math.max(x1, b[1][0]);
			y1 = Math.max(y1, b[1][1]);
		}
		if (!isFinite(x0) || x1 <= x0 || y1 <= y0 || width <= 0 || height <= 0) return false;
		const scale = Math.max(
			1,
			Math.min(20, padding * Math.min(width / (x1 - x0), height / (y1 - y0)))
		);
		const tx = (width - scale * (x0 + x1)) / 2;
		const ty = (height - scale * (y0 + y1)) / 2;
		select(svgEl).call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(scale));
		if (labelsG) labelsG.style.opacity = scale >= LABEL_ZOOM_THRESHOLD ? '1' : '0';
		return true;
	}

	$effect(() => {
		if (!svgEl || !autoFitBounds) return;
		const featuresWithData = enriched.geoJSON.features.filter((f) => f.properties?.has_data);
		if (featuresWithData.length === 0) {
			select(svgEl).call(zoomBehavior.transform, zoomIdentity);
			mapReady = true;
			return;
		}
		fitToFeatures(featuresWithData);
		mapReady = true;
	});


	// ---------------------------------------------------------------------------
	// ResizeObserver
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!containerEl) return;

		// Read initial size synchronously so first render uses correct dimensions
		const rect = containerEl.getBoundingClientRect();
		if (rect.width > 0) width = rect.width;
		if (rect.height > 0) height = rect.height;

		const ro = new ResizeObserver((entries) => {
			const r = entries[0].contentRect;
			if (r.width > 0) width = r.width;
			if (r.height > 0) height = r.height;
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	// ---------------------------------------------------------------------------
	// Tooltip
	// ---------------------------------------------------------------------------

	function showTooltip(event: MouseEvent, feature: ProjectedFeature) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltip = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
			name: feature.name,
			count: feature.count,
			hasData: feature.hasData
		};
	}

	function hideTooltip() {
		tooltip = null;
	}

	// ---------------------------------------------------------------------------
	// Click
	// ---------------------------------------------------------------------------

	function handleClick(feature: ProjectedFeature) {
		if (!feature.hasData || !onRegionClick || !feature.code) return;
		onRegionClick(feature.code);
	}
</script>

<div
	class="relative h-full w-full overflow-hidden transition-opacity duration-300 {mapReady
		? 'opacity-100'
		: 'opacity-0'}"
	bind:this={containerEl}
>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={svgEl}
		{width}
		{height}
		role="img"
		aria-label="Choropleth map of botanical regions"
		class="block"
		onmouseleave={hideTooltip}
	>
		<rect {width} {height} fill="#ffffff" />

		<!--
			transform is set directly by d3-zoom on every scroll/drag frame,
			bypassing Svelte's reactive system for maximum fluidity.
		-->
		<g bind:this={innerG}>
			<!-- 1. Base fills + thin boundary strokes -->
			{#each projectedFeatures as feature (feature.code ?? feature.name)}
				{@const isSelected = feature.code !== null && feature.code === selectedRegion}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<path
					d={feature.d}
					fill={computeFillColor(feature.count, countRange, effectiveColors, palette.noData)}
					fill-opacity={isSelected ? 0.5 : 0.7}
					stroke="#000000"
					stroke-width="0.5"
					stroke-opacity="0.3"
					stroke-linejoin="round"
					cursor={feature.hasData ? 'pointer' : 'default'}
					role={feature.hasData ? 'button' : undefined}
					aria-label={feature.hasData && feature.count !== null
						? `${feature.name}: ${feature.count.toLocaleString()} species`
						: undefined}
					onmousemove={(event) => {
						if (!feature.hasData) return;
						hoveredCode = feature.code;
						showTooltip(event, feature);
					}}
					onmouseleave={() => {
						hoveredCode = null;
					}}
					onclick={() => handleClick(feature)}
				/>
			{/each}

			<!-- 2. Selected region — fill overlay + border, both on top of all base fills -->
			{#if selectedRegion}
				{@const sf = projectedFeatures.find((f) => f.code === selectedRegion && f.hasData)}
				{#if sf}
					<path
						d={sf.d}
						fill={effectiveSelectedFill}
						fill-opacity={selectedFillOpacity}
						stroke={effectiveSelectedColor}
						stroke-width={selectedStrokeWidth}
						stroke-linejoin="round"
						pointer-events="none"
					/>
				{/if}
			{/if}

			<!-- 3. Hover border — skip when the hovered region is already selected -->
			{#if effectiveHovered && effectiveHovered !== selectedRegion}
				{@const hf = projectedFeatures.find((f) => f.code === effectiveHovered)}
				{#if hf}
					<path
						d={hf.d}
						fill="none"
						stroke={effectiveHoverColor}
						stroke-width="2"
						stroke-linejoin="round"
						pointer-events="none"
					/>
				{/if}
			{/if}

			<!-- 4. Labels — always in the DOM, d3 toggles opacity directly to avoid DOM churn -->
			<g bind:this={labelsG} opacity="0" pointer-events="none" style="transition: opacity 0.2s;">
				{#each projectedFeatures as feature (feature.code ?? feature.name)}
					{#if feature.hasData && isFinite(feature.centroid[0]) && isFinite(feature.centroid[1])}
						<text
							x={feature.centroid[0]}
							y={feature.centroid[1]}
							font-size="3"
							text-anchor="middle"
							dominant-baseline="central"
							fill="#1e293b"
							style="user-select: none;"
						>{feature.name}</text>
					{/if}
				{/each}
			</g>
		</g>
	</svg>

	{#if tooltip}
		<div
			class="pointer-events-none absolute z-20 rounded-lg bg-slate-900 px-3 py-2 text-white shadow-xl"
			style="left: {tooltip.x + tooltipOffset}px; top: {tooltip.y + tooltipOffset}px;"
		>
			<div class="text-sm font-semibold">{tooltip.name}</div>
			<div class="text-xs text-slate-300">
				{#if tooltip.hasData && tooltip.count !== null}
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
			title={legendTitle}
			subtitle={legendSubtitle}
			position={legendPosition}
			colors={effectiveColors}
		/>
	{/if}
</div>
