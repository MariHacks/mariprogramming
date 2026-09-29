<script>
	// PBL 2 reuses the shared join page. It reads which workshop it serves from the URL.
	import JoinPage from '../science/+page.svelte';

	/** @type {{ signedIn?: boolean, email?: string | null }} */
	export let data;
</script>

<JoinPage {data} />
