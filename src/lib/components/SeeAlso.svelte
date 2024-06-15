<script>
	export let bg, seeAlsoLinks, topSpacing;
	import Card from '$lib/components/Card.svelte';
	import CardRow from '$lib/components/CardRow.svelte';
</script>

<CardRow {bg} {topSpacing}>
	{#each Object.entries(seeAlsoLinks) as [title, info]}
		<a href={info.url} class="text-decoration-none link-card-wrap"
			><Card {title} desc={info.text} arrow list="" subtitle="" links="" /></a
		>
	{/each}
</CardRow>
