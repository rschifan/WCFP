import type {
	HierarchyEntryAction,
	HierarchyEntryActionHandler,
	HierarchyEntryBadge,
	HierarchyEntryModel
} from '$lib/types/hierarchy';
import type { Species } from '$lib/types/species';
import type { SpeciesDetailController } from './species-detail-state';

export const OPEN_MAP_ACTION_ID = 'open-map';

export type SpeciesDetailSource = { species: Species } | { wcfpId: number };

interface SpeciesMapActionConfig {
	enabled: boolean;
	areaCount: number;
	onOpenMap: () => void;
}

interface SpeciesRowInteractionConfig {
	id: string;
	title: string;
	subtitle?: string;
	badges?: readonly HierarchyEntryBadge[];
	selected?: boolean;
	detailSource: SpeciesDetailSource;
	detailController: SpeciesDetailController;
	appearance?: Pick<HierarchyEntryModel, 'titleTone' | 'titleStyle' | 'titleWeight'>;
	mapAction?: SpeciesMapActionConfig;
}

export interface SpeciesRowInteraction {
	entry: HierarchyEntryModel;
	onRowClick: (trigger?: HTMLElement | null) => void | Promise<void>;
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
			ariaLabel: `Open map for ${title} across ${areaLabel}`,
			tooltip: `Open map for ${title}`,
			tone: 'inline'
		}
	];
}

async function openDetails(
	controller: SpeciesDetailController,
	detailSource: SpeciesDetailSource,
	trigger?: HTMLElement | null
) {
	try {
		if ('species' in detailSource) {
			controller.openFromSpecies(detailSource.species, trigger);
			return;
		}

		await controller.openById(detailSource.wcfpId, trigger);
	} catch (error) {
		console.error('[SpeciesRowInteraction] Failed to open species details:', error);
	}
}

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
		onRowClick: (trigger) => openDetails(config.detailController, config.detailSource, trigger),
		onAction: (action) => {
			if (action.id === OPEN_MAP_ACTION_ID) {
				config.mapAction?.onOpenMap();
			}
		}
	};
}
