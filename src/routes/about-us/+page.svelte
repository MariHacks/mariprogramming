<script>
	import { aboutUs } from '$lib/content';
	import SeeAlso from '$lib/components/SeeAlso.svelte';

	// const seeAlsoLinks = {
	// 	'Exec applications are open!': [
	// 		'https://forms.gle/pjxRBgioWrTS6Wc9A',
	// 		'Apply by May 3, 10:00 pm EST!'
	// 	],
	// 	'Club roadmap': ['/roadmap', 'See the club roadmap']
	// };

	const {
		metaTitle,
		metaDesc,
		title,
		intro,
		introImg,
		whatWeOfferTitle,
		whatWeOffer,
		seeAlsoLinks
	} = aboutUs;
</script>

<svelte:head>
	<meta name="description" content={metaDesc} />
	<title>{metaTitle}</title>
</svelte:head>

<div class="reg-container">
	<h2 class="text-black heading">{title}</h2>
	<p class="text-black text-body">
		{intro}
	</p>

	<div
		class="text-black about-us pt-3 d-flex flex-column flex-lg-row gap-4 gap-lg-5 align-items-start"
	>
		<img class="desc-img" src={introImg.src} alt={introImg.alt} />
		<div class="desc text-black">
			<p>{whatWeOfferTitle}</p>
			<ul class="d-flex flex-column">
				{#each whatWeOffer as item}
					<li>{item}</li>
				{/each}
			</ul>
		</div>
	</div>
</div>

<SeeAlso bg="light-gray" {seeAlsoLinks} topSpacing />

<style>
	.desc {
		font-size: 1.25rem;
	}

	.desc p {
		margin-bottom: 1.25rem;
	}

	.desc ul {
		gap: 0.75rem;
	}

	.desc-img {
		width: 100%;
	}

	@media screen and (min-width: 992px) {
		.desc-img {
			width: 50%;
		}
	}

	@media screen and (min-width: 1200px) {
		.desc-img {
			width: 40%;
		}
	}

	@media screen and (min-width: 1440px) {
		.desc-img {
			width: 35%;
		}
	}
</style>
