<script lang="ts">
	import { HierarchyEntryBadges } from '$lib/components/hierarchy';
	import ReferenceList from '$lib/components/references/ReferenceList.svelte';
	import type { HelpInlinePart, HelpParagraph, HelpSection } from '$lib/types/help';

	interface Props {
		title?: string;
		intro?: string;
		sections: HelpSection[];
		variant?: 'plain' | 'compact';
	}

	let { title, intro, sections, variant = 'plain' }: Props = $props();

	function hasRowIcons(section: HelpSection): boolean {
		return section.table ? section.table.rows.some((row) => row.icon || row.iconBadge) : false;
	}

	function isRichParagraph(paragraph: HelpParagraph): paragraph is HelpInlinePart[] {
		return Array.isArray(paragraph);
	}

	function paragraphParts(paragraph: HelpParagraph): HelpInlinePart[] {
		return isRichParagraph(paragraph) ? paragraph : [{ text: paragraph }];
	}
</script>

<section class="bg-white">
	{#if title || intro}
		<div class="lg:max-w-4xl">
			{#if title}
				<h2 class="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{title}</h2>
			{/if}
			{#if intro}
				<p class="mt-3 text-base leading-7 text-slate-600 md:text-lg">{intro}</p>
			{/if}
		</div>
	{/if}

	<div class="mt-8">
		{#each sections as section, sectionIndex (section.id)}
			<article
				class="py-8 {sectionIndex > 0 ? 'border-t border-slate-200' : ''} {variant === 'compact'
					? 'py-6'
					: ''}"
			>
				<div class="flex items-start gap-4">
					{#if section.icon}
						{@const Icon = section.icon}
						<div class="rounded-lg bg-slate-100 p-2.5">
							<Icon class="h-5 w-5 text-slate-600" />
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<h3 class="text-xl font-semibold text-slate-900">{section.title}</h3>
						{#if section.description}
							<p class="mt-2 text-sm leading-6 text-slate-600 md:text-base">
								{section.description}
							</p>
						{/if}
					</div>
				</div>

				{#if section.paragraphs}
					<div class="mt-4 space-y-3">
						{#each section.paragraphs as paragraph, paragraphIndex (`${section.id}-paragraph-${paragraphIndex}`)}
							<p class="text-sm leading-7 text-slate-700 md:text-base">
								{#each paragraphParts(paragraph) as part, partIndex (`${section.id}-${partIndex}`)}
									{#if part.href}
										<a
											href={part.href}
											target="_blank"
											rel="external noopener noreferrer"
											class="app-accent-link"
										>
											{part.text}
										</a>
									{:else}
										{part.text}
									{/if}
								{/each}
							</p>
						{/each}
					</div>
				{/if}

				{#if section.table}
					<div class="mt-5 overflow-x-auto border border-slate-200">
						<table class="min-w-full border-collapse text-left">
							<thead class="bg-slate-50">
								<tr>
									{#if hasRowIcons(section)}
										<th
											class="w-14 px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
										>
											Icon
										</th>
									{/if}
									{#each section.table.columns as column, columnIndex (`${section.id}-column-${columnIndex}`)}
										<th
											class="px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
										>
											{column}
										</th>
									{/each}
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-200 bg-white">
								{#each section.table.rows as row, rowIndex (`${section.id}-row-${rowIndex}`)}
									<tr class="align-top">
										{#if hasRowIcons(section)}
											<td class="px-4 py-4">
												{#if row.iconBadge}
													<HierarchyEntryBadges badges={[row.iconBadge]} />
												{:else if row.icon}
													{@const RowIcon = row.icon}
													<div
														class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"
													>
														<RowIcon class="h-4 w-4 text-slate-600" />
													</div>
												{/if}
											</td>
										{/if}
										{#each row.cells as cell, index (`${section.id}-cell-${rowIndex}-${index}`)}
											<td
												class="px-4 py-4 text-sm leading-6 text-slate-700 {index === 0
													? 'font-semibold text-slate-900'
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

				{#if section.references && section.references.length > 0}
					<div class="mt-5 border-t border-slate-200 pt-4">
						<!-- Same presentation as a species record's bibliography; these sets are short
						     and curated, so they never collapse. -->
						<ReferenceList references={section.references} idPrefix={`${section.id}-reference`} />
					</div>
				{/if}
			</article>
		{/each}
	</div>
</section>
