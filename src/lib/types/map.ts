import type { Layer } from '@deck.gl/core';
import type { Map as MapLibreMapType, Expression } from 'maplibre-gl';

/**
 * ViewState interface for map viewport
 */
export interface ViewState {
	longitude: number;
	latitude: number;
	zoom: number;
	bearing?: number;
	pitch?: number;
}

/**
 * Configuration for GeoJSON layer styling
 */
export interface GeoJSONLayerConfig {
	sourceId: string;
	fillLayerId: string;
	strokeLayerId: string;
	fillColor: Expression;
	fillOpacity: number;
	strokeColor: string;
	strokeWidth: number;
}

/**
 * Map component props interface
 */
export interface MapProps {
	/**
	 * Array of deck.gl layer instances
	 */
	layers?: Layer[];
	/**
	 * Initial map viewport state
	 */
	initialViewState?: ViewState;
	/**
	 * MapLibre style URL (defaults to CartoDB Positron - open source)
	 */
	mapStyle?: string;
	/**
	 * Component width (defaults to 100%)
	 */
	width?: number | string;
	/**
	 * Component height (defaults to 100%)
	 */
	height?: number | string;
	/**
	 * Optional callback when viewport changes
	 */
	onViewStateChange?: (viewState: ViewState) => void;
	/**
	 * Optional callback when map is loaded and ready.
	 * Receives the MapLibre map instance for advanced usage.
	 */
	onMapLoad?: (map: MapLibreMapType) => void;
	/**
	 * Show the globe toggle button (default: true)
	 */
	showGlobeToggle?: boolean;
	/**
	 * Position of the globe toggle button (default: 'top-left')
	 */
	globeTogglePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * Default map style (open source, no API key required)
 */
export const DEFAULT_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

/**
 * Default initial view state
 */
export const DEFAULT_VIEW_STATE: ViewState = {
	longitude: 0,
	latitude: 0,
	zoom: 2
};
