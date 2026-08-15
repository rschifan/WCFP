<script lang="ts">
	import SpeciesDetailPanel from './SpeciesDetailPanel.svelte';
	import type { Species } from '$lib/types/species';

	const SAMPLE_SPECIES: Species = {
		wcfpId: 101,
		name: 'Hydrodictyon reticulatum',
		authors: '(L.) Bory',
		family: 'Hydrodictyaceae',
		genus: 'Hydrodictyon',
		lifeform: 'annual',
		uses: {
			total: 1,
			humanFood: true
		},
		referencesAll: ['Reference A']
	};

	let species = $state<Species | null>(SAMPLE_SPECIES);
	let openerEl = $state<HTMLButtonElement | null>(null);

	function openPanel() {
		species = SAMPLE_SPECIES;
	}

	function closePanel() {
		species = null;
	}
</script>

<button bind:this={openerEl} type="button" onclick={openPanel}> Open details </button>

<SpeciesDetailPanel {species} returnFocusTo={openerEl} onClose={closePanel} />
