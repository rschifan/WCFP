export type HierarchyEntryIcon = typeof import('lucide-svelte').Search;

export type HierarchyEntryActionKind = 'button' | 'link';
export type HierarchyEntryActionTone = 'accent' | 'neutral' | 'subtle' | 'inline';
export type HierarchyEntryBadgeKind = 'info' | 'status';
export type HierarchyEntryBadgeTone =
	| 'slate'
	| 'amber'
	| 'rose'
	| 'orange'
	| 'stone'
	| 'purple'
	| 'lime'
	| 'blue'
	| 'teal'
	| 'indigo';
export type HierarchyEntryTextTone = 'default' | 'strong' | 'muted' | 'accent';
export type HierarchyEntryTextStyle = 'normal' | 'italic';
export type HierarchyEntryTextWeight = 'regular' | 'medium' | 'semibold';
export type HierarchyEntrySubtitleDisplay = 'block' | 'inline';
export type HierarchyEntryActionPlacement = 'trailing' | 'inline-title';

export interface HierarchyEntryAction {
	id: string;
	label?: string;
	ariaLabel?: string;
	icon?: HierarchyEntryIcon;
	kind: HierarchyEntryActionKind;
	href?: string;
	target?: string;
	rel?: string;
	tooltip?: string;
	tone?: HierarchyEntryActionTone;
	visible?: boolean;
	disabled?: boolean;
}

export interface HierarchyEntryBadge {
	id: string;
	label?: string;
	ariaLabel?: string;
	icon?: HierarchyEntryIcon;
	tooltip?: string;
	description?: string;
	tone?: HierarchyEntryBadgeTone;
	kind?: HierarchyEntryBadgeKind;
	visible?: boolean;
}

export interface HierarchyEntryModel {
	id: string;
	title: string;
	subtitle?: string;
	subtitleDisplay?: HierarchyEntrySubtitleDisplay;
	meta?: string;
	count?: number | string;
	actions?: readonly HierarchyEntryAction[];
	badges?: readonly HierarchyEntryBadge[];
	selected?: boolean;
	active?: boolean;
	hoverable?: boolean;
	expandable?: boolean;
	expanded?: boolean;
	interactive?: boolean;
	titleTone?: HierarchyEntryTextTone;
	titleStyle?: HierarchyEntryTextStyle;
	titleWeight?: HierarchyEntryTextWeight;
	actionPlacement?: HierarchyEntryActionPlacement;
}

export interface HierarchyEntryPreset {
	id: string;
	showMeta?: boolean;
	showSubtitle?: boolean;
	showBadges?: boolean;
	showCount?: boolean;
}

export type HierarchyEntryActionHandler = (
	action: HierarchyEntryAction,
	entry: HierarchyEntryModel,
	trigger?: HTMLElement | null
) => void;
