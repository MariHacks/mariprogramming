<script>
  export let bg, seeAlsoLinks, topSpacing;
  import Card from "./Card.svelte";
  import CardRow from "./CardRow.svelte";
</script>

<CardRow {bg} {topSpacing}>
  {#each Object.entries(seeAlsoLinks) as [title, [link, desc]]}
  <a href={link} class="text-decoration-none link-card-wrap"><Card {title} {desc} arrow list='' subtitle='' links='' /></a>
  {/each}
</CardRow>