<script lang="ts">
	/**
	 * ChoroplethMap - Presentational component for displaying spatial distribution
	 *
	 * This component displays a choropleth map with distribution data.
	 * It enriches GeoJSON features with count data and handles map visualization.
	 *
	 * Features:
	 * - SSR-safe initialization
	 * - Reactive updates when distribution data changes
	 * - Hover tooltips
	 * - Click handling for region selection
	 * - Color scale based on data range
	 */

	import type { Map as MapLibreMapType, GeoJSONSource } from 'maplibre-gl';
	import type { FeatureCollection } from 'geojson';
	import MapComponent from '../Map.svelte';
	import Legend from '../Legend.svelte';
	import { NO_DATA_COLOR } from '$lib/constants/map';

	interface Props {
		/** GeoJSON feature collection with region data */
		geoJSON: FeatureCollection;
		/** Distribution data: Map of region names to species counts */
		distributionData: Map<string, number>;
		/** Optional callback when map is loaded */
		onMapLoad?: (map: MapLibreMapType) => void;
		/** Optional callback when a region is clicked */
		onRegionClick?: (regionName: string) => void;
		/** Color scale configuration */
		colors?: {
			low: string;
			mid: string;
			high: string;
		};
		/** Hover color for highlighted regions */
		hoverColor?: string;
		/** Tooltip offset in pixels */
		tooltipOffset?: number;
		/** Show legend (default: true) */
		showLegend?: boolean;
		/** Legend title (default: 'Count') */
		legendTitle?: string;
		/** Legend subtitle */
		legendSubtitle?: string;
		/** Auto-fit bounds to show all geographies (default: true) */
		autoFitBounds?: boolean;
	}

	let {
		geoJSON,
		distributionData,
		onMapLoad,
		onRegionClick,
		colors = { low: '#e0f2f1', mid: '#80cbc4', high: '#00897b' },
		hoverColor = '#14532d',
		tooltipOffset = 10,
		showLegend = true,
		legendTitle = 'Count',
		legendSubtitle,
		autoFitBounds = true
	}: Props = $props();

	// State
	let mapInstance = $state<MapLibreMapType | null>(null);
	let tooltip = $state<{ x: number; y: number; name: string; count: number } | null>(null);
	let hoveredFeatureId = $state<string | number | null>(null);
	let boundsFitted = $state(false);

	// Derived: Enriched GeoJSON with count data
	const enrichedGeoJSON = $derived.by(() => {
		if (!geoJSON) {
			return null;
		}

		// Force reactivity by reading distributionData.size and iterating
		const dataSize = distributionData.size;
		const hasDistributionData = dataSize > 0;

		// If distributionData is provided and not empty, use it to enrich
		// Otherwise, use the original GeoJSON (which may already have unique_count)
		if (hasDistributionData) {
			// Force reactivity by reading from the Map
			const distributionEntries = Array.from(distributionData.entries());

			// Create a copy of the GeoJSON and enrich features with count data
			const enriched: FeatureCollection = {
				type: 'FeatureCollection',
				features: geoJSON.features.map((feature) => {
					const regionName =
						feature.properties?.LEVEL3_NAM || feature.properties?.area || 'Unknown';
					const count = distributionData.get(regionName) || 0;

					return {
						...feature,
						properties: {
							...feature.properties,
							unique_count: count,
							LEVEL3_NAM: regionName
						}
					};
				})
			};

			return enriched;
		}

		// Use original GeoJSON (it already has unique_count from the data file)
		return geoJSON;
	});

	// Derived: Calculate min/max counts for color scale
	const countRange = $derived.by(() => {
		if (!enrichedGeoJSON) {
			return { min: 0, max: 0, mid: 0 };
		}

		// Extract counts from GeoJSON features (works for both original and enriched)
		const counts: number[] = [];
		for (const feature of enrichedGeoJSON.features) {
			const count = feature.properties?.unique_count;
			if (typeof count === 'number') {
				counts.push(count);
			}
		}

		if (counts.length === 0) {
			return { min: 0, max: 0, mid: 0 };
		}

		const min = Math.min(...counts);
		const max = Math.max(...counts);
		const mid = Math.round((min + max) / 2);

		return { min, max, mid };
	});

	// Track if layers are set up
	let layersSetup = $state(false);

	// Handle map load - store reference
	function handleMapLoad(map: MapLibreMapType) {
		mapInstance = map;

		if (onMapLoad) {
			onMapLoad(map);
		}

		// Try to set up layers if data is ready
		setupMapLayers();
	}

	/**
	 * Calculate bounding box from GeoJSON features and fit map to show all geographies.
	 */
	function fitMapToBounds() {
		if (!mapInstance || !enrichedGeoJSON) return;

		try {
			// Calculate bounding box from all features
			let minLng = Infinity;
			let minLat = Infinity;
			let maxLng = -Infinity;
			let maxLat = -Infinity;

			// Helper to process coordinates recursively
			function processCoordinates(coords: any[]): void {
				for (const coord of coords) {
					if (Array.isArray(coord)) {
						if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
							// This is a coordinate [lng, lat]
							const [lng, lat] = coord;
							minLng = Math.min(minLng, lng);
							minLat = Math.min(minLat, lat);
							maxLng = Math.max(maxLng, lng);
							maxLat = Math.max(maxLat, lat);
						} else {
							// Nested array, recurse
							processCoordinates(coord);
						}
					}
				}
			}

			for (const feature of enrichedGeoJSON.features) {
				if (feature.geometry && feature.geometry.coordinates) {
					processCoordinates(feature.geometry.coordinates);
				}
			}

			// Only fit bounds if we have valid coordinates
			if (
				isFinite(minLng) &&
				isFinite(minLat) &&
				isFinite(maxLng) &&
				isFinite(maxLat) &&
				minLng !== maxLng &&
				minLat !== maxLat
			) {
				// Reset bounds fitted state before fitting
				boundsFitted = false;

				mapInstance.fitBounds(
					[
						[minLng, minLat],
						[maxLng, maxLat]
					],
					{
						padding: 50, // Add padding around the bounds
						duration: 0, // Immediate - no animation
						maxZoom: 10 // Don't zoom in too much
					}
				);

				// Mark bounds as fitted after operation completes
				// Use requestAnimationFrame to ensure it happens after the fitBounds operation
				requestAnimationFrame(() => {
					boundsFitted = true;
				});
			} else {
				// If no valid bounds, show map immediately
				boundsFitted = true;
			}
		} catch (err) {
			console.warn('[ChoroplethMap] Error fitting bounds:', err);
			// Ensure map is visible even if bounds fitting fails
			boundsFitted = true;
		}
	}

	// Set up map layers (called when map is ready AND data is available)
	function setupMapLayers() {
		if (!mapInstance || !enrichedGeoJSON || layersSetup) return;

		// Ensure map style is loaded before adding layers
		if (!mapInstance.isStyleLoaded()) {
			mapInstance.once('styledata', () => {
				setupMapLayers();
			});
			return;
		}

		const { min, max, mid } = countRange;

		// Remove existing source and layers if they exist
		if (mapInstance.getSource('level3')) {
			if (mapInstance.getLayer('level3-fill')) {
				mapInstance.removeLayer('level3-fill');
			}
			if (mapInstance.getLayer('level3-stroke')) {
				mapInstance.removeLayer('level3-stroke');
			}
			if (mapInstance.getLayer('level3-hover')) {
				mapInstance.removeLayer('level3-hover');
			}
			mapInstance.removeSource('level3');
		}

		// Add source with generateId for feature state support
		mapInstance.addSource('level3', {
			type: 'geojson',
			data: enrichedGeoJSON,
			generateId: true
		});

		// Build fill-color expression
		// MapLibre requires strictly increasing stop values, so we handle edge cases:
		// 1. min === max: use a single color
		// 2. max - min < 2: use two-stop interpolation (min and max only)
		// 3. Otherwise: use three-stop interpolation (min, mid, max)
		// Regions with no data (unique_count = 0) are colored gray
		const dataColorExpression: any =
			min === max
				? colors.mid // All regions have the same count
				: max - min < 2 || mid === min || mid === max
					? // Range is too small for three stops, use two-stop interpolation
						[
							'interpolate',
							['linear'],
							['coalesce', ['get', 'unique_count'], 0],
							min,
							colors.low,
							max,
							colors.high
						]
					: // Normal case: three-stop interpolation
						[
							'interpolate',
							['linear'],
							['coalesce', ['get', 'unique_count'], 0],
							min,
							colors.low,
							mid,
							colors.mid,
							max,
							colors.high
						];

		// Wrap in case expression: gray for no data, color scale for data
		const fillColorExpression: any = [
			'case',
			['>', ['coalesce', ['get', 'unique_count'], 0], 0],
			dataColorExpression,
			NO_DATA_COLOR
		];

		// Add fill layer with color scale
		mapInstance.addLayer({
			id: 'level3-fill',
			type: 'fill',
			source: 'level3',
			paint: {
				'fill-color': fillColorExpression,
				'fill-opacity': 0.7
			}
		});

		// Add stroke layer
		mapInstance.addLayer({
			id: 'level3-stroke',
			type: 'line',
			source: 'level3',
			paint: {
				'line-color': '#000000',
				'line-width': 0.5,
				'line-opacity': 0.3
			}
		});

		// Add hover highlight layer (only for regions with data)
		mapInstance.addLayer({
			id: 'level3-hover',
			type: 'line',
			source: 'level3',
			paint: {
				'line-color': hoverColor,
				'line-width': 3,
				'line-opacity': [
					'case',
					[
						'all',
						['boolean', ['feature-state', 'hover'], false],
						['>', ['coalesce', ['get', 'unique_count'], 0], 0]
					],
					1,
					0
				]
			}
		});

		// Set up event handlers (only once)
		setupEventHandlers();
		layersSetup = true;

		// Reset bounds fitted state before fitting
		boundsFitted = false;

		// Fit map to show all geographies immediately after layers are set up (if enabled)
		if (autoFitBounds) {
			fitMapToBounds();
		} else {
			// Show map immediately if auto-fit is disabled
			boundsFitted = true;
		}
	}

	// Update map data when enriched GeoJSON changes (after initial setup)
	function updateMapData() {
		if (!mapInstance || !enrichedGeoJSON || !layersSetup) return;

		const source = mapInstance.getSource('level3');
		if (source && source.type === 'geojson') {
			// Reset bounds fitted state before updating
			boundsFitted = false;

			// Update the source data
			(source as GeoJSONSource).setData(enrichedGeoJSON);

			// Fit map to show all geographies immediately when data updates (if enabled)
			if (autoFitBounds) {
				fitMapToBounds();
			} else {
				boundsFitted = true;
			}
		}
	}

	// Set up map event handlers
	function setupEventHandlers() {
		if (!mapInstance) return;

		// Remove existing handlers to avoid duplicates
		// @ts-expect-error - MapLibre types don't fully support layer-filtered events in TypeScript
		mapInstance.off('mousemove', 'level3-fill');
		// @ts-expect-error - MapLibre types don't fully support layer-filtered events in TypeScript
		mapInstance.off('mouseleave', 'level3-fill');
		// @ts-expect-error - MapLibre types don't fully support layer-filtered events in TypeScript
		mapInstance.off('click', 'level3-fill');

		// Add hover effects
		mapInstance.on('mousemove', 'level3-fill', (e: any) => {
			if (!mapInstance) return;

			if (e.features?.[0]) {
				const feature = e.features[0];
				const count = feature.properties?.unique_count || 0;

				// Skip hover effects for regions with no data
				if (count === 0) {
					mapInstance.getCanvas().style.cursor = '';
					tooltip = null;
					// Clear any existing hover state
					if (hoveredFeatureId !== null) {
						mapInstance.setFeatureState(
							{ source: 'level3', id: hoveredFeatureId },
							{ hover: false }
						);
						hoveredFeatureId = null;
					}
					return;
				}

				mapInstance.getCanvas().style.cursor = 'pointer';
				const newFeatureId = feature.id;

				// Update hover state if feature changed
				if (hoveredFeatureId !== newFeatureId) {
					if (hoveredFeatureId !== null) {
						mapInstance.setFeatureState(
							{ source: 'level3', id: hoveredFeatureId },
							{ hover: false }
						);
					}
					if (newFeatureId !== undefined) {
						mapInstance.setFeatureState({ source: 'level3', id: newFeatureId }, { hover: true });
						hoveredFeatureId = newFeatureId;
					}
				}

				// Update tooltip
				const regionName = feature.properties?.LEVEL3_NAM || 'Unknown';
				tooltip = {
					x: e.point.x,
					y: e.point.y,
					name: regionName,
					count
				};
			}
		});

		// Reset cursor when leaving polygons
		mapInstance.on('mouseleave', 'level3-fill', () => {
			if (!mapInstance) return;
			mapInstance.getCanvas().style.cursor = '';
			tooltip = null;

			if (hoveredFeatureId !== null) {
				mapInstance.setFeatureState({ source: 'level3', id: hoveredFeatureId }, { hover: false });
				hoveredFeatureId = null;
			}
		});

		// Handle click to trigger region selection (only for regions with data)
		mapInstance.on('click', 'level3-fill', (e: any) => {
			if (e.features?.[0] && onRegionClick) {
				const count = e.features[0].properties?.unique_count || 0;
				if (count === 0) return; // Ignore clicks on no-data regions
				// Use 'area' for data loading (matches JSON file names), fall back to LEVEL3_NAM
				const regionName =
					e.features[0].properties?.area || e.features[0].properties?.LEVEL3_NAM;
				if (regionName) {
					onRegionClick(regionName);
				}
			}
		});
	}

	// Set up layers when map is ready and enriched GeoJSON is available
	$effect(() => {
		if (mapInstance && enrichedGeoJSON && !layersSetup) {
			setupMapLayers();
		} else if (layersSetup && enrichedGeoJSON) {
			// Update data if layers are already set up
			updateMapData();
		}
	});
