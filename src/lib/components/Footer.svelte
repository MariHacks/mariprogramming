<script>
	import { footer } from '$lib/content';

	const { brand, socials } = footer;
</script>

<footer class="footer text-center">
	<div
		class="px-3 py-3 menu d-flex justify-content-center align-items-center column-gap-4 column-gap-sm-5"
	>
		{#each Object.entries(socials) as [name, info]}
			<a class="text-white" href={info.url}
				><img src={info.icon} height={info.height} alt={info.iconAlt} /><span
					class="ms-2 d-none d-md-inline">{name}</span
				></a
			>
		{/each}
	</div>
	<div class="px-4 py-2 bar">{brand}</div>
</footer>

<style>
	.footer {
		background-color: #050d2e;
		color: #fff;
	}

	.footer .menu {
		background-color: #0d2173;
	}

	.footer .menu a {
		text-decoration: none;
		opacity: 1;
		transition: opacity 0.15s ease-in-out;
	}

	.footer .menu a:hover {
		opacity: 0.75;
	}

	@media screen and (min-width: 992px) {
		.footer .menu {
			font-size: 1.1rem;
		}
	}
</style>
