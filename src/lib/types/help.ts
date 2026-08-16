import type { HierarchyEntryBadge } from './hierarchy';

export type HelpIcon = typeof import('lucide-svelte').Search;

export interface HelpInlinePart {
	text: string;
	href?: string;
	/**
	 * Reference ids cited at this point in the sentence, rendered as superscript numbers keyed to
	 * the one bibliography at the foot of the guide.
	 */
	cite?: string[];
}

export type HelpParagraph = string | HelpInlinePart[];

export interface HelpReference {
	/** Stable key a paragraph cites with `cite`. Numbering comes from position in the list. */
	id: string;
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
}
