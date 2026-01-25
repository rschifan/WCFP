<script lang="ts">
	/**
	 * MapLibre GL JS + deck.gl integration component for Svelte 5.
	 *
	 * This component provides a production-ready map visualization with:
	 * - SSR-safe initialization with dynamic imports
	 * - Robust error handling and recovery mechanisms
	 * - Automatic resize handling (MapLibre's built-in ResizeObserver)
	 * - deck.gl layer support for advanced visualizations
	 * - Reactive viewport updates
	 * - Accessibility features with ARIA attributes
	 * - Memory leak prevention with proper cleanup
	 *
	 * @example
	 * ```svelte
	 * <Map
	 *   layers={[new ScatterplotLayer({...})]}
	 *   initialViewState={{ longitude: 0, latitude: 0, zoom: 2 }}
	 *   onMapLoad={(map) => handleMapReady(map)}
	 *   onViewStateChange={(viewState) => handleViewportChange(viewState)}
	 * />
	 * ```
	 */
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	import { Globe, Map as MapIcon } from 'lucide-svelte';

	// CSS is safe to import at module scope; the MapLibre runtime is imported dynamically (SSR-safe).
	import 'maplibre-gl/dist/maplibre-gl.css';

	// Type-only imports are safe in SSR.
	import type { Map as MapLibreMapType, MapOptions as MapLibreMapOptions } from 'maplibre-gl';
	import type { MapboxOverlay } from '@deck.gl/mapbox';
	import type { MapProps, ViewState } from '../types/map';
	import { DEFAULT_MAP_STYLE as DEFAULT_STYLE, DEFAULT_VIEW_STATE as DEFAULT_VIEW } from '../types/map';

	// Props (reactive by default in Svelte 5)
	let {
		layers = [],
		initialViewState,
		mapStyle,
		width,
		height,
		onViewStateChange,
		onMapLoad,
		showGlobeToggle = true,
		globeTogglePosition = 'top-left'
	}: MapProps = $props();

	// State
	let mapContainer = $state<HTMLDivElement | null>(null);
	let map = $state<MapLibreMapType | null>(null);
	let deckOverlay = $state<MapboxOverlay | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let loadTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let initAttempt = 0;
	let isGlobeView = $state(false);

	/**
	 * Returns a finite number or a fallback value.
	 * @param value - Value to check
	 * @param fallback - Fallback value if not finite
	 * @returns Finite number or fallback
	 */
	function finiteOr(value: unknown, fallback: number): number {
		return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
	}

	/**
	 * Waits for container to have non-zero dimensions.
	 * Prevents MapLibre "failed to invert matrix" errors.
	 * @param container - Element to observe
	 * @param timeoutMs - Maximum wait time in milliseconds
	 * @returns Promise resolving to true if container has size, false on timeout
	 */
	async function waitForNonZeroSize(container: Element, timeoutMs = 2000): Promise<boolean> {
		const rect = container.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) return true;

		return await new Promise<boolean>((resolve) => {
			let settled = false;
			const timeout = setTimeout(() => {
				if (settled) return;
				settled = true;
				resolve(false);
			}, timeoutMs);

			const ro = new ResizeObserver(() => {
				const r = container.getBoundingClientRect();
				if (r.width > 0 && r.height > 0) {
					if (settled) return;
					settled = true;
					clearTimeout(timeout);
					ro.disconnect();
					resolve(true);
				}
			});
			ro.observe(container);
		});
	}

	/**
	 * Clears the map loading timeout if it exists.
	 */
	function clearLoadTimeout() {
		if (loadTimeoutId) {
			clearTimeout(loadTimeoutId);
			loadTimeoutId = null;
		}
	}

	/**
	 * Toggle between 2D and 3D globe view
	 * Reused from routes/+page.svelte
	 */
	function toggleProjection() {
		if (!map || !mapContainer) return;
		isGlobeView = !isGlobeView;
		const mapInstance = map;
		mapInstance.setProjection({ type: isGlobeView ? 'globe' : 'mercator' });

		// Set consistent background color for globe view using CSS
		// This ensures the background is consistent across all maps
		// Dark background (#1a1a1a) matches the Cerberus theme
		if (isGlobeView) {
			mapContainer.style.backgroundColor = '#1a1a1a';
		} else {
			// Reset to transparent/white for 2D view
			mapContainer.style.backgroundColor = '';
		}

		// Hide/show text and symbol layers to prevent labels from appearing flat in globe view
		const style = mapInstance.getStyle();
		if (style?.layers) {
			style.layers.forEach((layer) => {
				if (layer.type === 'symbol') {
					mapInstance.setLayoutProperty(layer.id, 'visibility', isGlobeView ? 'none' : 'visible');
				}
			});
		}
	}

	const positionClasses = {
		'top-left': 'left-6 top-6',
		'top-right': 'right-6 top-6',
		'bottom-left': 'left-6 bottom-6',
		'bottom-right': 'right-6 bottom-6'
	} as const;

	/**
	 * Destroys the map instance and cleans up all resources.
	 * MapLibre's map.remove() automatically cleans up event listeners and resources.
	 */
	function destroyMap() {
		clearLoadTimeout();

		if (deckOverlay) {
			deckOverlay.finalize();
			deckOverlay = null;
		}

		if (map) {
			map.remove(); // Automatically cleans up all event listeners and WebGL context
			map = null;
		}
	}

	/**
	 * Initializes the MapLibre map instance and deck.gl overlay.
	 * Handles SSR-safe dynamic imports, container size validation,
	 * error handling, and event listener setup.
	 */
	async function initializeMap() {
		const attempt = ++initAttempt;

		// Reset state for retries / re-init
		error = null;
		loading = true;
		destroyMap();

		if (!mapContainer) {
			error = 'Map container not found';
			loading = false;
			return;
		}

		const container = mapContainer;

		// Svelte docs: `tick()` waits for pending DOM updates to be flushed.
		// We use it so MapLibre sees the final container size (avoids "failed to invert matrix").
		await tick();

		// MapLibre can throw `failed to invert matrix` if initialized while the container has
		// a zero/invalid size (e.g. hidden route/tab, flex layout still settling, display:none).
		const hasSize = await waitForNonZeroSize(container, 2000);
		if (attempt !== initAttempt) return;
		if (!hasSize) {
			error =
				'Map container has zero size. Ensure the map parent has an explicit height (e.g. h-screen + flex-1 + min-h-0) and is not display:none, then retry.';
			loading = false;
			return;
		}

		try {
			// Set timeout for map loading (30 seconds)
			clearLoadTimeout();
			loadTimeoutId = setTimeout(() => {
				if (loading) {
					error = 'Map loading timeout. Please check your internet connection and try again.';
					loading = false;
					console.error('Map loading timeout');
				}
			}, 30000);

			// Runtime imports must be done on the client to avoid SSR/CJS interop issues.
			const [{ default: maplibregl }, { MapboxOverlay }] = await Promise.all([
				import('maplibre-gl'),
				import('@deck.gl/mapbox')
			]);

			const view = initialViewState ?? DEFAULT_VIEW;

			// Sanitize view state. Passing `undefined` (or NaN) for bearing/pitch can lead to
			// MapLibre throwing "failed to invert matrix" even when the container has a valid size.
			const longitude = finiteOr(view.longitude, DEFAULT_VIEW.longitude);
			const latitude = finiteOr(view.latitude, DEFAULT_VIEW.latitude);
			const zoom = finiteOr(view.zoom, DEFAULT_VIEW.zoom);
			const bearing =
				typeof view.bearing === 'number' && Number.isFinite(view.bearing) ? view.bearing
					: undefined;
			const pitch =
				typeof view.pitch === 'number' && Number.isFinite(view.pitch) ? view.pitch
					: undefined;

			const options: MapLibreMapOptions = {
				container,
				style: mapStyle ?? DEFAULT_STYLE,
				center: [longitude, latitude],
				zoom
			};
			if (bearing !== undefined) options.bearing = bearing;
			if (pitch !== undefined) options.pitch = pitch;

			// Initialize MapLibre map (uses built-in ResizeObserver)
			map = new maplibregl.Map(options);

			// Wait for map 'load' event before creating MapboxOverlay
			map.once('load', () => {
				clearLoadTimeout();
				try {
					deckOverlay = new MapboxOverlay({
						interleaved: true,
						layers: layers ?? []
					});

					// Add overlay as MapLibre control
					map?.addControl(deckOverlay);

					loading = false;

					// Notify parent component that map is ready
					if (onMapLoad && map) {
						onMapLoad(map);
					}
				} catch (e) {
					error = e instanceof Error ? e.message : 'Failed to initialize deck.gl overlay';
					loading = false;
					console.error('Failed to initialize deck.gl overlay:', e);
				}
			});

			// Handle map errors
			map.on('error', (e: { error?: { message?: string } }) => {
				clearLoadTimeout();
				const errorMessage = e.error?.message || 'Map initialization error';
				error = `Map error: ${errorMessage}. Please check your internet connection and map style URL.`;
				loading = false;
				console.error('Map error:', e);
			});

			// Optional: Handle viewport changes
			if (onViewStateChange) {
				map.on('moveend', () => {
					if (map) {
						const center = map.getCenter();
						const viewState: ViewState = {
							longitude: center.lng,
							latitude: center.lat,
							zoom: map.getZoom(),
							bearing: map.getBearing(),
							pitch: map.getPitch()
						};
						onViewStateChange(viewState);
					}
				});
			}
		} catch (e) {
			clearLoadTimeout();
			const errorMessage = e instanceof Error ? e.message : 'Unknown error';
			const normalized = typeof errorMessage === 'string' ? errorMessage.toLowerCase() : '';

			// Provide a more actionable hint for a common MapLibre init failure.
			if (normalized.includes('failed to invert matrix')) {
				error =
					'Failed to initialize map: failed to invert matrix. This usually means the map container had zero/invalid size at initialization. Ensure the map parent has a real height/width (not display:none), then retry.';
			} else {
				error = `Failed to initialize map: ${errorMessage}.`;
			}
			loading = false;
			console.error('Failed to initialize map:', e);
		}
	}

	// Initialize on mount
	onMount(() => {
		void initializeMap();
	});

	// Update layers reactively when props change
	$effect(() => {
		if (deckOverlay) {
			// Update layers whenever the layers prop changes
			deckOverlay.setProps({ layers: layers ?? [] });
		}
	});

	// Update viewport when initialViewState prop changes (only if map is already loaded)
	$effect(() => {
		// Track these reactive dependencies
		const currentMap = map;
		const currentLoading = loading;
		const currentViewState = initialViewState;

		// Only update if map is initialized and not currently loading
		if (currentMap && !currentLoading && currentViewState) {
			// Use untrack to read current map state without creating dependencies
			const currentCenter = untrack(() => currentMap.getCenter());
			const currentZoom = untrack(() => currentMap.getZoom());
			const currentBearing = untrack(() => currentMap.getBearing());
			const currentPitch = untrack(() => currentMap.getPitch());

			// Only update if values actually changed to avoid unnecessary updates
			const centerChanged =
				Math.abs(currentCenter.lng - currentViewState.longitude) > 0.0001 ||
				Math.abs(currentCenter.lat - currentViewState.latitude) > 0.0001;
			const zoomChanged = Math.abs(currentZoom - currentViewState.zoom) > 0.01;
			const bearingChanged =
				currentViewState.bearing !== undefined &&
				Math.abs(currentBearing - currentViewState.bearing) > 0.01;
			const pitchChanged =
				currentViewState.pitch !== undefined && Math.abs(currentPitch - currentViewState.pitch) > 0.01;

			if (centerChanged || zoomChanged || bearingChanged || pitchChanged) {
				// These mutations don't need untrack since they don't return reactive values
				currentMap.setCenter([currentViewState.longitude, currentViewState.latitude]);
				currentMap.setZoom(currentViewState.zoom);
				if (currentViewState.bearing !== undefined) {
					currentMap.setBearing(currentViewState.bearing);
				}
				if (currentViewState.pitch !== undefined) {
					currentMap.setPitch(currentViewState.pitch);
				}
			}
		}
	});

	// Cleanup
	onDestroy(() => {
		destroyMap();
	});
