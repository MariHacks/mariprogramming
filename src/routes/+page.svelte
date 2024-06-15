<script>
	import { home } from '$lib/content';
	import CustomBtn from '$lib/components/buttons/CustomBtn.svelte';
	import EventCarousel from '$lib/components/events/EventCarousel.svelte';
	import SeeAlso from '$lib/components/SeeAlso.svelte';

	const { metaTitle, metaDesc, seeAlsoLinks, heroText, cta, eventsTitle, events } = home;
</script>

<svelte:head>
	<meta name="description" content={metaDesc} />
	<title>{metaTitle}</title>
</svelte:head>

<SeeAlso bg="light-blue" {seeAlsoLinks} topSpacing />

<div class="join-hero d-flex flex-column reg-container row-gap-3 align-items-center">
	<h3 class="text-center text-black">
		{heroText}
	</h3>
	<CustomBtn btnStyle="primary" expand={true} link={cta.url || '/'} disabled={!cta.url}
		>{cta.text}</CustomBtn
	>
</div>

<div class="events-hero px-sm-1 py-5 overflow-x-hidden relative">
	<h3 class="text-center fw-bold mb-4 text-black">{eventsTitle}</h3>
	<EventCarousel {events} />
</div>

<style>
	.events-hero {
		background-color: #ddd;
	}
</style>
