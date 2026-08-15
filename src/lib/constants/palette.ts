/**
 * Global design palette.
 *
 * Map and UI accents should import values from here instead of hardcoding hex
 * colors in components so that retheming is a small, centralized change.
 */

export interface MapPalette {
	low: string;
	mid: string;
	high: string;
	noData: string;
	hover: string;
	/** Stroke color for the selected region border. */
	selected: string;
	/** Fill overlay color for the selected region (applied semi-transparently over the choropleth). */
	selectedFill: string;
}

export interface UiPalette {
	accent: string;
	accentHover: string;
	accentText: string;
	accentTextHover: string;
	accentSoft: string;
	accentBorder: string;
	accentStrong: string;
}

export interface AppPalette {
	map: MapPalette;
	ui: UiPalette;
}

export const APP_THEMES = {
	red: {
		map: {
			low: '#FFFFFF',
			mid: '#FF8080',
			high: '#FF0000',
			noData: '#D3D3D3',
			hover: '#991B1B',
			selected: '#1D4ED8',
			selectedFill: '#3B82F6'
		},
		ui: {
			accent: '#B91C1C',
			accentHover: '#991B1B',
			accentText: '#991B1B',
			accentTextHover: '#7F1D1D',
			accentSoft: '#FEE2E2',
			accentBorder: '#FCA5A5',
			accentStrong: '#DC2626'
		}
	}
} satisfies Record<string, AppPalette>;

export type AppThemeName = keyof typeof APP_THEMES;

/**
 * Change this single value to swap the site's global palette.
 */
export const ACTIVE_THEME: AppThemeName = 'red';

export const APP_PALETTE: AppPalette = APP_THEMES[ACTIVE_THEME];

export const APP_MAP_PALETTE: MapPalette = APP_PALETTE.map;
export const APP_UI_PALETTE: UiPalette = APP_PALETTE.ui;

export function buildRootPaletteCss(palette: AppPalette = APP_PALETTE): string {
	return `
		:root {
			--app-map-low: ${palette.map.low};
			--app-map-mid: ${palette.map.mid};
			--app-map-high: ${palette.map.high};
			--app-map-no-data: ${palette.map.noData};
			--app-map-hover: ${palette.map.hover};
			--app-map-selected: ${palette.map.selected};
			--app-map-selected-fill: ${palette.map.selectedFill};
			--app-color-accent: ${palette.ui.accent};
			--app-color-accent-hover: ${palette.ui.accentHover};
			--app-color-accent-text: ${palette.ui.accentText};
			--app-color-accent-text-hover: ${palette.ui.accentTextHover};
			--app-color-accent-soft: ${palette.ui.accentSoft};
			--app-color-accent-border: ${palette.ui.accentBorder};
			--app-color-accent-strong: ${palette.ui.accentStrong};
		}
	`;
}
