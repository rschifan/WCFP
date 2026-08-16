<script lang="ts">
	import { base } from '$app/paths';

	const partnerLogos = [
		{
			src: '/logos/NYBG_Logo_Lockup_Black_RGB.png',
			alt: 'The New York Botanical Garden'
		},
		{
			src: '/logos/Gothenburg Botanic Gardens.png',
			alt: 'Gothenburg Botanic Gardens'
		},
		{
			src: '/logos/royal-botanic-gardens-kew-vector-logo-xs.png',
			alt: 'Kew Gardens'
		},
		{
			src: '/logos/logo_sigillo_orizzontale.png',
			alt: 'University of Turin'
		},
		{
			src: '/logos/croptrust.png',
			alt: 'Crop Trust'
		}
	] as const;
</script>

<footer class="border-t border-slate-200 bg-slate-100">
	<div class="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5">
		<span class="text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
			Partners
		</span>
		{#each partnerLogos as logo (logo.src)}
			<img src="{base}{logo.src}" alt={logo.alt} class="h-8 opacity-80" loading="lazy" />
		{/each}
	</div>
</footer>
