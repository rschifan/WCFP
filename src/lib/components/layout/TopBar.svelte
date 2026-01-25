<script lang="ts">
	import { AppBar, Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { Menu, Globe, ListTree, Info, X } from 'lucide-svelte';
	import { page } from '$app/state';

	/**
	 * Navigation items configuration
	 * Centralized for maintainability and easy extension
	 */
	const navItems = [
		{ href: '/', label: 'Map', icon: Globe },
		{ href: '/taxonomy-map', label: 'Taxonomy', icon: ListTree },
		{ href: '/about', label: 'About', icon: Info }
	] as const;

	/**
	 * Check if current pathname matches route
	 * Function reads reactive page state, so it's automatically reactive (Svelte 5)
	 */
	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}

	const animBackdrop =
		'transition transition-discrete opacity-0 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100';
	const animModal =
		'transition transition-discrete opacity-0 -translate-x-full starting:data-[state=open]:opacity-0 starting:data-[state=open]:-translate-x-full data-[state=open]:opacity-100 data-[state=open]:translate-x-0';
</script>

<AppBar>
	<AppBar.Toolbar class="grid-cols-[auto_1fr_auto]">
		<AppBar.Lead>
			<Dialog>
				<Dialog.Trigger class="btn-icon btn-icon-lg hover:preset-tonal md:hidden" aria-label="Menu">
					<Menu class="size-6" />
				</Dialog.Trigger>
				<Portal>
					<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 {animBackdrop}" />
					<Dialog.Positioner class="fixed inset-0 z-50 flex justify-start">
						<Dialog.Content
							class="h-screen w-sm space-y-4 card bg-surface-100-900 p-4 shadow-xl {animModal}"
						>
							<header class="flex items-center justify-between">
								<Dialog.Title class="text-2xl font-bold">Menu</Dialog.Title>
								<Dialog.CloseTrigger class="btn-icon preset-tonal">
									<X class="h-4 w-4" />
								</Dialog.CloseTrigger>
							</header>
							<nav aria-label="Mobile navigation" class="flex flex-col gap-2">
								{#each navItems as { href, label, icon: Icon } (href)}
									{@const active = isActive(href)}
									<a
										{href}
										data-sveltekit-preload-data="hover"
										class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
											{active
											? 'bg-surface-active-token text-[#80cbc4]'
											: 'text-on-surface-token hover:bg-surface-hover-token'}"
										aria-current={active ? 'page' : undefined}
									>
										<Icon class="h-4 w-4" aria-hidden="true" />
										<span>{label}</span>
									</a>
								{/each}
							</nav>
						</Dialog.Content>
					</Dialog.Positioner>
				</Portal>
			</Dialog>
		</AppBar.Lead>
		<AppBar.Headline>
			<a
				href="/"
				data-sveltekit-preload-data="hover"
				class="text-2xl font-semibold transition-opacity hover:opacity-80"
			>
				<span class="md:hidden">WCFP</span>
				<span class="hidden md:inline">World Checklist of Food Plants</span>
			</a>
		</AppBar.Headline>
		<AppBar.Trail class="hidden items-center gap-1 md:flex">
			{#each navItems as { href, label, icon: Icon } (href)}
				{@const active = isActive(href)}
				<a
					{href}
					data-sveltekit-preload-data="hover"
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
						{active
						? 'bg-surface-active-token text-[#80cbc4]'
						: 'text-on-surface-token hover:bg-surface-hover-token'}"
					aria-current={active ? 'page' : undefined}
				>
					<Icon class="h-4 w-4" aria-hidden="true" />
					<span>{label}</span>
				</a>
			{/each}
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>
