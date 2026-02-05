<script lang="ts">
	import { fade } from 'svelte/transition';
	import { spring } from 'svelte/motion';
	import type { Species, SpeciesFilters } from '$lib/types/species';
	import TaxonomyTree from './TaxonomyTree.svelte';
	import SearchFilterBar from './SearchFilterBar.svelte';
	import { formatCount } from '$lib/utils/format';
	import { CircleAlert, Inbox, ChevronDown, ArrowLeft } from 'lucide-svelte';

	interface Props {
		selectedRegion: string | null;
		species: Species[];
		allSpecies: Species[];
		filters: SpeciesFilters;
		onFilterChange: (filters: SpeciesFilters) => void;
		searchQuery: string;
		onSearchChange: (query: string) => void;
		loading: boolean;
		error: string | null;
		onClose?: () => void;
		onRetry?: () => void;
	}

	let { selectedRegion, species, allSpecies, filters, onFilterChange, searchQuery, onSearchChange, loading, error, onClose, onRetry }: Props = $props();

	let hasActiveFilters = $derived(
		filters.lifeforms.size > 0 || filters.uses.size > 0 || filters.cwr === true
	);

	type SheetPosition = 'peek' | 'half' | 'full';

	const POSITIONS: Record<SheetPosition, number> = {
		peek: 15,
		half: 50,
		full: 92
	};

	let sheetPosition = $state<SheetPosition>('half');
	let isDragging = $state(false);
	let startY = $state(0);
	let startHeight = $state(0);

	let animatedHeight = spring(POSITIONS.half, { stiffness: 0.2, damping: 0.8 });
	let isAtPeek = $derived(sheetPosition === 'peek');
	let isAtFull = $derived(sheetPosition === 'full');

	$effect(() => {
		if (!isDragging) {
			animatedHeight.set(POSITIONS[sheetPosition]);
		}
	});

	$effect(() => {
		if (selectedRegion) {
			sheetPosition = 'half';
		}
	});

	function startDrag(clientY: number) {
		isDragging = true;
		startY = clientY;
		startHeight = $animatedHeight;
	}

	function moveDrag(clientY: number) {
		if (!isDragging) return;
		const deltaPercent = ((startY - clientY) / window.innerHeight) * 100;
		const newHeight = Math.min(POSITIONS.full, Math.max(POSITIONS.peek, startHeight + deltaPercent));
		animatedHeight.set(newHeight, { hard: true });
	}

	function endDrag() {
		if (!isDragging) return;
		isDragging = false;

		const currentHeight = $animatedHeight;
		const velocity = currentHeight - startHeight;

		// Find nearest snap position
		let nearest: SheetPosition = 'half';
		let minDistance = Infinity;
		for (const [pos, height] of Object.entries(POSITIONS) as [SheetPosition, number][]) {
			const distance = Math.abs(currentHeight - height);
			if (distance < minDistance) {
				minDistance = distance;
				nearest = pos;
			}
		}

		// Velocity-based override for quick swipes
		if (Math.abs(velocity) > 10) {
			if (velocity > 0 && sheetPosition !== 'full') {
				nearest = sheetPosition === 'peek' ? 'half' : 'full';
			} else if (velocity < 0 && sheetPosition !== 'peek') {
				nearest = sheetPosition === 'full' ? 'half' : 'peek';
			}
		}

		sheetPosition = nearest;
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches[0]) startDrag(e.touches[0].clientY);
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches[0]) moveDrag(e.touches[0].clientY);
	}

	function handleMouseDown(e: MouseEvent) {
		startDrag(e.clientY);
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		moveDrag(e.clientY);
	}

	function handleMouseUp() {
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		endDrag();
	}
</script>

