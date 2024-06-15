<script>
	import { resources } from '$lib/content';
	import ResourceCard from '$lib/components/ResourceCard.svelte';
	import CardRow from '$lib/components/CardRow.svelte';
	import CustomBtn from '$lib/components/buttons/CustomBtn.svelte';
	import SeeAlso from '$lib/components/SeeAlso.svelte';

	const { metaTitle, metaDesc, title, intro, recResources, ctaTitle, ctaBtns, seeAlsoLinks } =
		resources;
</script>

<svelte:head>
	<meta name="description" content={metaDesc} />
	<title>{metaTitle}</title>
</svelte:head>

<div class="resources">
	<div class="px-5 pt-5 pb-3">
		<h2 class="heading">{title}</h2>
		<p class="text-body">{intro}</p>
	</div>

	<CardRow bg="" topSpacing={false}>
		{#each Object.entries(recResources) as [category, links]}
			<ResourceCard {category} {links} />
		{/each}
	</CardRow>
</div>

<div class="button-links px-5 pb-5 border-bottom border-white border-2">
	<h3 class="fw-bold text-black mb-4">{ctaTitle}</h3>
	<div class="button-group d-grid align-items-center gap-3 gap-xl-4 gap-xxl-5">
		{#each Object.entries(ctaBtns) as [text, url]}
			<CustomBtn btnStyle="secondary" expand link={url}>{text}</CustomBtn>
		{/each}
	</div>
</div>

<SeeAlso bg="light-gray" {seeAlsoLinks} topSpacing />

<style>
	.resources {
		background: linear-gradient(180deg, #fff 60%, #99c2ff 0%);
	}

	@media screen and (min-width: 768px) {
		.resources {
			background: linear-gradient(180deg, #fff 45%, #99c2ff 0%);
		}
	}

	@media screen and (min-width: 1200px) {
		.resources {
			background: linear-gradient(180deg, #fff 70%, #99c2ff 0%);
		}
	}

	.button-links {
		background-color: #99c2ff;
	}

	@media screen and (min-width: 1200px) {
		.button-group {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
