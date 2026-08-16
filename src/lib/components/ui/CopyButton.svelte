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
	import { Check, Copy, TriangleAlert } from 'lucide-svelte';
	import { onDestroy } from 'svelte';

	const CONFIRMATION_MS = 2000;

	interface Props {
		/** Resolved text to copy. A relative URL should be made absolute by the caller. */
		value: string;
		label?: string;
		copiedLabel?: string;
		failedLabel?: string;
		class?: string;
	}

	let {
		value,
		label = 'Copy',
		copiedLabel = 'Copied',
		failedLabel = 'Copy failed',
		class: className = ''
	}: Props = $props();

	let state_ = $state<'idle' | 'copied' | 'failed'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => clearTimeout(timer));

	function settle(next: 'copied' | 'failed') {
		state_ = next;
		clearTimeout(timer);
		timer = setTimeout(() => (state_ = 'idle'), CONFIRMATION_MS);
	}

	async function copy() {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			settle('copied');
		} catch (error) {
			// The clipboard can be denied outright — a permissions policy, an insecure origin, a
			// browser that only allows it from a trusted gesture. Saying nothing would leave the
			// reader believing they had the citation.
			console.error('[CopyButton] Could not copy to the clipboard:', error);
			settle('failed');
		}
	}
</script>

<button
	type="button"
	class="inline-flex items-center gap-1.5 text-xs text-surface-600-400 transition-colors hover:text-surface-950-50 {className}"
	onclick={copy}
>
	<!-- Announced, not just shown: the outcome is the only feedback there is, and a reader using a
	     screen reader has no visual cue that anything happened. -->
	<span aria-live="polite" class="contents">
		{#if state_ === 'copied'}
			<Check class="size-3.5" aria-hidden="true" />
			<span>{copiedLabel}</span>
		{:else if state_ === 'failed'}
			<TriangleAlert class="size-3.5" aria-hidden="true" />
			<span>{failedLabel}</span>
		{:else}
			<Copy class="size-3.5" aria-hidden="true" />
			<span>{label}</span>
		{/if}
	</span>
</button>
