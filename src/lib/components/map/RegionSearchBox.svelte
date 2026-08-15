<script lang="ts">
	import { onMount } from 'svelte';
	import { fromStore } from 'svelte/store';
	import { Search, X, MapPin } from 'lucide-svelte';
	import { loadRegionSearchData, regionSearchDataStore } from '$lib/stores/region-search-data';
	import { regionGeometryStore } from '$lib/stores/region-geometry';

	interface Props {
		onSelectRegion: (code: string) => void;
		onPreviewRegion?: (code: string | null) => void;
	}

	let { onSelectRegion, onPreviewRegion }: Props = $props();

	const searchState = fromStore(regionSearchDataStore);
	const geometryState = fromStore(regionGeometryStore);

	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let query = $state('');
	let debounced = $state('');
	let open = $state(false);
	let activeIndex = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const listboxId = 'region-search-listbox';
	const optionId = (code: string) => `region-search-option-${code}`;

	onMount(() => {
		loadRegionSearchData();
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			onPreviewRegion?.(null);
		};
	});

	$effect(() => {
		if (!onPreviewRegion) return;
		if (open && results.length > 0 && activeIndex >= 0 && activeIndex < results.length) {
			onPreviewRegion(results[activeIndex].code);
		} else {
			onPreviewRegion(null);
		}
	});

	// Keep the active row visible when navigating with the keyboard.
	$effect(() => {
		if (!open || !listEl || results.length === 0) return;
		const items = listEl.querySelectorAll<HTMLElement>('[role="option"]');
		items[activeIndex]?.scrollIntoView({ block: 'nearest' });
	});

	const MAX_RESULTS = 30;

	type Result = {
		code: string;
		name: string;
		score: number;
		/** Country names that caused the match (empty when matched by region name/code). */
		via: string[];
	};

	function normalize(s: string): string {
		return s
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.trim();
	}

	function regionName(code: string): string {
		const feature = geometryState.current.featuresByCode.get(code);
		const props = feature?.properties;
		return (props?.LEVEL3_NAM as string) ?? (props?.area as string) ?? code;
	}

	/**
	 * TDWG3 code → country names that contain it. The payload already stores names, since the
	 * paper assigns no ISO code to areas spanning more than one country.
	 */
	const countriesByRegion = $derived.by<Map<string, string[]>>(() => {
		const data = searchState.current.data;
		if (!data) return new Map();
		return new Map(Object.entries(data.regionCountries));
	});

	const regionCodes = $derived.by<string[]>(() => {
		return [...geometryState.current.featuresByCode.keys()];
	});

	const results = $derived.by<Result[]>(() => {
		const q = normalize(debounced);
		if (!q) return [];

		const hits = new Map<string, Result>();
		const upsert = (code: string, score: number, via: string[] = []) => {
			const existing = hits.get(code);
			if (!existing) {
				hits.set(code, { code, name: regionName(code), score, via });
			} else if (score < existing.score) {
				existing.score = score;
				if (via.length > 0) existing.via = via;
			} else if (via.length > 0 && existing.via.length === 0) {
				existing.via = via;
			}
		};

		// 1. Direct match on region name / code.
		for (const code of regionCodes) {
			const name = normalize(regionName(code));
			const nCode = normalize(code);
			if (nCode === q) upsert(code, 0);
			else if (name === q) upsert(code, 1);
			else if (name.startsWith(q)) upsert(code, 2);
			else if (nCode.startsWith(q)) upsert(code, 3);
			else if (name.includes(q)) upsert(code, 4);
		}

		// 2. Match via country name — surfaces TDWG3s belonging to a matching country.
		const data = searchState.current.data;
		if (data) {
			for (const country of data.countries) {
				const name = normalize(country.name);
				const iso = normalize(country.iso);
				let countryScore = -1;
				if (iso && iso === q) countryScore = 5;
				else if (name === q) countryScore = 5;
				else if (name.startsWith(q)) countryScore = 6;
				else if (name.includes(q)) countryScore = 7;
				if (countryScore < 0) continue;
				for (const code of country.regions) {
					upsert(code, countryScore, [country.name]);
				}
			}
		}

		return [...hits.values()]
			.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
			.slice(0, MAX_RESULTS);
	});

	// Declared after `results` so TypeScript can see the declaration. Svelte 5 deriveds are
	// lazy, so the original placement worked at runtime, but svelte-check (and therefore CI)
	// rejected it as use-before-declaration.
	const activeDescendantId = $derived(
		open && results.length > 0 && activeIndex < results.length
			? optionId(results[activeIndex].code)
			: undefined
	);

	function onInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		open = true;
		activeIndex = 0;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounced = query;
		}, 120);
	}

	function clearInput() {
		query = '';
		debounced = '';
		open = false;
		activeIndex = 0;
		inputEl?.focus();
	}

	function selectResult(result: Result) {
		onSelectRegion(result.code);
		query = result.name;
		debounced = '';
		open = false;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!open || results.length === 0) {
			if (event.key === 'Escape') clearInput();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % results.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + results.length) % results.length;
		} else if (event.key === 'PageDown') {
			event.preventDefault();
			activeIndex = Math.min(results.length - 1, activeIndex + 5);
		} else if (event.key === 'PageUp') {
			event.preventDefault();
			activeIndex = Math.max(0, activeIndex - 5);
		} else if (event.key === 'Home') {
			event.preventDefault();
			activeIndex = 0;
		} else if (event.key === 'End') {
			event.preventDefault();
			activeIndex = results.length - 1;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const r = results[activeIndex];
			if (r) selectResult(r);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		}
	}

	function onFocus() {
		if (debounced) open = true;
	}

	function onBlur() {
		// Delay so click on a result registers first.
		setTimeout(() => {
			open = false;
		}, 150);
	}

	function contextLabel(result: Result): string | null {
		if (result.via.length === 0) {
			const regionCountries = countriesByRegion.get(result.code) ?? [];
			// Only annotate if the match was direct AND spans multiple countries, to disambiguate.
			if (regionCountries.length > 1) return regionCountries.join(', ');
			return null;
		}
		return result.via.join(', ');
	}
