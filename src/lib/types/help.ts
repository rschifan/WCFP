import type { HierarchyEntryBadge } from './hierarchy';

export type HelpIcon = typeof import('lucide-svelte').Search;

export interface HelpInlinePart {
	text: string;
	href?: string;
}

export type HelpParagraph = string | HelpInlinePart[];

export interface HelpReference {
	label: string;
	href?: string;
}

export interface HelpTableRow {
	icon?: HelpIcon | null;
	iconBadge?: HierarchyEntryBadge | null;
	cells: string[];
}

export interface HelpTable {
	columns: string[];
	rows: HelpTableRow[];
}

export interface HelpSection {
	id: string;
	title: string;
	icon?: HelpIcon;
	description?: string;
	paragraphs?: HelpParagraph[];
	table?: HelpTable;
	references?: HelpReference[];
}
