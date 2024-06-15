<script>
	export let link = '';
	export let disabled = false;
</script>

<!-- only used in topnav -->
<a href={link} class="btn light-btn m-0 mx-lg-2 px-lg-2" class:disabled>
	<slot></slot>
</a>

<style>
	.light-btn {
		color: #fff;
		border-color: #fff;
		background-color: #050d2e;
		width: 100%;
	}

	.light-btn:hover {
		background-color: #fff;
		color: #050d2e;
	}

	.disabled {
		pointer-events: none;
	}

	@media screen and (min-width: 992px) {
		.light-btn {
			width: auto;
		}
	}
</style>
