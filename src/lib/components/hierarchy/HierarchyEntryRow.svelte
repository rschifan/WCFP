<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';
	import HierarchyEntryActions from './HierarchyEntryActions.svelte';
	import HierarchyEntryBadges from './HierarchyEntryBadges.svelte';
	import type {
		HierarchyEntryAction,
		HierarchyEntryActionHandler,
		HierarchyEntryModel,
		HierarchyEntryPreset
	} from '$lib/types/hierarchy';

	interface Props {
		entry: HierarchyEntryModel;
		preset: HierarchyEntryPreset;
		highlightQuery?: string;
		onRowClick?: (trigger?: HTMLElement | null) => void | Promise<void>;
		onRowKeyDown?: (event: KeyboardEvent) => void;
		onAction?: HierarchyEntryActionHandler;
		ariaDisabled?: boolean;
		class?: string;
	}

	let {
		entry,
		preset,
		highlightQuery = '',
		onRowClick,
		onRowKeyDown,
		onAction,
		ariaDisabled = false,
		class: className = ''
	}: Props = $props();

	const shouldShowMeta = $derived(preset.showMeta !== false && Boolean(entry.meta));
	const shouldShowSubtitle = $derived(preset.showSubtitle !== false && Boolean(entry.subtitle));
	const shouldShowBadges = $derived(
		preset.showBadges !== false && (entry.badges?.some((badge) => badge.visible !== false) ?? false)
	);
	const shouldShowCount = $derived(preset.showCount !== false && entry.count !== undefined);
	const isInteractiveRow = $derived(Boolean(onRowClick || entry.interactive || entry.expandable));
	const shouldHover = $derived(Boolean(entry.hoverable || isInteractiveRow));
	const showInlineActions = $derived(entry.actionPlacement === 'inline-title');
	const trailingActions = $derived(showInlineActions ? [] : entry.actions);

	function splitByMatch(text: string, query: string): Array<{ text: string; isMatch: boolean }> {
		if (!query.trim()) return [{ text, isMatch: false }];
		const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escapedQuery})`, 'gi');
		const parts = text.split(regex);

		return parts
			.map((part, index) => ({ text: part, isMatch: index % 2 === 1 }))
			.filter((item) => item.text !== '');
	}

	function getTitleToneClass() {
		switch (entry.titleTone) {
			case 'accent':
				return 'app-accent-text';
			case 'muted':
				return 'text-slate-600';
			case 'strong':
				return 'text-slate-800';
			case 'default':
			default:
				return 'text-slate-700';
		}
	}

	function getTitleWeightClass() {
		switch (entry.titleWeight) {
			case 'regular':
				return 'font-normal';
			case 'medium':
				return 'font-medium';
			case 'semibold':
			default:
				return 'font-semibold';
		}
	}

	function getCountClasses() {
		return 'flex min-w-[2rem] items-center justify-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600';
	}

	function handleAction(action: HierarchyEntryAction, trigger?: HTMLElement | null) {
		onAction?.(action, entry, trigger);
	}

	function getRowAriaLabel() {
		return entry.subtitle ? `${entry.title} ${entry.subtitle}` : entry.title;
	}

	function handleRowKeyDown(event: KeyboardEvent) {
		onRowKeyDown?.(event);

		if (event.defaultPrevented) {
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onRowClick?.(event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
		}
	}

	function getRowClasses(interactive: boolean) {
		return `relative flex w-full items-start gap-1.5 rounded-lg px-2 py-1 transition-colors duration-150 ${
			shouldHover ? 'hover:bg-slate-100' : ''
		} ${entry.selected || entry.active ? 'bg-slate-50' : ''} ${
			interactive
				? 'cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-500'
				: ''
		} ${className}`;
	}
</script>

{#snippet highlightedText(text: string)}
	{#each splitByMatch(text, highlightQuery) as part, index (index)}
		{#if part.isMatch}
			<mark class="rounded bg-amber-200 px-0.5 text-amber-900">{part.text}</mark>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

{#snippet inlineActions()}
	{#if showInlineActions}
		<span class="inline-flex items-center">
			<HierarchyEntryActions actions={entry.actions} onAction={handleAction} inline />
		</span>
	{/if}
{/snippet}

{#snippet rowBody()}
	<ChevronRight
		class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 {entry.expanded
			? 'rotate-90'
			: ''} {!entry.expandable ? 'invisible' : ''}"
	/>

	<div class="min-w-0 flex-1">
		{#if shouldShowMeta}
			<p class="mb-0.5 text-[11px] tracking-[0.14em] text-slate-500 uppercase">{entry.meta}</p>
		{/if}

		{#if shouldShowSubtitle && entry.subtitleDisplay === 'inline'}
			<p class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
				<span
					class="{getTitleToneClass()} {getTitleWeightClass()} {entry.titleStyle === 'italic'
						? 'italic'
						: ''} {entry.selected ? 'underline' : ''}"
				>
					{@render highlightedText(entry.title)}
				</span>
				<span class="text-xs text-slate-500">
					{@render highlightedText(entry.subtitle ?? '')}
				</span>
				{@render inlineActions()}
			</p>
		{:else}
			<div class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
				<p
					class="min-w-0 truncate text-sm {getTitleToneClass()} {getTitleWeightClass()} {entry.titleStyle ===
					'italic'
						? 'italic'
						: ''} {entry.selected ? 'underline' : ''}"
				>
					{@render highlightedText(entry.title)}
				</p>
				{@render inlineActions()}
			</div>

			{#if shouldShowSubtitle}
				<p class="mt-0.5 text-xs text-slate-500">
					{@render highlightedText(entry.subtitle ?? '')}
				</p>
			{/if}
		{/if}

		{#if shouldShowBadges}
			<div class="mt-1">
				<HierarchyEntryBadges badges={entry.badges} />
			</div>
		{/if}
	</div>
{/snippet}

{#snippet rowContent()}
	<div class="relative z-10 flex min-w-0 flex-1 items-start gap-1.5">
		{@render rowBody()}
	</div>

	<div class="relative z-10">
		<HierarchyEntryActions actions={trailingActions} onAction={handleAction} />
	</div>

	{#if shouldShowCount}
		<span class="{getCountClasses()} pointer-events-none relative z-10">
			{entry.count}
		</span>
	{/if}
{/snippet}

{#if isInteractiveRow}
	<div
		role="button"
		tabindex="0"
		aria-label={getRowAriaLabel()}
		aria-disabled={ariaDisabled}
		aria-expanded={entry.expandable ? entry.expanded : undefined}
		class={getRowClasses(true)}
		onclick={(event) =>
			onRowClick?.(event.currentTarget instanceof HTMLElement ? event.currentTarget : null)}
		onkeydown={handleRowKeyDown}
	>
		{@render rowContent()}
	</div>
{:else}
	<div class={getRowClasses(false)}>
		{@render rowContent()}
	</div>
{/if}
