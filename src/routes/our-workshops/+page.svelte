<script>
	import { ourWorkshops } from '$lib/content';
	import CardRow from '$lib/components/CardRow.svelte';
	import Card from '$lib/components/Card.svelte';
	import SeeAlso from '$lib/components/SeeAlso.svelte';

	const { metaTitle, metaDesc, title, intro, workshops, seeAlsoLinks } = ourWorkshops;
</script>

<svelte:head>
	<meta name="description" content={metaDesc} />
	<title>{metaTitle}</title>
</svelte:head>

<div class="pt-5 px-5 pb-3">
	<h2 class="heading">{title}</h2>
	<p class="text-body">{intro}</p>
</div>

<CardRow topSpacing={false}>
	{#each Object.entries(workshops) as [workshop, info]}
		<Card
			title={workshop}
			subtitle={info.series}
			desc={info.desc}
			list=""
			links={info.links}
			arrow=""
		/>
	{/each}
</CardRow>

<SeeAlso bg="light-gray" topSpacing {seeAlsoLinks} />
