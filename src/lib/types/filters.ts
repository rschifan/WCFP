import type { Search } from 'lucide-svelte';
import type { SearchStatus } from './search';

export type FilterIcon = typeof Search;

export interface FilterOption {
	id: string;
	label?: string;
	icon?: FilterIcon;
	selected?: boolean;
	title?: string;
	ariaLabel?: string;
	activeClass?: string;
}

export interface ActiveFilterChip {
	id: string;
	label: string;
	icon?: FilterIcon;
	onRemove: () => void;
}

interface BaseFilterSectionModel {
	id: string;
	title: string;
}

export interface ToggleChipSectionModel extends BaseFilterSectionModel {
	kind: 'toggle-chip';
	options: FilterOption[];
	onToggle: (optionId: string) => void;
}

export interface MultiChipSectionModel extends BaseFilterSectionModel {
	kind: 'multi-chip';
	options: FilterOption[];
	onToggle: (optionId: string) => void;
}

export interface MultiSelectSectionModel extends BaseFilterSectionModel {
	kind: 'multi-select';
	selectId: string;
	options: FilterOption[];
	helpText?: string;
	onChange: (selectedIds: string[]) => void;
}

export type FilterSectionModel =
	| ToggleChipSectionModel
	| MultiChipSectionModel
	| MultiSelectSectionModel;

export interface FilterBarModel {
	searchPlaceholder: string;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onClearSearch?: () => void;
	searchStatus?: SearchStatus;
	searchError?: string | null;
	activeFilterCount: number;
	activeFilterChips?: ActiveFilterChip[];
	onClearAll?: () => void;
	sections: FilterSectionModel[];
}
