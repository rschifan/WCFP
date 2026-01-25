<script lang="ts">
	import { useSpeciesProvider } from '$lib/services/species';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Species } from '$lib/types/species';
	import TaxonomyTree from './TaxonomyTree.svelte';
	import { formatCount } from '$lib/utils/format';
	import { X, CircleAlert, Inbox } from 'lucide-svelte';

	interface Props {
		selectedRegion: string | null;
		onClose?: () => void;
	}

	let { selectedRegion, onClose }: Props = $props();

	const provider = useSpeciesProvider();

	let species = $state<Species[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Fetch species data for a region
	function fetchSpecies(region: string) {
		loading = true;
		error = null;

		provider
			.getSpeciesByRegion(region)
			.then((data) => {
				species = data;
				loading = false;
			})
			.catch((err) => {
				error = err instanceof Error ? err.message : 'Failed to load species data';
				loading = false;
				console.error('[SpeciesPanel] Load error:', err);
			});
	}

	// Auto-fetch when region changes
	$effect(() => {
		if (!selectedRegion?.trim()) {
			species = [];
			error = null;
			loading = false;
			return;
		}

		// Check cache first (synchronous, no loading state)
		const cached = provider.getCachedData(selectedRegion);
		if (cached) {
			species = cached;
			loading = false;
			error = null;
			return;
		}

		fetchSpecies(selectedRegion);
	});
</script>

{#if selectedRegion}
	<!-- Backdrop for mobile -->
	<button
		class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm sm:hidden"
		onclick={onClose}
		transition:fade={{ duration: 200 }}
		aria-label="Close panel"
		type="button"
	></button>

	<!-- Panel -->
	<div
		class="fixed right-0 top-0 z-50 flex h-screen w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[420px]"
		transition:fly={{ x: 420, duration: 300, easing: cubicOut }}
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4"
		>
			<div class="flex-1">
				<h2 class="text-lg font-semibold text-slate-900">{selectedRegion}</h2>
				{#if !loading && !error}
					<p class="text-sm text-slate-600" transition:fade={{ duration: 150 }}>
						{formatCount(species.length)} species found
					</p>
				{/if}
			</div>

			{#if onClose}
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-2 text-slate-400 transition-all duration-150 hover:bg-slate-200 hover:text-slate-600 hover:rotate-90"
					aria-label="Close panel"
				>
					<X class="h-5 w-5" />
				</button>
			{/if}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			{#if loading}
				<!-- Loading State -->
				<div class="flex h-64 items-center justify-center" transition:fade={{ duration: 200 }}>
					<div class="flex flex-col items-center gap-3">
						<div class="relative">
							<div
								class="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-sky-500"
							></div>
							<div
								class="absolute inset-0 h-10 w-10 animate-ping rounded-full border-3 border-sky-500 opacity-20"
							></div>
						</div>
						<p class="text-sm font-medium text-slate-600">Loading species data...</p>
					</div>
				</div>
			{:else if error}
				<!-- Error State -->
				<div
					class="flex h-64 items-center justify-center px-6"
					transition:fade={{ duration: 200 }}
				>
					<div class="rounded-xl bg-red-50 p-6 text-center shadow-sm">
						<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
							<CircleAlert class="h-6 w-6 text-red-500" />
						</div>
						<p class="mt-4 font-semibold text-red-800">Failed to load species</p>
						<p class="mt-2 text-sm text-red-600">{error}</p>
						<button
							type="button"
							onclick={() => {
								if (selectedRegion) fetchSpecies(selectedRegion);
							}}
							class="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
						>
							Try again
						</button>
					</div>
				</div>
			{:else if species.length === 0}
				<!-- Empty State -->
				<div
					class="flex h-64 items-center justify-center px-6 text-center"
					transition:fade={{ duration: 200 }}
				>
					<div>
						<div
							class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100"
						>
							<Inbox class="h-8 w-8 text-slate-400" strokeWidth={1.5} />
						</div>
						<p class="mt-4 font-semibold text-slate-700">No species data</p>
						<p class="mt-2 text-sm text-slate-500">No species found for this region</p>
					</div>
				</div>
			{:else}
				<TaxonomyTree {species} />
			{/if}
		</div>
	</div>
{/if}