</script>

<div class="pointer-events-auto relative w-72 sm:w-80">
	<div class="relative">
		<Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
		<input
			bind:this={inputEl}
			type="text"
			value={query}
			oninput={onInput}
			onfocus={onFocus}
			onblur={onBlur}
			onkeydown={onKeyDown}
			placeholder="Search region or country..."
			role="combobox"
			aria-label="Search geographic area"
			aria-autocomplete="list"
			aria-expanded={open && results.length > 0}
			aria-controls={listboxId}
			aria-activedescendant={activeDescendantId}
			class="w-full rounded-md border border-slate-200 bg-white py-2 pr-9 pl-10 text-sm text-slate-900 shadow-lg shadow-slate-900/10 outline-none placeholder:text-slate-400 focus:border-slate-400"
		/>
		{#if query}
			<button
				type="button"
				onclick={clearInput}
				class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
				aria-label="Clear search"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>

	{#if open && results.length > 0}
		<ul
			bind:this={listEl}
			id={listboxId}
			role="listbox"
			class="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/15"
		>
			{#each results as result, idx (result.code)}
				{@const context = contextLabel(result)}
				<li id={optionId(result.code)} role="option" aria-selected={idx === activeIndex}>
					<button
						type="button"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => selectResult(result)}
						onmouseenter={() => (activeIndex = idx)}
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 {idx ===
						activeIndex
							? 'bg-slate-100'
							: ''}"
					>
						<MapPin class="h-4 w-4 shrink-0 text-slate-400" />
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-slate-900">{result.name}</span>
							{#if context}
								<span class="truncate text-xs text-slate-500">{context}</span>
							{/if}
						</span>
						<span
							class="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-slate-600"
						>
							{result.code}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if open && debounced && results.length === 0 && searchState.current.status === 'ready'}
		<div
			class="absolute top-full right-0 left-0 z-30 mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-xl"
		>
			No matches for "{debounced}"
		</div>
	{/if}
</div>
