<script>
	import { onMount, setContext } from 'svelte';
	import BookDeliveryBar from '$lib/books/BookDeliveryBar.svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { createBookCartStore } from '$lib/books/cart-store';

	const cart = createBookCartStore();
	setContext(BOOK_CART_CONTEXT_KEY, cart);

	onMount(() => {
		cart.hydrate();
	});
</script>

<div class="book-delivery-frame">
	<BookDeliveryBar {cart} />
	<slot />
</div>

<style>
	.book-delivery-frame {
		min-width: 0;
		min-height: 100%;
	}
</style>
