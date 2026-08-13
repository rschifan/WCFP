<script lang="ts">
	import type { HierarchyEntryAction } from '$lib/types/hierarchy';

	interface Props {
		actions?: readonly HierarchyEntryAction[];
		onAction?: (action: HierarchyEntryAction, trigger?: HTMLElement | null) => void;
		inline?: boolean;
	}

	let { actions = [], onAction, inline = false }: Props = $props();

	const visibleActions = $derived(actions.filter((action) => action.visible !== false));

	function getToneClasses(tone: HierarchyEntryAction['tone'] = 'neutral', iconOnly = true): string {
		if (tone === 'accent') {
			return iconOnly ? 'app-accent-icon-button' : 'app-accent-text hover:bg-slate-100';
		}

		if (tone === 'inline') {
			return iconOnly
				? 'text-slate-900 hover:text-slate-900'
				: 'text-slate-900 hover:text-slate-900 underline decoration-slate-400 underline-offset-2';
		}

		if (tone === 'subtle') {
			return 'text-slate-400 hover:bg-slate-100 hover:text-slate-600';
		}

		return 'text-slate-500 hover:bg-slate-100 hover:text-slate-700';
	}

	function getActionClasses(action: HierarchyEntryAction): string {
		const iconOnly = !action.label;
		const sizeClasses = iconOnly
			? 'flex h-5 w-5 items-center justify-center rounded'
			: action.tone === 'inline'
				? 'inline-flex items-center px-0 py-0 text-[11px] leading-5 font-medium whitespace-nowrap'
				: 'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium';

		return `${sizeClasses} transition focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 ${getToneClasses(action.tone, iconOnly)}`;
	}
</script>

{#if visibleActions.length > 0}
	<svelte:element this={inline ? 'span' : 'div'} class={inline ? 'inline-flex shrink-0 items-center gap-1 align-baseline' : 'flex shrink-0 items-center gap-1'}>
		{#each visibleActions as action (action.id)}
			{@const Icon = action.icon}
			{#if action.kind === 'link' && action.href}
				<a
					href={action.href}
					target={action.target}
					rel="external"
					class={getActionClasses(action)}
					aria-label={action.ariaLabel ?? action.label}
					title={action.tooltip ?? action.label ?? action.ariaLabel}
					onclick={(event) => event.stopPropagation()}
					onkeydown={(event) => event.stopPropagation()}
				>
					{#if Icon}
						<Icon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					{/if}
					{#if action.label}
						<span>{action.label}</span>
					{/if}
				</a>
			{:else}
				<button
					type="button"
					class={getActionClasses(action)}
					disabled={action.disabled}
					aria-label={action.ariaLabel ?? action.label}
					title={action.tooltip ?? action.label ?? action.ariaLabel}
					onclick={(event) => {
						event.stopPropagation();
						if (!action.disabled) {
							onAction?.(
								action,
								event.currentTarget instanceof HTMLElement ? event.currentTarget : null
							);
						}
					}}
					onkeydown={(event) => event.stopPropagation()}
				>
					{#if Icon}
						<Icon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					{/if}
					{#if action.label}
						<span>{action.label}</span>
					{/if}
				</button>
			{/if}
		{/each}
	</svelte:element>
{/if}
