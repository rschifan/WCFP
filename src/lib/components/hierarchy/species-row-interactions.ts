import type {
	HierarchyEntryAction,
	HierarchyEntryActionHandler,
	HierarchyEntryBadge,
	HierarchyEntryModel
} from '$lib/types/hierarchy';

export const OPEN_MAP_ACTION_ID = 'open-map';

interface SpeciesMapActionConfig {
	enabled: boolean;
	areaCount: number;
	onOpenMap: (trigger?: HTMLElement | null) => void;
}

interface SpeciesRowInteractionConfig {
	id: string;
	title: string;
	subtitle?: string;
	badges?: readonly HierarchyEntryBadge[];
	selected?: boolean;
	appearance?: Pick<HierarchyEntryModel, 'titleTone' | 'titleStyle' | 'titleWeight'>;
	/** Opens the record. The row itself is the target, so this always exists. */
	onOpenDetails: (trigger?: HTMLElement | null) => void;
	/** Opens the same record on its map. Absent when the species has no recorded areas. */
	mapAction?: SpeciesMapActionConfig;
}

export interface SpeciesRowInteraction {
	entry: HierarchyEntryModel;
	onRowClick: (trigger?: HTMLElement | null) => void;
	onAction: HierarchyEntryActionHandler;
}

function buildMapAction(title: string, mapAction?: SpeciesMapActionConfig): HierarchyEntryAction[] {
	if (!mapAction?.enabled || mapAction.areaCount <= 0) {
		return [];
	}

	const areaLabel = mapAction.areaCount === 1 ? '1 area' : `${mapAction.areaCount} areas`;

	return [
		{
			id: OPEN_MAP_ACTION_ID,
			kind: 'button',
			label: areaLabel,
			ariaLabel: `Open the distribution map for ${title}, ${areaLabel}`,
			tooltip: `Open the distribution map for ${title}`,
			tone: 'inline'
		}
	];
}

/**
 * One species row, two targets: the row opens the record, the area count opens its map.
 *
 * Both land in the same scheda on different tabs, so the row never has to choose which of the
 * two things a reader wanted.
 */
export function createSpeciesRowInteraction(
	config: SpeciesRowInteractionConfig
): SpeciesRowInteraction {
	const entry: HierarchyEntryModel = {
		id: config.id,
		title: config.title,
		subtitle: config.subtitle,
		subtitleDisplay: config.subtitle ? 'inline' : undefined,
		badges: config.badges ?? [],
		actions: buildMapAction(config.title, config.mapAction),
		actionPlacement: config.mapAction?.enabled ? 'inline-title' : undefined,
		selected: config.selected,
		hoverable: true,
		interactive: true,
		...config.appearance
	};

	return {
		entry,
		onRowClick: (trigger) => config.onOpenDetails(trigger),
		onAction: (action, _entry, trigger) => {
			if (action.id === OPEN_MAP_ACTION_ID) {
				config.mapAction?.onOpenMap(trigger);
			}
		}
	};
}