</script>

<div
	class="relative w-full h-full min-h-[400px]"
	bind:this={mapContainer}
	style:width={typeof width === 'number' ? `${width}px` : (width ?? '100%')}
	style:height={typeof height === 'number' ? `${height}px` : (height ?? '100%')}
	role="application"
	aria-label="Interactive map visualization with geographic data layers"
>
	{#if loading}
		<div
			class="pointer-events-none absolute inset-0 grid place-items-center"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<div class="flex items-center gap-3 rounded-lg bg-white/95 px-6 py-4 text-sm text-slate-800 shadow">
				<span
					class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500"
					aria-hidden="true"
				></span>
				<span>Loading map...</span>
			</div>
		</div>
	{:else if error}
		<div class="absolute inset-0 grid place-items-center" role="alert" aria-live="assertive">
			<div class="max-w-[80%] rounded-lg bg-red-600/95 px-6 py-5 text-center text-sm text-white shadow">
				<p class="font-semibold">Error</p>
				<p class="mt-1 opacity-95">{error}</p>
			<button
				class="btn mt-4 bg-white text-red-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
				type="button"
				onclick={() => {
					void initializeMap();
				}}
			>
				Retry
			</button>
			</div>
		</div>
	{/if}

	<!-- Globe Toggle Button - Reusable functionality for all maps -->
	{#if showGlobeToggle && map && !loading && !error}
		<button
			type="button"
			class="absolute {positionClasses[globeTogglePosition]} z-10 flex items-center rounded-lg bg-white px-2 py-2 shadow-lg transition-all hover:shadow-xl"
			onclick={toggleProjection}
			aria-label="Toggle between 2D and 3D globe view"
		>
			{#if isGlobeView}
				<MapIcon class="h-5 w-5 text-slate-700" />
			{:else}
				<Globe class="h-5 w-5 text-slate-700" />
			{/if}
		</button>
	{/if}
</div>

<style>
	:global(.maplibregl-map) {
		width: 100%;
		height: 100%;
	}
</style>
