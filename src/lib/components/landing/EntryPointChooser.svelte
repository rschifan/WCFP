<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import { resolve } from '$app/paths';

	type EntryPointIcon = typeof import('lucide-svelte').Search;
	type EntryPointHref = '/' | '/map' | '/taxonomy' | '/about';

	interface EntryPoint {
		label: string;
		href: EntryPointHref;
		description: string;
		eyebrow: string;
		icon: EntryPointIcon;
	}

	let { entryPoints }: { entryPoints: readonly EntryPoint[] } = $props();
</script>

<div
	class="mt-6 w-full max-w-[39rem] overflow-hidden rounded-[1.45rem] border border-white/12 bg-slate-950/34 p-5 shadow-[0_22px_72px_rgba(2,6,23,0.24)] backdrop-blur-md"
>
	<div class="px-4 pt-3 pb-2.5 md:px-5">
		<p class="text-[13px] font-semibold tracking-[0.22em] text-white/65 uppercase">
			Where would you like to start?
		</p>
	</div>

	<div class="grid border-t border-white/10 md:grid-cols-2">
		{#each entryPoints as entry, index (entry.label)}
			{@const Icon = entry.icon}
			{@const resolvedHref = resolve(entry.href)}
			<a
				href={resolvedHref}
				aria-label={`Start with ${entry.label}`}
				data-sveltekit-preload-data="hover"
				class="group relative px-4 py-3 transition duration-300 hover:bg-white/8 md:px-5 md:py-4 {index ===
				0
					? 'md:border-r md:border-white/10'
					: ''}"
			>
				<div class="flex items-center justify-between gap-2.5">
					<div class="flex min-w-0 items-center gap-2.5">
						<div
							class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/90 ring-1 ring-white/10"
						>
							<Icon class="h-8 w-8" />
						</div>
						<p class="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
							{entry.eyebrow}
						</p>
					</div>
					<ArrowRight
						class="h-4.5 w-4.5 shrink-0 text-white/40 transition group-hover:translate-x-1 group-hover:text-white/90"
					/>
				</div>

				<h2 class="mt-2.5 text-lg font-semibold tracking-tight text-white md:text-xl">
					{entry.label}
				</h2>
				<p class="mt-1.5 max-w-sm text-sm leading-5.5 text-slate-200 md:text-[15px]">
					{entry.description}
				</p>
			</a>
		{/each}
	</div>
</div>
