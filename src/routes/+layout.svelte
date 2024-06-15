<script>
	import '../styles.css';
	import TopNav from '$lib/components/TopNav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	import { page } from '$app/stores';

	$: path = $page.url.pathname;
</script>

<TopNav {path} />

<main id="content" class="d-grid">
	<slot></slot>
</main>

<Footer />
