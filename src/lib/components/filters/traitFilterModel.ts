import { TreeDeciduous } from 'lucide-svelte';
import { FILTER_USE_CATEGORIES } from '$lib/constants/portal-help';
import type { ActiveFilterChip, FilterSectionModel } from '$lib/types/filters';
import type { SpeciesUseKey } from '$lib/types/species';

export interface TraitLifeformOption {
	value: string;
	label: string;
}

interface BuildTraitFilterSectionsOptions {
	selectedUses: ReadonlySet<SpeciesUseKey>;
	selectedLifeforms: ReadonlySet<string>;
	lifeformOptions: TraitLifeformOption[];
	lifeformSelectId: string;
	onToggleUse: (useKey: SpeciesUseKey) => void;
	onLifeformsChange: (selectedIds: string[]) => void;
}

interface BuildTraitFilterChipsOptions {
	selectedUses: ReadonlySet<SpeciesUseKey>;
	selectedLifeforms: ReadonlySet<string>;
	onRemoveUse: (useKey: SpeciesUseKey) => void;
	onRemoveLifeform: (lifeform: string) => void;
}

export function buildTraitFilterSections({
	selectedUses,
	selectedLifeforms,
	lifeformOptions,
	lifeformSelectId,
	onToggleUse,
	onLifeformsChange
}: BuildTraitFilterSectionsOptions): FilterSectionModel[] {
	const sections: FilterSectionModel[] = [
		{
			id: 'uses',
			title: 'Uses',
			kind: 'multi-chip',
			options: FILTER_USE_CATEGORIES.map(({ key, label, icon, activeClass }) => ({
				id: key,
				label,
				icon,
				selected: selectedUses.has(key),
				activeClass
			})),
			onToggle: (optionId) => onToggleUse(optionId as SpeciesUseKey)
		}
	];

	if (lifeformOptions.length > 0) {
		sections.push({
			id: 'lifeform',
			title: 'Lifeform',
			kind: 'multi-select',
			selectId: lifeformSelectId,
			options: lifeformOptions.map(({ value, label }) => ({
				id: value,
				label,
				selected: selectedLifeforms.has(value)
			})),
			helpText: 'Hold Ctrl/Cmd to select multiple',
			onChange: onLifeformsChange
		});
	}

	return sections;
}

export function buildTraitActiveFilterChips({
	selectedUses,
	selectedLifeforms,
	onRemoveUse,
	onRemoveLifeform
}: BuildTraitFilterChipsOptions): ActiveFilterChip[] {
	const chips: ActiveFilterChip[] = [];

	for (const useKey of selectedUses) {
		const category = FILTER_USE_CATEGORIES.find((item) => item.key === useKey);
		if (!category) continue;

		chips.push({
			id: `use:${useKey}`,
			label: category.label,
			icon: category.icon,
			onRemove: () => onRemoveUse(useKey)
		});
	}

	for (const lifeform of selectedLifeforms) {
		chips.push({
			id: `lifeform:${lifeform}`,
			label: lifeform,
			icon: TreeDeciduous,
			onRemove: () => onRemoveLifeform(lifeform)
		});
	}

	return chips;
}
