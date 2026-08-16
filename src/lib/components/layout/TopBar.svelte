<script lang="ts">
	import { AppBar, Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { Menu, House, Globe, ListTree, Info, X } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	type NavHref = '/' | '/map' | '/taxonomy' | '/about';

	type NavItem = {
		href: NavHref;
		label: string;
		icon: typeof House;
		aliases?: readonly string[];
	};

	/**
	 * Navigation items configuration
	 * Centralized for maintainability and easy extension
	 */
	const navItems = [
		{ href: '/', label: 'Home', icon: House },
		{ href: '/map', label: 'Map', icon: Globe },
		{ href: '/taxonomy', label: 'Taxonomy', icon: ListTree, aliases: ['/taxonomy-map'] },
		{ href: '/about', label: 'About', icon: Info }
	] satisfies NavItem[];

	/**
	 * Check if current pathname matches route
	 * Function reads reactive page state, so it's automatically reactive (Svelte 5)
	 */
	function isActive(href: string, aliases?: readonly string[]): boolean {
		return page.url.pathname === href || aliases?.includes(page.url.pathname) === true;
	}

	const animBackdrop =
		'transition transition-discrete opacity-0 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100';
	const animModal =
		'transition transition-discrete opacity-0 -translate-x-full starting:data-[state=open]:opacity-0 starting:data-[state=open]:-translate-x-full data-[state=open]:opacity-100 data-[state=open]:translate-x-0';

	/**
	 * The bar is black with white text, and stays that way whatever the reader's mode. Skeleton's
	 * default `surface-100-900` follows `color-scheme`, which the portal pins to light, so left
	 * alone the bar renders as pale grey chrome. Cerberus' surface ramp is a neutral greyscale,
	 * so these tokens are literally black and white rather than a tinted approximation.
	 */
	const navLink =
		'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
	const barNavLink = { active: 'bg-surface-700', idle: 'hover:bg-surface-800' };
	const drawerNavLink = { active: 'bg-surface-200 font-semibold', idle: 'hover:bg-surface-100' };
</script>

<AppBar class="bg-surface-900 text-surface-50">
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
								{#each navItems as { href, label, icon: Icon, aliases } (href)}
									{@const active = isActive(href, aliases)}
									{@const resolvedHref = resolve(href)}
									<a
										href={resolvedHref}
										data-sveltekit-preload-data="hover"
										class="{navLink} {active ? drawerNavLink.active : drawerNavLink.idle}"
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
			{@const homeHref = resolve('/')}
			<a
				href={homeHref}
				data-sveltekit-preload-data="hover"
				class="text-2xl font-semibold transition-opacity hover:opacity-80"
			>
				<span class="md:hidden">WCFP</span>
				<span class="hidden md:inline">World Checklist of Food Plants</span>
			</a>
		</AppBar.Headline>
		<AppBar.Trail class="hidden items-center gap-1 md:flex">
			{#each navItems as { href, label, icon: Icon, aliases } (href)}
				{@const active = isActive(href, aliases)}
				{@const resolvedHref = resolve(href)}
				<a
					href={resolvedHref}
					data-sveltekit-preload-data="hover"
					class="{navLink} {active ? barNavLink.active : barNavLink.idle}"
					aria-current={active ? 'page' : undefined}
				>
					<Icon class="h-4 w-4" aria-hidden="true" />
					<span>{label}</span>
				</a>
			{/each}
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>
