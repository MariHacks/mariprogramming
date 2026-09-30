<script>
	// PBL 2 reuses the shared team studio. It reads which workshop it serves from the URL.
	import Studio from '../../science/[code]/+page.svelte';

	/** @type {any} */
	export let data = { collabUser: null };
</script>

<Studio {data} />
