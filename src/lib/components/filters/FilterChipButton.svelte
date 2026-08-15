<script lang="ts">
	import type { FilterOption } from '$lib/types/filters';

	interface Props {
		option: FilterOption;
		onClick: () => void;
	}

	let { option, onClick }: Props = $props();

	const buttonClass = $derived(
		option.selected
			? (option.activeClass ?? 'app-accent-chip-active')
			: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
	);
</script>

<button
	type="button"
	class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors {option.label
		? 'gap-1'
		: 'justify-center'} {buttonClass}"
	onclick={onClick}
	title={option.title}
	aria-label={option.ariaLabel ?? option.label}
>
	{#if option.icon}
		{@const Icon = option.icon}
		<Icon class="h-3.5 w-3.5" aria-hidden="true" />
	{/if}
	{#if option.label}
		<span>{option.label}</span>
	{/if}
</button>
