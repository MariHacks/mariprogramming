<script>
	/**
	 * @typedef {{ bookId: string, quantity: number }} CartItem
	 * @typedef {{ items: CartItem[] }} Cart
	 */

	/** @type {import('svelte/store').Readable<Cart>} */
	export let cart;

	$: itemCount = $cart.items.reduce((total, item) => total + item.quantity, 0);
	$: cartLabel = `Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
</script>

<nav class="book-delivery-bar" aria-label="Book Delivery navigation">
	<div class="bar-frame">
		<a class="service-link" href="/books">
			<span class="service-index" aria-hidden="true"></span>
			<span>Book Delivery</span>
		</a>

		<a class="cart-link" href="/books/cart" aria-label={cartLabel}>
			<span aria-hidden="true">Cart</span>
			<span class="cart-count" aria-hidden="true">{itemCount}</span>
		</a>
	</div>
</nav>

<style>
	.book-delivery-bar {
		border-block-end: 1px solid rgb(5 13 46 / 32%);
		background: var(--paper);
		box-shadow: inset 0 0.25rem 0 var(--sky);
		color: var(--midnight);
	}

	.bar-frame {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		max-width: calc(var(--layout-width) + var(--page-gutter) + var(--page-gutter));
		min-height: 3.75rem;
		margin-inline: auto;
		padding: 0.55rem var(--page-gutter) 0.45rem;
		gap: var(--space-sm);
	}

	.service-link,
	.cart-link {
		display: inline-flex;
		align-items: center;
		min-height: 2.5rem;
		color: var(--midnight);
		font-weight: 600;
		line-height: 1.2;
		text-decoration: none;
		transition: color var(--motion-fast) var(--ease-out);
	}

	.service-link {
		min-width: 0;
		gap: var(--space-xs);
		font-family: var(--font-display);
		letter-spacing: -0.025em;
	}

	.service-index {
		width: 0.9rem;
		height: 1.25rem;
		flex: 0 0 auto;
		border: 1px solid var(--midnight);
		background: var(--sky);
		box-shadow: inset -0.22rem 0 0 rgb(5 13 46 / 18%);
	}

	.cart-link {
		justify-content: flex-end;
		gap: var(--space-2xs);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.cart-count {
		display: grid;
		place-items: center;
		min-width: 2rem;
		height: 2rem;
		padding-inline: 0.4rem;
		border: 1px solid var(--midnight);
		border-radius: var(--radius-pill);
		background: var(--midnight);
		color: var(--paper);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.service-link:hover,
	.cart-link:hover {
		color: var(--club-blue);
	}

	.cart-link:hover .cart-count {
		background: var(--sky);
		color: var(--midnight);
	}

	.service-link:focus-visible,
	.cart-link:focus-visible {
		border-radius: var(--radius-xs);
		outline: 3px solid var(--color-focus);
		outline-offset: 3px;
	}

	@media (max-width: 22rem) {
		.bar-frame {
			padding-inline: var(--space-sm);
			gap: var(--space-xs);
		}

		.service-link {
			font-size: var(--text-sm);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.service-link,
		.cart-link,
		.cart-count {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.book-delivery-bar,
		.service-index,
		.cart-count {
			border-color: CanvasText;
		}

		.book-delivery-bar {
			box-shadow: inset 0 0.25rem 0 Highlight;
		}

		.service-index,
		.cart-count {
			background: Canvas;
			color: CanvasText;
		}
	}
</style>
