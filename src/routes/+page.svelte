<script lang="ts">
	import { CircleHelp, Database, Globe, Info, ListTree } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import EntryPointChooser from '$lib/components/landing/EntryPointChooser.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import { WCFP_DATASET } from '$lib/constants/dataset';
	import { formatCount } from '$lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const summary = $derived(data.summary);

	const heroMedia = {
		src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Traditional_fonio_harvest_with_a_sickle%2C_Natitingou%2C_northern_Benin.jpg/3840px-Traditional_fonio_harvest_with_a_sickle%2C_Natitingou%2C_northern_Benin.jpg',
		alt: 'Digitaria exilis (Fonio)',
		label: 'Digitaria exilis (Fonio)',
		creditLabel: 'Michael Major for Crop Trust via Wikimedia Commons',
		sourceHref:
			'https://commons.wikimedia.org/wiki/File:Traditional_fonio_harvest_with_a_sickle,_Natitingou,_northern_Benin.jpg'
	};

	const heroMediaStyle = heroMedia.src
		? `background-image: linear-gradient(180deg, rgba(2, 6, 23, 0.16) 0%, rgba(2, 6, 23, 0.64) 100%), url('${heroMedia.src}'); background-position: center; background-size: cover;`
		: '';

	const entryPoints = [
		{
			label: 'Map',
			href: '/map',
			description: 'Explore food plant diversity by geographic area.',
			eyebrow: 'From a place',
			icon: Globe
		},
		{
			label: 'Taxonomy',
			href: '/taxonomy',
			description: 'Browse taxa by taxonomic classification.',
			eyebrow: 'From a name',
			icon: ListTree
		}
	] as const;

	let showPhotoCredit = $state(false);
</script>

<svelte:head>
	<title>World Checklist of Food Plants</title>
	<meta
		name="description"
		content="Discover the World Checklist of Food Plants and choose whether to explore food plant diversity through the map or taxonomy."
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-950 text-white lg:h-screen lg:overflow-hidden">
	<main class="min-h-0 flex-1">
		<section class="relative isolate flex h-full overflow-hidden bg-slate-950">
			<div class="absolute inset-0" style={heroMediaStyle} aria-hidden="true"></div>
			<div
				class="absolute inset-0 bg-[linear-gradient(90deg,_rgba(2,6,23,0.95)_0%,_rgba(2,6,23,0.84)_30%,_rgba(2,6,23,0.52)_58%,_rgba(2,6,23,0.24)_100%)]"
				aria-hidden="true"
			></div>
			<div
				class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.20),_transparent_28%),radial-gradient(circle_at_75%_18%,_rgba(132,204,22,0.14),_transparent_22%)]"
				aria-hidden="true"
			></div>
			<div
				class="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,_rgba(2,6,23,0.6)_0%,_rgba(2,6,23,0)_100%)]"
				aria-hidden="true"
			></div>

			<div
				class="relative mx-auto flex w-full max-w-7xl flex-1 items-start px-4 pt-16 pb-8 md:px-6 md:pt-20 md:pb-8 lg:px-8 lg:pt-24 lg:pb-10 xl:px-10 xl:pt-28 xl:pb-12"
			>
				<!--
					The dataset is what the paper links here for, so it gets an affordance on the landing
					page rather than only inside About. It leaves for figshare, hence the explicit
					external target — this site never serves the archive itself.
				-->
				<div
					class="absolute top-4 right-4 z-10 flex items-center gap-2 md:top-6 md:right-6 lg:top-8 lg:right-8 xl:right-10"
				>
					<a
						href={WCFP_DATASET.url}
						target="_blank"
						rel="external noopener noreferrer"
						class="inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/36 px-3.5 py-2 text-xs font-semibold tracking-[0.18em] text-white/75 uppercase backdrop-blur-sm transition hover:bg-slate-950/48 hover:text-white"
					>
						<Database class="h-4 w-4" aria-hidden="true" />
						Data
					</a>
					<a
						href={resolve('/about')}
						data-sveltekit-preload-data="hover"
						class="inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/36 px-3.5 py-2 text-xs font-semibold tracking-[0.18em] text-white/75 uppercase backdrop-blur-sm transition hover:bg-slate-950/48 hover:text-white"
					>
						<CircleHelp class="h-4 w-4" aria-hidden="true" />
						Help
					</a>
				</div>

				<div class="w-full max-w-5xl">
					<div class="max-w-4xl">
						<h1
							class="text-4xl leading-tight font-semibold tracking-[-0.05em] text-white md:text-6xl lg:text-[clamp(3.5rem,5vw,5.4rem)] lg:whitespace-nowrap"
						>
							World Checklist of Food Plants
						</h1>

						<p class="mt-6 text-lg leading-8 text-slate-100 md:text-xl md:leading-9">
							The WCFP 2026 is the most comprehensive <b class="underline"
								>global inventory of food plant taxa</b
							>, covering <b class="underline">{formatCount(summary.taxa)} taxa</b>
							across <b class="underline">{formatCount(summary.genera)} genera</b>
							and <b class="underline">{formatCount(summary.families)} families</b>, both cultivated
							and wild.
						</p>
					</div>

					<EntryPointChooser {entryPoints} />
				</div>

				<div
					class="absolute right-4 bottom-3 z-10 md:right-6 md:bottom-5 lg:right-8 lg:bottom-6 xl:right-10"
				>
					{#if showPhotoCredit}
						<div
							class="absolute right-11 bottom-0 rounded-full border border-white/12 bg-slate-950/72 px-3 py-2 text-[11px] leading-none whitespace-nowrap text-white/80 shadow-[0_18px_48px_rgba(2,6,23,0.35)] backdrop-blur-md"
						>
							<a
								href={heroMedia.sourceHref}
								target="_blank"
								rel="external noopener noreferrer"
								class="underline decoration-white/20 underline-offset-4 transition hover:text-white"
							>
								Photo: {heroMedia.creditLabel}
							</a>
						</div>
					{/if}

					<button
						type="button"
						aria-label="Toggle photo credit"
						aria-expanded={showPhotoCredit}
						class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-slate-950/28 text-white/55 backdrop-blur-sm transition hover:bg-slate-950/40 hover:text-white/80"
						onclick={() => (showPhotoCredit = !showPhotoCredit)}
					>
						<Info class="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</section>
	</main>

	<footer class="shrink-0">
		<Footer />
	</footer>
</div>
