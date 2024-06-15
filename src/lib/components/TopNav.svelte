<script>
	export let path = '';
	import { topNav } from '$lib/content';
	import NavBtn from '$lib/components/buttons/NavBtn.svelte';

	const { left, right, cta, brand } = topNav;
</script>

<nav class="navbar navbar-expand-lg topnav text-center">
	<div class="container-fluid">
		<div class="collapse navbar-collapse mt-2 mt-lg-0" id="topnav-collapse">
			<ul class="navbar-nav me-auto mb-lg-0">
				{#each Object.entries(left) as [text, url]}
					<li class="nav-item">
						<a class={'nav-link' + (url === path ? ' active' : '')} href={url}>{text}</a>
					</li>
				{/each}
			</ul>
		</div>
		<a
			class="navbar-brand mx-auto position-relative order-first order-lg-0"
			id="topnav-brand"
			href="/"
		>
			<img
				src={brand.imgSm}
				alt={brand.imgAlt}
				height={brand.imgHeightSm}
				class="d-inline-block d-lg-none"
			/>
			<img
				src={brand.imgFull}
				alt={brand.imgAlt}
				height={brand.imgHeightFull}
				class="d-lg-inline-block d-none"
			/>
		</a>
		<button
			class="navbar-toggler bg-white px-2 order-first order-lg-0"
			type="button"
			data-bs-toggle="collapse"
			data-bs-target="#topnav-collapse"
			aria-controls="topnav-collapse"
			aria-expanded="false"
			aria-label="Toggle navigation"
		>
			<span class="navbar-toggler-icon"></span>
		</button>

		<div class="collapse navbar-collapse mb-2 mb-lg-0" id="topnav-collapse">
			<ul class="navbar-nav ms-auto mb-2 mb-lg-0">
				{#each Object.entries(right) as [text, url]}
					<li class="nav-item">
						<a class={'nav-link' + (url === path ? ' active' : '')} href={url}>{text}</a>
					</li>
				{/each}
			</ul>
			<NavBtn link={cta.url || '/'} disabled={!cta.url}>{cta.text}</NavBtn>
		</div>
	</div>
</nav>

<style>
	.topnav {
		background-color: #050d2e;
	}

	.topnav div ul a {
		color: #fff;
	}

	#topnav-brand {
		left: 24px;
		transition: background-color 0.15s ease-in-out;
	}

	.nav-link {
		transition: background-color 0.15s ease-in-out;
		border-radius: 6px;
		word-spacing: -3.5px;
	}

	.nav-link:hover {
		background-color: #0d2173;
	}

	.nav-link.active {
		text-decoration: underline;
	}

	@media screen and (min-width: 992px) {
		#topnav-brand {
			left: 0;
		}
	}
</style>
