<script>
  import '../styles.css';
  import TopNav from '../components/TopNav.svelte';
  import Footer from '../components/Footer.svelte';

  import { page } from '$app/stores';

  $: path = $page.url.pathname;

</script>

<TopNav {path} />

<main id="content" class="d-grid">
  <slot></slot>
</main>

<Footer />