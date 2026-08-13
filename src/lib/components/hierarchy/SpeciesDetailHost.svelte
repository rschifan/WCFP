<script lang="ts">
	import SpeciesDetailPanel from './SpeciesDetailPanel.svelte';
	import type { SpeciesDetailController } from './species-detail-state';

	interface Props {
		controller: SpeciesDetailController;
	}

	let { controller }: Props = $props();
</script>

<SpeciesDetailPanel
	species={$controller.species}
	returnFocusTo={$controller.returnFocusTo}
	onClose={() => controller.close()}
/>
