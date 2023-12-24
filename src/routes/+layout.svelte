<script>
  import '../styles.css';
  import TopNav from '../components/TopNav.svelte';
  import Footer from '../components/Footer.svelte';

  import { page } from '$app/stores';

  $: path = $page.url.pathname;

</script>

<TopNav {path} />

<main id="content">
  <slot></slot>
</main>

<Footer />