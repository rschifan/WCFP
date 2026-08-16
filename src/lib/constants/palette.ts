/**
 * Global design palette.
 *
 * Map and UI accents should import values from here instead of hardcoding hex
 * colors in components so that retheming is a small, centralized change.
 */

/**
 * Occurrence status is categorical: a species is native to an area or introduced to it.
 *
 * Drawn from ColorBrewer 2.0's **Set2**, a qualitative scheme — its classes carry no order, which
 * is the point: native and introduced differ in kind, not degree. Two tints of one hue were tried
 * first and read as a quantity ramp, which is exactly the wrong message.
 *
 * Green for native follows the convention readers already know from POWO and Kew. Set2's pastels
 * sit quietly against the portal's pale surfaces where a saturated scheme fought them, and the
 * scheme stays separable under deuteranopia. Extinct takes Set2's own grey, a step darker than
 * the no-data fill it sits beside.
 *
 * @see https://colorbrewer2.org/#type=qualitative&scheme=Set2&n=3
 */
export interface OccurrencePalette {
	native: string;
	introduced: string;
	extinct: string;
	doubtful: string;
}

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
	/** Used for single-species maps, where areas carry a status rather than a count. */
	occurrence: OccurrencePalette;
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
			selectedFill: '#3B82F6',
			occurrence: {
				/** Set2 class 1 — green, the convention for a native range. */
				native: '#66C2A5',
				/** Set2 class 3 — periwinkle; separable from green under red-green colour blindness. */
				introduced: '#8DA0CB',
				/** Set2 class 8 — grey, darker than the no-data fill it sits beside. */
				extinct: '#B3B3B3',
				/** Set2 class 6 — sand, reading as caution rather than as a third range. */
				doubtful: '#FFD92F'
			}
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
			--app-map-native: ${palette.map.occurrence.native};
			--app-map-introduced: ${palette.map.occurrence.introduced};
			--app-map-extinct: ${palette.map.occurrence.extinct};
			--app-map-doubtful: ${palette.map.occurrence.doubtful};
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
