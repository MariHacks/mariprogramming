<script>
	export let events;
	import { Splide, SplideSlide } from '@splidejs/svelte-splide';
	import '@splidejs/svelte-splide/css';
	import Event from '$lib/components/events/Event.svelte';
</script>

<!-- carousel is buggy on screens < 340px so destroy and use regular scrolling column of events -->
<Splide
	class="overflow-x-hidden mx-auto mobile-hidden-carousel"
	aria-label="Upcoming Programming Club events"
	options={{
		perPage: 1,
		mediaQuery: 'min',
		breakpoints: {
			340: { width: '100%', destroy: false },
			992: { perPage: 2, padding: 20 },
			1200: { perPage: 3, padding: 30 }
		},
		pagination: false,
		perMove: 1,
		padding: 5
	}}
>
	{#each Object.entries(events) as [name, info]}
		<SplideSlide><Event {name} date={info.date} desc={info.desc} /></SplideSlide>
	{/each}
</Splide>

<!-- regular column of events when < 340px -->
<div class="event-carousel flex-column gap-4">
	{#each Object.entries(events) as [name, info]}
		<Event {name} date={info.date} desc={info.desc} />
	{/each}
</div>

<style>
	.event-carousel {
		display: flex;
	}

	@media screen and (min-width: 340px) {
		.event-carousel {
			display: none;
		}
	}
</style>
