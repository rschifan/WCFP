<script lang="ts">
	/**
	 * Copy a string to the clipboard, confirming in place.
	 *
	 * Two surfaces need this — the species record copies its permalink, the About page copies the
	 * dataset citation — and the confirmation timing, the icon swap and the failure handling should
	 * not be re-decided per caller.
	 *
	 * The button says what it will copy rather than just "Copy", because a page can hold more than
	 * one of these and "Copied" alone does not tell the reader what landed on their clipboard.
	 */
	import { Check, Copy } from 'lucide-svelte';
	import { onDestroy } from 'svelte';

	const CONFIRMATION_MS = 2000;

	interface Props {
		/** Resolved text to copy. A relative URL should be made absolute by the caller. */
		value: string;
		label?: string;
		copiedLabel?: string;
		class?: string;
	}

	let { value, label = 'Copy', copiedLabel = 'Copied', class: className = '' }: Props = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => clearTimeout(timer));

	async function copy() {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), CONFIRMATION_MS);
		} catch (error) {
			// Clipboard access can be denied outright; failing silently would leave the reader
			// believing the copy worked.
			console.error('[CopyButton] Could not copy to the clipboard:', error);
		}
	}
</script>

<button
	type="button"
	class="inline-flex items-center gap-1.5 text-xs text-surface-600-400 transition-colors hover:text-surface-950-50 {className}"
	onclick={copy}
>
	{#if copied}
		<Check class="size-3.5" aria-hidden="true" />
		<span>{copiedLabel}</span>
	{:else}
		<Copy class="size-3.5" aria-hidden="true" />
		<span>{label}</span>
	{/if}
</button>
