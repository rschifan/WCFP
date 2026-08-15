<script lang="ts">
	import SpeciesPanel from './SpeciesPanel.svelte';

	interface Props {
		regionCode: string | null;
		regionName: string | null;
	}

	const props: Props = $props();
</script>

<SpeciesPanel regionCode={props.regionCode} regionName={props.regionName} />