{#snippet loadingState()}
	<div class="flex h-48 items-center justify-center" transition:fade={{ duration: 200 }}>
		<div class="flex flex-col items-center gap-3">
			<div class="relative">
				<div class="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-sky-500"></div>
				<div class="absolute inset-0 h-10 w-10 animate-ping rounded-full border-3 border-sky-500 opacity-20"></div>
			</div>
			<p class="text-sm font-medium text-slate-600">Loading species data...</p>
		</div>
	</div>
{/snippet}

{#snippet errorState()}
	<div class="flex h-48 items-center justify-center px-6" transition:fade={{ duration: 200 }}>
		<div class="rounded-xl bg-red-50 p-6 text-center shadow-sm">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
				<CircleAlert class="h-6 w-6 text-red-500" />
			</div>
			<p class="mt-4 font-semibold text-red-800">Failed to load species</p>
			<p class="mt-2 text-sm text-red-600">{error}</p>
			{#if onRetry}
				<button
					type="button"
					onclick={onRetry}
					class="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
				>
					Try again
				</button>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet emptyState()}
	<div class="flex h-48 items-center justify-center px-6 text-center" transition:fade={{ duration: 200 }}>
		<div>
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
				<Inbox class="h-8 w-8 text-slate-400" strokeWidth={1.5} />
			</div>
			{#if hasActiveFilters}
				<p class="mt-4 font-semibold text-slate-700">No matching species</p>
				<p class="mt-2 text-sm text-slate-500">Try adjusting your filters</p>
				<button
					type="button"
					onclick={() => onFilterChange({ lifeforms: new Set(), cwr: null, uses: new Set() })}
					class="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
				>
					Clear filters
				</button>
			{:else}
				<p class="mt-4 font-semibold text-slate-700">No species data</p>
				<p class="mt-2 text-sm text-slate-500">No species found for this region</p>
			{/if}
		</div>
	</div>
{/snippet}

{#if selectedRegion}
	{#if !isAtPeek}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
			onclick={onClose}
			transition:fade={{ duration: 200 }}
			aria-label="Close panel"
		></button>
	{/if}

	<div
		class="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl"
		style:height="{$animatedHeight}vh"
		style:max-height="92vh"
	>
		<div
			class="flex shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={endDrag}
			onmousedown={handleMouseDown}
			role="slider"
			aria-label="Drag to resize"
			aria-valuenow={$animatedHeight}
			tabindex="0"
		>
			<div class="h-1 w-10 rounded-full bg-slate-300"></div>
		</div>

		<!-- Integrated header + search/filter block -->
		<div class="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
			<div class="px-4 pt-1 pb-3">
				{#if isAtFull}
					<button
						type="button"
						onclick={() => (sheetPosition = 'half')}
						class="mb-2 flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"
					>
						<ArrowLeft class="h-4 w-4" />
						<span>Back to Map</span>
					</button>
				{/if}

				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<h2 class="truncate text-lg font-semibold text-slate-900">{selectedRegion}</h2>
						{#if !loading && !error}
							<p class="text-sm text-slate-600">
								{#if species.length !== allSpecies.length}
									<span class="font-medium text-sky-600">{formatCount(species.length)}</span> of {formatCount(allSpecies.length)} species
								{:else}
									{formatCount(species.length)} species found
								{/if}
							</p>
						{/if}
					</div>

					{#if isAtPeek}
						<button
							type="button"
							onclick={() => (sheetPosition = 'full')}
							class="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
						>
							<ChevronDown class="h-4 w-4 rotate-180" />
							<span>View</span>
						</button>
					{/if}
				</div>
			</div>

			{#if !loading && !error && allSpecies.length > 0}
				<SearchFilterBar
					{filters}
					species={allSpecies}
					{onFilterChange}
					{searchQuery}
					{onSearchChange}
					integrated={true}
				/>
			{/if}
		</div>

		<div class="flex-1 overflow-y-auto overscroll-contain">
			{#if loading}
				{@render loadingState()}
			{:else if error}
				{@render errorState()}
			{:else if species.length === 0}
				{@render emptyState()}
			{:else}
				<TaxonomyTree {species} {searchQuery} />
			{/if}
		</div>
	</div>
{/if}
