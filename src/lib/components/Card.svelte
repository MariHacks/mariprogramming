<script>
	export let title,
		subtitle,
		desc,
		list,
		links,
		arrow = '';
</script>

<div class={'reg-card card rounded-0' + (arrow ? ' link-card bg-white' : ' card-light-blue')}>
	<div
		class={'card-body relative text-black' +
			(arrow ? ' py-4 ps-4 justify-content-between' : ' p-4')}
	>
		<div>
			<h5 class="card-title fw-semibold">{title}</h5>

			{#if subtitle}
				<!-- smaller, gray subtitle under the title -->
				<h6 class="card-subtitle text-body-secondary mt-2">{subtitle}</h6>
			{/if}
		</div>

		{#if desc}
			<!-- description in the card body -->
			<p class={'card-text mb-0' + (subtitle ? ' mt-3' : ' mt-5')}>{desc}</p>
		{/if}

		{#if list}
			<!-- optionally displays an unordered (bullet) list of items -->
			<ul class={'card-text mb-0' + (desc ? ' mt-2' : ' mt-3')}>
				{#each list as item, i (i)}
					<li>{item}</li>
				{/each}
			</ul>
		{/if}

		{#if links}
			<!-- cards can optionally display links -->
			<div class="card-links d-flex column-gap-3 row-gap-1 flex-wrap mt-3">
				{#each Object.entries(links) as [text, link]}
					<a href={link} class="d-flex align-items-center text-black"
						><img
							class="link-icon"
							src="/link/link-icon-dark.svg"
							alt={`Link to ${text}`}
						/>{text}</a
					>
				{/each}
			</div>
		{/if}

		{#if arrow}
			<!-- adds an arrow pointing right, in the bottom right corner of the card -->
			<div class="position-absolute right-arrow">
				<img src="/right-arrow.svg" alt="Right arrow icon" height="15" />
			</div>
		{/if}
	</div>
</div>

<style>
	.card-light-blue {
		background-color: #cce0ff;
	}

	.reg-card {
		border: solid 2px #050d2e;
		height: 100%;
		min-height: 175px;
	}

	.reg-card .card-body {
		display: flex;
		flex-direction: column;
	}

	.link-card {
		overflow: hidden; /* for hover effect (see below) */
	}

	.link-card .card-body {
		padding-right: calc(48px + 1rem);
		z-index: 0;
		overflow: hidden;
	}

	/* heavily inspired by https://codepen.io/andrewsims/pen/mQoYwz */
	/* : and :: for cross-compatibility to be safe */
	.link-card .card-body::before,
	.link-card .card-body:before {
		content: '';
		position: absolute;
		z-index: -1;
		right: 0;
		bottom: 0;
		width: 44px;
		height: 44px;
		transform: scale(1);
		transform-origin: 50% 50%;
		background-color: #050d2e;
		transition: transform 0.25s ease-out;
	}

	.link-card .card-body:hover::before,
	.link-card .card-body:hover:before {
		transform: scale(21);
	}

	.link-card .card-body:hover h5,
	.link-card .card-body:hover h6,
	.link-card .card-body:hover p,
	.link-card .card-body:hover ul {
		color: #fff;
		transition: color 0.3 ease-out;
	}

	.right-arrow {
		right: 0;
		bottom: 0;
		padding: 12px 10px 10px 12px;
		background-color: #050d2e;
	}

	.link-icon {
		margin-right: 0.35rem;
	}

	.card-links a {
		text-decoration: none;
	}

	.card-links a:hover {
		text-decoration: underline;
	}

	@media screen and (min-width: 1440px) {
		.link-card .card-body:hover::before,
		.link-card .card-body:hover:before {
			transform: scale(35);
			transition-duration: 0.35s;
		}

		.link-card .card-body:hover h5,
		.link-card .card-body:hover h6,
		.link-card .card-body:hover p,
		.link-card .card-body:hover ul {
			transition-duration: 0.4s;
		}
	}

	/* in case the site is viewed on giant screens (TVs, dual monitors, etc.) */
	@media screen and (min-width: 2500px) {
		.reg-card {
			min-height: 200px;
		}

		.link-card .card-body:hover::before,
		.link-card .card-body:hover:before {
			transform: scale(45);
			transition-duration: 0.45s;
		}

		.link-card .card-body:hover h5,
		.link-card .card-body:hover h6,
		.link-card .card-body:hover p,
		.link-card .card-body:hover ul {
			transition-duration: 0.5s;
		}
	}

	@media screen and (min-width: 3100px) {
		.link-card .card-body:hover::before,
		.link-card .card-body:hover:before {
			transform: scale(55);
		}
	}

	@media screen and (min-width: 3800px) {
		.link-card .card-body:hover::before,
		.link-card .card-body:hover:before {
			transform: scale(65);
		}
	}

	@media screen and (min-width: 4500px) {
		.link-card .card-body:hover::before,
		.link-card .card-body:hover:before {
			transform: scale(75);
		}
	}
</style>
