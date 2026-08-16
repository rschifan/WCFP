<script lang="ts" module>
	/**
	 * One reference. `href` is set when the citation has a single known destination — the About
	 * page curates these by hand. Species citations arrive as free text with no `href`, and any
	 * DOIs or URLs inside them are detected instead.
	 */
	export interface ReferenceEntry {
		label: string;
		href?: string;
	}
</script>

<script lang="ts">
	/**
	 * The one way references are presented, wherever they appear.
	 *
	 * Two callers with different data shapes were rendering their own: the species scheda with
	 * free text it has to scan for links, the About page with curated label/href pairs. They had
	 * drifted apart on heading case, list style, link colour and even `rel`. The differences that
	 * are real — a section with two references should not collapse, a taxon with 265 must — stay
	 * as props; everything else is settled here once.
	 */
	import { linkifyReference } from '$lib/utils/species/linkify';
	import { formatCount } from '$lib/utils/format';

	interface Props {
		references: readonly ReferenceEntry[];
		/** Collapse past this many. `null` keeps the list always open, for short curated sets. */
		collapseAbove?: number | null;
		title?: string;
		/** Shown in place of the list when there is nothing. Omit to render nothing at all. */
		emptyMessage?: string | null;
		/** Distinguishes the generated keys when several lists share a page. */
		idPrefix?: string;
	}

	let {
		references,
		collapseAbove = null,
		title = 'References',
		emptyMessage = null,
		idPrefix = 'reference'
	}: Props = $props();

	const collapsible = $derived(collapseAbove !== null && references.length > collapseAbove);
</script>

{#snippet entryText(entry: ReferenceEntry)}
	{#if entry.href}
		<a
			href={entry.href}
			target="_blank"
			rel="external noopener noreferrer"
			class="app-accent-text break-words hover:underline">{entry.label}</a
		>
	{:else}
		<!-- Segments, not {@html}: a citation is untrusted free text. -->
		{#each linkifyReference(entry.label) as segment, segmentIndex (segmentIndex)}
			{#if segment.href}
				<a
					href={segment.href}
					target="_blank"
					rel="external noopener noreferrer"
					class="app-accent-text break-all hover:underline">{segment.text}</a
				>
			{:else}{segment.text}{/if}
		{/each}
	{/if}
{/snippet}

{#snippet list()}
	<ol class="mt-2 divide-y divide-surface-200-800 text-sm">
		{#each references as entry, index (`${idPrefix}-${index}`)}
			<li class="flex gap-3 py-2 leading-relaxed">
				<span class="w-6 shrink-0 text-right text-xs text-surface-600-400 tabular-nums">
					{index + 1}
				</span>
				<span class="text-surface-800-200">{@render entryText(entry)}</span>
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet heading()}
	<span>{title}</span>
	{#if references.length > 1}
		<span class="tabular-nums">{formatCount(references.length)}</span>
	{/if}
{/snippet}

{#if references.length === 0}
	{#if emptyMessage}
		<p class="text-xs text-surface-600-400">
			<span class="block">{title}</span>
			<span class="mt-1 block text-sm">{emptyMessage}</span>
		</p>
	{/if}
{:else if collapsible}
	<details class="group">
		<summary
			class="flex cursor-pointer items-baseline gap-2 text-xs text-surface-600-400 marker:content-none"
		>
			{@render heading()}
			<span class="app-accent-text ml-auto group-open:hidden">Show all</span>
			<span class="app-accent-text ml-auto hidden group-open:inline">Hide</span>
		</summary>
		{@render list()}
	</details>
{:else}
	<div class="flex items-baseline gap-2 text-xs text-surface-600-400">{@render heading()}</div>
	{@render list()}
{/if}
