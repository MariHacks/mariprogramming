<script>
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';

	const workshops = clubContent.workshops.slice(0, 3);
	const discordUrl = clubContent.socialLinks.find(({ label }) => label === 'Discord')?.url;
	const mariHacksUrl = clubContent.socialLinks.find(({ label }) => label === 'MariHacks')?.url;

	const activities = [
		{
			title: 'Peer Help',
			description: 'Bring a question or a project. Other students can help you work through it.',
			label: 'Ask in Discord',
			href: discordUrl,
			external: true,
			icon: 'people'
		},
		{
			title: 'Workshops',
			description: 'Learn practical concepts with material made by the club.',
			label: 'Browse workshops',
			href: '/our-workshops',
			icon: 'code'
		},
		{
			title: 'Mini-Competitions',
			description: 'Short programming challenges are being prepared.',
			status: 'Coming Soon',
			label: 'Mini-Competitions status',
			href: '/mini-competitions',
			icon: 'trophy'
		},
		{
			title: 'MariHacks',
			description: 'Meet other builders and make a project at the student-run hackathon.',
			label: 'Visit MariHacks',
			href: mariHacksUrl,
			external: true,
			icon: 'hexagon'
		}
	];

	const hubLinks = [
		{
			title: 'Ask for help',
			description: 'Post a question and learn with other students.',
			label: 'Ask in Discord',
			href: discordUrl,
			external: true,
			icon: 'message'
		},
		{
			title: 'Share resources',
			description: 'Find courses, references, and practice sites.',
			label: 'Browse resources',
			href: '/resources',
			icon: 'document'
		},
		{
			title: 'Meet collaborators',
			description: 'Find students to build and learn with.',
			label: 'Learn about the club',
			href: '/about-us',
			icon: 'people'
		},
		{
			title: 'Stay in the loop',
			description: 'Check confirmed events and club updates.',
			label: 'See events',
			href: '/events',
			icon: 'calendar'
		}
	];
</script>

<svelte:head>
	<title>{clubContent.name}</title>
	<meta name="description" content={clubContent.mission} />
</svelte:head>

<section class="hero" data-home-section="hero" aria-labelledby="home-title">
	<div class="hero-copy">
		<h1 id="home-title">
			<span>Come build</span>
			<span>something</span>
			<span>with us.</span>
		</h1>
		<p class="hero-lead">
			The student-run programming club for Marianopolis students of every experience level.
		</p>
		<p class="hero-body">
			Learn with other students through workshops, shared resources, mini-competitions, and
			MariHacks.
		</p>
		<div class="hero-actions">
			<a
				class="button-primary hero-primary"
				href={clubContent.signupUrl}
				target="_blank"
				rel="external noopener noreferrer"
			>
				Join the club <span aria-hidden="true">→</span>
			</a>
			<a class="quiet-link" href={resolve('/events', {})}
				>Explore upcoming events <span aria-hidden="true">→</span></a
			>
		</div>
		<p class="eligibility">Open to all Marianopolis students. No experience required.</p>
	</div>

	<picture class="hero-image">
		<source
			type="image/avif"
			srcset="
				/images/marihacks/organizers-working-640.avif 640w,
				/images/marihacks/organizers-working-960.avif 960w,
				/images/marihacks/organizers-working-1600.avif 1600w
			"
			sizes="(min-width: 768px) 53vw, 100vw"
		/>
		<img
			src="/images/marihacks/organizers-working-1600.webp"
			srcset="
				/images/marihacks/organizers-working-640.webp 640w,
				/images/marihacks/organizers-working-960.webp 960w,
				/images/marihacks/organizers-working-1600.webp 1600w
			"
			sizes="(min-width: 768px) 53vw, 100vw"
			width="1600"
			height="1200"
			alt="Two MariHacks organizers working side by side on laptops."
			fetchpriority="high"
		/>
	</picture>
</section>

