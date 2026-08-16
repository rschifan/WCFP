<script lang="ts">
	/**
	 * A reference guide: sections of prose and tables, over one shared bibliography.
	 *
	 * References are numbered once for the whole guide and cited inline, rather than each section
	 * keeping its own short list. Per-section lists meant the same source appeared under different
	 * numbers in different places, and a reader had no way to see which sentence a number belonged
	 * to — the numbers existed only in the lists, never in the text.
	 */
	import { HierarchyEntryBadges } from '$lib/components/hierarchy';
	import ReferenceList from '$lib/components/references/ReferenceList.svelte';
	import type { HelpInlinePart, HelpParagraph, HelpReference, HelpSection } from '$lib/types/help';

	interface Props {
		title?: string;
		intro?: string;
		sections: HelpSection[];
		/** The one bibliography. Numbering is position in this list. */
		references?: HelpReference[];
		referencesTitle?: string;
	}

	let { title, intro, sections, references = [], referencesTitle = 'References' }: Props = $props();

	const referenceNumbers = $derived(
		new Map(references.map((reference, index) => [reference.id, index + 1]))
	);

	const bibliography = $derived(
		references.map((reference) => ({
			label: reference.label,
			href: reference.href,
			id: referenceAnchor(reference.id)
		}))
	);

	function hasRowIcons(section: HelpSection): boolean {
		return section.table ? section.table.rows.some((row) => row.icon || row.iconBadge) : false;
	}

	function isRichParagraph(paragraph: HelpParagraph): paragraph is HelpInlinePart[] {
		return Array.isArray(paragraph);
	}

	function paragraphParts(paragraph: HelpParagraph): HelpInlinePart[] {
		return isRichParagraph(paragraph) ? paragraph : [{ text: paragraph }];
	}

	/**
	 * Citation markers for one point in a sentence. A cited id with no entry is dropped rather than
	 * rendered as a dangling number — the guide should never point at a reference that is not there.
	 */
	function citations(part: HelpInlinePart): { id: string; number: number }[] {
		return (part.cite ?? [])
			.map((id) => ({ id, number: referenceNumbers.get(id) ?? 0 }))
			.filter((citation) => citation.number > 0)
			.sort((a, b) => a.number - b.number);
	}

	function referenceAnchor(id: string): string {
		return `about-reference-${id}`;
	}
</script>

<section>
	{#if title || intro}
		<div class="lg:max-w-4xl">
			{#if title}
				<h2 class="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
			{/if}
			{#if intro}
				<p class="mt-3 text-base leading-7 text-surface-700-300 md:text-lg">{intro}</p>
			{/if}
		</div>
	{/if}

	<div class="mt-4">
		{#each sections as section, sectionIndex (section.id)}
			<article class="pb-8 {sectionIndex > 0 ? 'border-t border-surface-200-800 pt-8' : 'pt-4'}">
				<div class="flex items-start gap-4">
					{#if section.icon}
						{@const Icon = section.icon}
						<div class="rounded-lg bg-surface-100-900 p-2.5">
							<Icon class="size-5 text-surface-600-400" aria-hidden="true" />
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<h3 class="text-xl font-semibold">{section.title}</h3>
						{#if section.description}
							<p class="mt-2 text-sm leading-6 text-surface-700-300 md:text-base">
								{section.description}
							</p>
						{/if}
					</div>
				</div>

				{#if section.paragraphs}
					<div class="mt-4 space-y-3">
						{#each section.paragraphs as paragraph, paragraphIndex (`${section.id}-paragraph-${paragraphIndex}`)}
							<p class="text-sm leading-7 text-surface-800-200 md:text-base">
								{#each paragraphParts(paragraph) as part, partIndex (`${section.id}-${paragraphIndex}-${partIndex}`)}
									{#if part.href}
										<a
											href={part.href}
											target="_blank"
											rel="external noopener noreferrer"
											class="app-accent-link"
										>
											{part.text}
										</a>
									{:else}{part.text}{/if}{#each citations(part) as citation, citationIndex (citation.id)}<sup
											class="ml-0.5"
											>{#if citationIndex > 0},{/if}<a
												href={`#${referenceAnchor(citation.id)}`}
												class="app-accent-text tabular-nums hover:underline"
												aria-label={`Reference ${citation.number}`}>{citation.number}</a
											></sup
										>{/each}
								{/each}
							</p>
						{/each}
					</div>
				{/if}

				{#if section.table}
					<div class="mt-5 overflow-x-auto rounded-container border border-surface-200-800">
						<table class="min-w-full border-collapse text-left">
							<thead class="bg-surface-100-900">
								<tr>
									{#if hasRowIcons(section)}
										<th
											class="w-14 px-4 py-3 text-xs font-semibold tracking-wide text-surface-600-400 uppercase"
										>
											Icon
										</th>
									{/if}
									{#each section.table.columns as column, columnIndex (`${section.id}-column-${columnIndex}`)}
										<th
											class="px-4 py-3 text-xs font-semibold tracking-wide text-surface-600-400 uppercase"
										>
											{column}
										</th>
									{/each}
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-200-800">
								{#each section.table.rows as row, rowIndex (`${section.id}-row-${rowIndex}`)}
									<tr class="align-top">
										{#if hasRowIcons(section)}
											<td class="px-4 py-4">
												{#if row.iconBadge}
													<HierarchyEntryBadges badges={[row.iconBadge]} />
												{:else if row.icon}
													{@const RowIcon = row.icon}
													<div
														class="flex size-8 items-center justify-center rounded-full bg-surface-100-900"
													>
														<RowIcon class="size-4 text-surface-600-400" aria-hidden="true" />
													</div>
												{/if}
											</td>
										{/if}
										{#each row.cells as cell, index (`${section.id}-cell-${rowIndex}-${index}`)}
											<td
												class="px-4 py-4 text-sm leading-6 text-surface-800-200 {index === 0
													? 'font-semibold'
													: ''}"
											>
												{cell}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</article>
		{/each}
	</div>

	{#if references.length > 0}
		<!--
			One list for the guide, in citation order, through the same renderer the species records
			use. The ids are what the superscripts above jump to, so every number in the text has a
			destination.
		-->
		<div class="border-t border-surface-200-800 pt-6">
			<ReferenceList references={bibliography} title={referencesTitle} idPrefix="about-reference" />
		</div>
	{/if}
</section>
