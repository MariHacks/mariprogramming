<script>
	import { resolve } from '$app/paths';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';

	const discordUrl = clubContent.socialLinks.find(({ label }) => label === 'Discord')?.url;
</script>

<svelte:head>
	<title>About | {clubContent.name}</title>
	<meta name="description" content={clubContent.mission} />
</svelte:head>

<section class="about-page surface-paper">
	<div class="page-container about-frame">
		<SectionIntro
			title="About the club"
			summary="The Programming Club is a peer learning community for Marianopolis students."
		/>

		<div class="about-reading">
			<div class="about-copy">
				<p>Members can get help while they build and use original workshop material.</p>
				<p>Mini-competitions are being prepared. Members can also take part in MariHacks.</p>
				<p class="beginner-note">You do not need programming experience to join.</p>
			</div>

			<nav aria-label="Club starting points">
				<ul class="destination-list">
					<li>
						<a
							class="destination-link destination-link-primary"
							href={clubContent.signupUrl}
							target="_blank"
							rel="external noopener noreferrer"
						>
							<span>Join the club</span>
							<span aria-hidden="true">↗</span>
						</a>
					</li>
					<li>
						<a class="destination-link" href={resolve('/our-workshops', {})}>
							<span>Browse workshops</span>
							<span aria-hidden="true">→</span>
						</a>
					</li>
					<li>
						<a class="destination-link" href={resolve('/resources', {})}>
							<span>Browse resources</span>
							<span aria-hidden="true">→</span>
						</a>
					</li>
					<li>
						<a
							class="destination-link"
							href={discordUrl}
							target="_blank"
							rel="external noopener noreferrer"
						>
							<span>Join Discord</span>
							<span aria-hidden="true">↗</span>
						</a>
					</li>
				</ul>
			</nav>
		</div>
	</div>
</section>

<style>
	.about-page {
		min-height: calc(100vh - 4.5rem - 4.9375rem);
		border-block-end: var(--rule);
	}

	.about-frame {
		display: grid;
		padding-block: clamp(3.5rem, 7vw, 6rem);
		gap: clamp(2.5rem, 7vw, 6rem);
	}

	.about-frame :global(.section-intro) {
		align-content: start;
		max-width: 36rem;
	}

	.about-reading {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: clamp(2rem, 5vw, 3.5rem);
	}

	.about-copy {
		display: grid;
		padding-block-start: var(--space-md);
		border-block-start: var(--rule-strong);
		gap: var(--space-sm);
	}

	.about-copy p {
		max-width: 43rem;
		font-size: var(--text-lg);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.beginner-note {
		color: var(--midnight);
		font-weight: 600;
	}

	.destination-list {
		margin: 0;
		padding: 0;
		border-block: var(--rule);
		list-style: none;
	}

	.destination-list li {
		max-width: none;
	}

	.destination-list li + li {
		border-block-start: var(--rule);
	}

	.destination-link {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: center;
		min-height: 3.5rem;
		padding: 0.7rem var(--space-2xs);
		color: var(--graphite);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.35;
		text-decoration: none;
		column-gap: var(--space-sm);
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.destination-link-primary {
		color: var(--club-blue);
		font-weight: 700;
	}

	.destination-link:hover {
		background: var(--mist);
		color: var(--club-blue);
	}

	.destination-link:active {
		transform: translateY(var(--press-distance));
	}

	@media (min-width: 52rem) {
		.about-frame {
			grid-template-columns: minmax(15rem, 0.68fr) minmax(0, 1.32fr);
			align-items: start;
		}
	}

	@media (max-width: 43.749rem) {
		.about-page {
			min-height: calc(100vh - 4.25rem - 6.5rem);
		}
	}
</style>