</script>

<div class="relative h-full w-full">
	<div
		class="h-full w-full transition-opacity duration-500 {boundsFitted
			? 'opacity-100'
			: 'opacity-0'}"
	>
		<MapComponent
			initialViewState={{ longitude: 0, latitude: 20, zoom: 2 }}
			onMapLoad={handleMapLoad}
		/>
	</div>

	<!-- Hover Tooltip -->
	{#if tooltip}
		<div
			class="pointer-events-none absolute z-20 rounded-lg bg-slate-900 px-3 py-2 text-white shadow-xl"
			style="left: {tooltip.x + tooltipOffset}px; top: {tooltip.y + tooltipOffset}px;"
		>
			<div class="text-sm font-semibold">{tooltip.name}</div>
			<div class="text-xs text-slate-300">
				Count: <span class="font-medium text-white">{tooltip.count.toLocaleString()}</span>
			</div>
		</div>
	{/if}

	<!-- Legend - Automatically shown when there's data (industry standard for choropleth maps) -->
	{#if showLegend && countRange.max > 0}
		<Legend
			min={countRange.min}
			mid={countRange.mid}
			max={countRange.max}
			title={legendTitle}
			subtitle={legendSubtitle}
			position="bottom"
			{colors}
		/>
	{/if}
</div>

<style>
	/* Force cursor to work on MapLibre canvas */
	:global(.maplibregl-canvas-container.maplibregl-interactive),
	:global(.maplibregl-canvas-container.maplibregl-interactive:hover) {
		cursor: inherit !important;
	}
</style>
