<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { X } from 'lucide-svelte';

	interface Props {
		open?: boolean;
		titleId: string;
		onClose: () => void;
		returnFocusTo?: HTMLElement | null;
		panelClass?: string;
		children?: Snippet;
	}

	let {
		open = false,
		titleId,
		onClose,
		returnFocusTo = null,
		panelClass = '',
		children
	}: Props = $props();

	let panelEl = $state<HTMLElement | null>(null);
	let closeButtonEl = $state<HTMLButtonElement | null>(null);
	let lastFocusedElement = $state<HTMLElement | null>(null);
	let wasOpen = false;

	function focusElement(element: HTMLElement | null | undefined) {
		if (!element) return;

		try {
			element.focus({ preventScroll: true });
		} catch {
			element.focus();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!open || event.key !== 'Escape') return;

		event.preventDefault();
		onClose();
	}

	$effect(() => {
		if (!open || typeof window === 'undefined') return;

		lastFocusedElement =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;

		const previousOverflow = document.body.style.overflow;
		const previousPaddingRight = document.body.style.paddingRight;
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

		document.body.style.overflow = 'hidden';
		if (scrollbarWidth > 0) {
			document.body.style.paddingRight = `${scrollbarWidth}px`;
		}

		queueMicrotask(() => focusElement(closeButtonEl ?? panelEl));

		return () => {
			document.body.style.overflow = previousOverflow;
			document.body.style.paddingRight = previousPaddingRight;
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			wasOpen = open;
			return;
		}

		if (!open && wasOpen) {
			const focusTarget = returnFocusTo ?? lastFocusedElement;
			queueMicrotask(() => focusElement(focusTarget));
		}

		wasOpen = open;
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<div class="fixed inset-0 z-[160]">
		<button
			type="button"
			class="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
			onclick={onClose}
			transition:fade={{ duration: 160 }}
			aria-label="Close overlay"
		></button>

		<div class="relative flex h-full w-full items-center justify-center p-4 sm:p-8">
			<div
				bind:this={panelEl}
				tabindex="-1"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				class="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[min(64rem,100%)] flex-col overflow-hidden rounded-[28px] border border-white/50 bg-white/84 shadow-[0_32px_90px_-36px_rgba(15,23,42,0.6)] backdrop-blur-xl {panelClass}"
				transition:fade={{ duration: 180 }}
			>
				<button
					bind:this={closeButtonEl}
					type="button"
					class="absolute top-4 right-4 z-10 rounded-full border border-white/50 bg-white/75 p-2 text-slate-500 transition hover:bg-white hover:text-slate-700 focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-500"
					onclick={onClose}
					aria-label="Close panel"
				>
					<X class="h-4 w-4" />
				</button>

				<div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
					{@render children?.()}
				</div>
			</div>
		</div>
	</div>
{/if}