<section class="activities home-band" data-home-section="activities" aria-label="Club activities">
	<div class="activity-grid home-inset">
		{#each activities as activity (activity.title)}
			<article class="activity">
				<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true">
					{#if activity.icon === 'people'}
						<path
							d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3 3 0 0 0 0-6M18 14a4 4 0 0 1 3 4v2"
						/>
					{:else if activity.icon === 'code'}
						<path d="m8 5-7 7 7 7M16 5l7 7-7 7M14 2l-4 20" />
					{:else if activity.icon === 'trophy'}
						<path
							d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4"
						/>
					{:else}
						<path d="m12 2 8 5v10l-8 5-8-5V7l8-5Zm0 5-4 2v6l4 2 4-2V9l-4-2Z" />
					{/if}
				</svg>
				<div class="activity-heading">
					<h2>{activity.title}</h2>
					{#if activity.status}<span class="status">{activity.status}</span>{/if}
				</div>
				<p>{activity.description}</p>
				{#if activity.href}
					{#if activity.external}
						<a
							class="quiet-link"
							href={activity.href}
							target="_blank"
							rel="external noopener noreferrer"
						>
							{activity.label} <span aria-hidden="true">↗</span>
						</a>
					{:else}
						<a class="quiet-link" href={resolve(activity.href, {})}>
							{activity.label} <span aria-hidden="true">→</span>
						</a>
					{/if}
				{/if}
			</article>
		{/each}
	</div>
</section>

<section class="archive-delivery home-band" data-home-section="archive-delivery">
	<div class="archive-delivery-grid home-inset">
		<section class="archive" aria-labelledby="archive-title">
			<header class="section-heading">
				<h2 id="archive-title">Workshop archive</h2>
				<a class="quiet-link" href={resolve('/our-workshops', {})}
					>View all workshops <span aria-hidden="true">→</span></a
				>
			</header>
			<ul class="workshop-list">
				{#each workshops as workshop (workshop.id)}
					<li>
						<a href={resolve('/our-workshops', {})} aria-label={workshop.title}>
							<span>
								<strong>{workshop.title}</strong>
								<small>{workshop.description}</small>
							</span>
							<span aria-hidden="true">→</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<section class="delivery" aria-labelledby="book-delivery-title">
			<header class="section-heading">
				<h2 id="book-delivery-title">Book Delivery</h2>
			</header>
			<p>We are preparing a campus service for required French and English course books.</p>
			<div class="delivery-type" aria-hidden="true">
				<span>French</span>
				<span>English</span>
				<span>Books</span>
			</div>
			<p class="delivery-status">coming next semester</p>
		</section>
	</div>
</section>

<section class="hub home-band" data-home-section="programming-hub" aria-labelledby="hub-title">
	<div class="home-inset">
		<h2 id="hub-title" class="hub-title">Programming Hub</h2>
		<div class="hub-grid">
			{#each hubLinks as item (item.title)}
				<article class="hub-item">
					<svg class="hub-icon" viewBox="0 0 24 24" aria-hidden="true">
						{#if item.icon === 'message'}
							<path d="M4 4h16v12H8l-4 4V4Zm5 6h.01M12 10h.01M15 10h.01" />
						{:else if item.icon === 'document'}
							<path d="M6 2h10l3 3v17H6V2Zm3 7h7M9 13h7M9 17h5" />
						{:else if item.icon === 'people'}
							<path
								d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3 3 0 0 0 0-6M18 14a4 4 0 0 1 3 4v2"
							/>
						{:else}
							<path d="M5 4h14v17H5V4Zm3-2v4M16 2v4M5 9h14M9 13h2M13 13h2M9 17h2" />
						{/if}
					</svg>
					<div>
						<h3>{item.title}</h3>
						<p>{item.description}</p>
						{#if item.external}
							<a
								class="quiet-link"
								href={item.href}
								target="_blank"
								rel="external noopener noreferrer"
							>
								{item.label} <span aria-hidden="true">↗</span>
							</a>
						{:else}
							<a class="quiet-link" href={resolve(/** @type {string} */ (item.href), {})}>
								{item.label} <span aria-hidden="true">→</span>
							</a>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>

<style>
	:global(main) {
		background: #fff;
	}

	.home-inset {
		width: 100%;
		max-width: 90rem;
		margin-inline: auto;
		padding-inline: clamp(1rem, 4.6vw, 3rem);
	}

	.hero {
		display: grid;
		grid-template-columns: 47.4% 52.6%;
		height: 33.8125rem;
		border-block-end: var(--rule);
		background: #fff;
	}

	.hero-copy {
		display: flex;
		align-items: flex-start;
		flex-direction: column;
		padding: 4rem clamp(2rem, 4.6vw, 3rem) 2.25rem;
	}

	.hero h1 {
		max-width: 21rem;
		font-size: clamp(3.625rem, 5.75vw, 4.25rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 1.045;
	}

	.hero h1 span {
		display: block;
	}

	.hero-lead,
	.hero-body {
		max-width: 22.2rem;
		font-size: 0.9375rem;
		line-height: 1.48;
	}

	.hero-lead {
		margin-block-start: 1.25rem;
		font-weight: 500;
	}

	.hero-body {
		margin-block-start: 1rem;
	}

	.hero-actions {
		display: flex;
		align-items: center;
		margin-block-start: auto;
		gap: clamp(1.5rem, 3.3vw, 2.25rem);
	}

	.hero-primary {
		min-width: 9.0625rem;
		min-height: 2.75rem;
		justify-content: space-between;
		border-radius: 0;
		padding-inline: 0.95rem;
	}

	.quiet-link {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		min-height: 2.75rem;
		gap: 0.65rem;
		color: var(--midnight);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.25;
		text-decoration: none;
	}

	.quiet-link:hover {
		color: var(--club-blue);
	}

	.eligibility {
		margin-block-start: 0.55rem;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.hero-image {
		min-width: 0;
		height: 100%;
		overflow: hidden;
		background: var(--mist);
	}

	.hero-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 49% center;
		filter: grayscale(1) contrast(1.02);
	}

	.home-band {
		border-block-end: var(--rule);
		background: #fff;
	}

	.activities {
		height: 15.5rem;
	}

	.activity-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		height: 100%;
	}

	.activity {
		display: flex;
		align-items: flex-start;
		flex-direction: column;
		min-width: 0;
		padding: 2.85rem 2.15rem 1.55rem 0.2rem;
	}

	.activity + .activity {
		padding-inline-start: 2.15rem;
		border-inline-start: var(--rule);
	}

	.line-icon {
		width: 1.5rem;
		height: 1.5rem;
		margin-block-end: 1.15rem;
		fill: none;
		stroke: var(--club-blue);
		stroke-linecap: square;
		stroke-linejoin: miter;
		stroke-width: 1.7;
	}

	.activity-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		width: 100%;
		gap: 0.5rem;
	}

	.activity h2 {
		font-size: 1rem;
		font-weight: 650;
		letter-spacing: -0.02em;
	}

	.status {
		color: var(--club-blue);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.activity p {
		margin-block-start: 0.75rem;
		font-size: 0.75rem;
		line-height: 1.45;
	}

	.activity .quiet-link {
		margin-block-start: auto;
	}

	.archive-delivery {
		min-height: 22rem;
	}

	.archive-delivery-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding-inline: 0;
	}

	.archive {
		min-width: 0;
		padding: 2.35rem clamp(1rem, 4.6vw, 3rem) 1.75rem;
	}

	.delivery {
		display: flex;
		min-width: 0;
		padding: 2.35rem clamp(1rem, 4.6vw, 3rem) 1.75rem;
		border-inline-start: var(--rule);
		flex-direction: column;
	}

	.delivery > p:not(.delivery-status) {
		max-width: 34rem;
		margin-block-start: 0.5rem;
		font-size: 0.75rem;
		line-height: 1.45;
	}

	.delivery-type {
		display: grid;
		margin-block-start: 1.2rem;
		justify-items: end;
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: clamp(2.5rem, 5vw, 4.25rem);
		font-weight: 750;
		letter-spacing: -0.07em;
		line-height: 0.74;
		text-transform: uppercase;
	}

	.delivery-type span:nth-child(2) {
		color: transparent;
		-webkit-text-stroke: 1px var(--midnight);
	}

	.delivery-type span:last-child {
		color: var(--club-blue);
	}

	.delivery-status {
		margin-block-start: auto;
		padding-block-start: 1rem;
		font-size: 0.75rem;
		font-weight: 650;
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 2.75rem;
		border-block-end: var(--rule);
		gap: 1rem;
	}

	.section-heading h2,
	.hub-title {
		font-family: var(--font-body);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0;
		line-height: 1.3;
		text-transform: uppercase;
	}

	.workshop-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.workshop-list li {
		max-width: none;
		border-block-end: var(--rule);
	}

	.workshop-list a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		min-height: 5.35rem;
		padding-inline: 0.25rem 0.65rem;
		gap: 1rem;
		color: var(--midnight);
		text-decoration: none;
	}

	.workshop-list a:hover {
		background: var(--mist);
	}

	.workshop-list a > span:first-child {
		display: grid;
		gap: 0.22rem;
	}

	.workshop-list strong {
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.workshop-list small {
		color: var(--quiet-steel);
		font-size: 0.6875rem;
		line-height: 1.35;
	}

	.hub {
		height: 10.6875rem;
		padding-block: 1.15rem 1rem;
	}

	.hub-title {
		margin-block-end: 0.55rem;
	}

	.hub-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.hub-item {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr);
		min-width: 0;
		padding: 0.65rem 1.5rem 0 0.2rem;
		gap: 1rem;
	}

	.hub-item + .hub-item {
		padding-inline-start: 1.5rem;
	}

	.hub-icon {
		width: 1.4rem;
		height: 1.4rem;
		fill: none;
		stroke: var(--midnight);
		stroke-linecap: square;
		stroke-linejoin: miter;
		stroke-width: 1.7;
	}

	.hub-item h3 {
		font-family: var(--font-body);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0;
		line-height: 1.25;
	}

	.hub-item p {
		margin-block-start: 0.35rem;
		font-size: 0.6875rem;
		line-height: 1.35;
	}

	.hub-item .quiet-link {
		min-height: 2.75rem;
		margin-block-start: 0.35rem;
		font-size: 0.6875rem;
	}

	@media (max-width: 63.999rem) and (min-width: 48rem) {
		.hero-copy {
			padding-top: 3.8rem;
		}

		.activity {
			padding-inline-end: 1.5rem;
		}

		.activity + .activity {
			padding-inline-start: 1.5rem;
		}
	}

	@media (max-width: 55.999rem) and (min-width: 48rem) {
		.activities,
		.hub {
			height: auto;
		}

		.activity-grid,
		.hub-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.activity {
			min-height: 13rem;
		}

		.activity:nth-child(odd) {
			padding-inline-start: 0.2rem;
			border-inline-start: 0;
		}

		.activity:nth-child(n + 3) {
			border-block-start: var(--rule);
		}

		.hub-item {
			min-height: 8.5rem;
		}
	}

	@media (max-width: 47.999rem) {
		.hero {
			grid-template-columns: 1fr;
			height: auto;
		}

		.hero-copy {
			min-height: 31rem;
			padding: 3rem var(--page-gutter) 2rem;
		}

		.hero h1 {
			font-size: clamp(3rem, 15vw, 4.25rem);
		}

		.hero-actions {
			align-items: flex-start;
			flex-direction: column;
			margin-block-start: 2rem;
			gap: 0.25rem;
		}

		.eligibility {
			margin-block-start: 0.75rem;
		}

		.hero-image {
			aspect-ratio: 4 / 3;
		}

		.activities,
		.hub {
			height: auto;
		}

		.activity-grid,
		.hub-grid {
			grid-template-columns: 1fr;
		}

		.activity {
			min-height: 13rem;
			padding: 2rem 0;
		}

		.activity + .activity {
			padding-inline-start: 0;
			border-block-start: var(--rule);
			border-inline-start: 0;
		}

		.archive-delivery-grid {
			grid-template-columns: 1fr;
		}

		.archive {
			padding-block: 2rem;
		}

		.delivery {
			min-height: 21rem;
			padding-block: 2rem;
			border-block-start: var(--rule);
			border-inline-start: 0;
		}

		.hub {
			padding-block: 2rem;
		}

		.hub-title {
			margin-block-end: 1rem;
		}

		.hub-item {
			min-height: 9rem;
			padding: 1.5rem 0;
			border-block-start: var(--rule);
		}

		.hub-item + .hub-item {
			padding-inline-start: 0;
		}
	}

	@media (max-width: 24rem) {
		.hero-copy {
			min-height: 33rem;
		}

		.hero h1 {
			font-size: 2.9rem;
		}
	}
</style>
