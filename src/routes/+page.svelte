<svelte:head>
  <meta name="description" content="Welcome to the Marianopolis Programming Club!">
  <title>Marianopolis Programming Club</title>
</svelte:head>

<script>
  import Card from "../components/Card.svelte";
</script>

<a href="/about-us" class="text-decoration-none"><Card title="About the Programming Club" desc="Learn more about the club" arrow list='' subtitle='' links='' /></a>
<a href="/our-workshops" class="text-decoration-none"><Card title="Workshop archive" desc="Past workshop material" arrow list='' subtitle='' links='' /></a>
<a href="/roadmap" class="text-decoration-none"><Card title="Club roadmap" desc="See the club roadmap" arrow list='' subtitle='' links='' /></a>
<Card title="Club roadmap" subtitle="Subtitle" desc="See the club roadmap" list={['item', 'item 2']} links={{'https://github.com/': 'Slides', 'https://github.com/MariHacks': 'Colab', '/': 'GitHub'}} />

<style>

</style>