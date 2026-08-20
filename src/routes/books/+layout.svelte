<script>
	import { onMount, setContext } from 'svelte';
	import BookDeliveryBar from '$lib/books/BookDeliveryBar.svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { createBookCartStore } from '$lib/books/cart-store';

	/** @type {import('./$types').LayoutData} */
	export let data;

	const isLive = data.launchState === 'live';
	const cart = createBookCartStore();
	if (isLive) setContext(BOOK_CART_CONTEXT_KEY, cart);

	async function hydrateCart() {
		try {
			await cart.hydrate();
		} catch {
			// The cart store remains at its safe empty state when browser storage is unavailable.
		}
	}

	onMount(() => {
		if (isLive) void hydrateCart();
	});
</script>

<div class="book-delivery-frame">
	{#if isLive}
		<BookDeliveryBar {cart} />
	{/if}
	<slot />
</div>

<style>
	.book-delivery-frame {
		min-width: 0;
		min-height: 100%;
	}
</style>
