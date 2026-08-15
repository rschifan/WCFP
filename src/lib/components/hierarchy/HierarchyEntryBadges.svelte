<script lang="ts">
	import type { HierarchyEntryBadge } from '$lib/types/hierarchy';

	interface Props {
		badges?: readonly HierarchyEntryBadge[];
	}

	let { badges = [] }: Props = $props();

	let activeTooltip = $state<{
		title: string;
		description?: string;
		x: number;
		y: number;
	} | null>(null);

	const visibleBadges = $derived(badges.filter((badge) => badge.visible !== false));

	function getToneClasses(tone: HierarchyEntryBadge['tone'] = 'slate'): string {
		switch (tone) {
			case 'amber':
				return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
			case 'rose':
				return 'bg-rose-100 text-rose-700 hover:bg-rose-200';
			case 'orange':
				return 'bg-orange-100 text-orange-700 hover:bg-orange-200';
			case 'stone':
				return 'bg-stone-100 text-stone-700 hover:bg-stone-200';
			case 'purple':
				return 'bg-purple-100 text-purple-700 hover:bg-purple-200';
			case 'lime':
				return 'bg-lime-100 text-lime-700 hover:bg-lime-200';
			case 'blue':
				return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
			case 'teal':
				return 'bg-teal-100 text-teal-700 hover:bg-teal-200';
			case 'indigo':
				return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200';
			case 'slate':
			default:
				return 'bg-slate-100 text-slate-600 hover:bg-slate-200';
		}
	}

	function getBadgeClasses(badge: HierarchyEntryBadge): string {
		return `inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] ${getToneClasses(badge.tone)}`;
	}

	function showTooltip(event: MouseEvent | FocusEvent, badge: HierarchyEntryBadge) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLElement)) return;

		const rect = target.getBoundingClientRect();
		activeTooltip = {
			title: badge.tooltip ?? badge.label ?? badge.ariaLabel ?? '',
			description: badge.description,
			x: rect.left + rect.width / 2,
			y: rect.top - 8
		};
	}

	function hideTooltip() {
		activeTooltip = null;
	}

	function hasTooltip(badge: HierarchyEntryBadge): boolean {
		return Boolean(badge.tooltip || badge.description);
	}
</script>

{#if activeTooltip}
	<div
		class="pointer-events-none fixed z-[100]"
		style:left="{activeTooltip.x}px"
		style:top="{activeTooltip.y}px"
		style:transform="translate(-50%, -100%)"
	>
		<div class="max-w-xs rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
			<p class="font-semibold">{activeTooltip.title}</p>
			{#if activeTooltip.description}
				<p class="mt-0.5 text-slate-300">{activeTooltip.description}</p>
			{/if}
		</div>
		<div
			class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"
		></div>
	</div>
{/if}

{#if visibleBadges.length > 0}
	<div class="flex flex-wrap items-center gap-1">
		{#each visibleBadges as badge (badge.id)}
			{@const Icon = badge.icon}
			{#if hasTooltip(badge)}
				<button
					type="button"
					class="{getBadgeClasses(badge)} cursor-help"
					aria-label={badge.ariaLabel ?? badge.tooltip ?? badge.label}
					onmouseenter={(event) => showTooltip(event, badge)}
					onmouseleave={hideTooltip}
					onfocus={(event) => showTooltip(event, badge)}
					onblur={hideTooltip}
				>
					{#if Icon}
						<Icon class="h-[11px] w-[11px]" aria-hidden="true" />
					{/if}
					{#if badge.label}
						<span>{badge.label}</span>
					{/if}
				</button>
			{:else}
				<span class={getBadgeClasses(badge)}>
					{#if Icon}
						<Icon class="h-[11px] w-[11px]" aria-hidden="true" />
					{/if}
					{#if badge.label}
						<span>{badge.label}</span>
					{/if}
				</span>
			{/if}
		{/each}
	</div>
{/if}
