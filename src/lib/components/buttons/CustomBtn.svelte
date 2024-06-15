<script>
	export let link, btnStyle, expand;
	export let disabled = false;
</script>

<a
	href={link}
	class={`btn ${expand ? 'expand' : 'custom-btn'} ${btnStyle}-btn m-0 py-2 px-lg-2 border-2`}
	class:disabled
>
	<slot></slot>
</a>

<style>
	.custom-btn,
	.expand {
		width: 100%;
		font-weight: 500;
	}

	.disabled {
		pointer-events: none;
	}

	@media screen and (min-width: 992px) {
		.custom-btn {
			width: 75%;
		}
	}

	@media screen and (min-width: 1200px) {
		.custom-btn {
			width: 50%;
		}
	}

	@media screen and (min-width: 1440px) {
		.custom-btn {
			width: 20%;
		}
	}

	/* button styles (feel free to add more) */
	.primary-btn {
		color: #0d2173;
		border-color: #0d2173;
		background-color: #fff;
	}

	.primary-btn:hover {
		background-color: #0d2173;
		color: #fff;
	}

	.secondary-btn {
		color: #050d2e;
		border-color: #050d2e;
		background-color: #fff;
	}

	.secondary-btn:hover {
		background-color: #050d2e;
		color: #fff;
	}
</style>
