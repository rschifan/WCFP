<script lang="ts">
	import SpeciesPanel from './SpeciesPanel.svelte';

	interface Props {
		selectedRegion: string | null;
		isMobile: boolean;
	}

	const props: Props = $props();
</script>

<SpeciesPanel selectedRegion={props.selectedRegion} isMobile={props.isMobile} />
