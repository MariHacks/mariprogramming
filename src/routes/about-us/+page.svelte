<script>
	import { resolve } from '$app/paths';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent, isExternalSignupUrl } from '$lib/content/club';

	const discordUrl = clubContent.socialLinks.find(({ label }) => label === 'Discord')?.url;
</script>

<svelte:head>
	<title>About | {clubContent.name}</title>
	<meta name="description" content={clubContent.mission} />
</svelte:head>

<section class="about-page surface-paper editorial-page">
	<div class="page-container about-frame editorial-frame editorial-frame--split">
		<SectionIntro
			title="About the club"
			summary="The Programming Club is a peer learning community for Marianopolis students."
		/>

		<div class="about-reading editorial-rail">
			<div class="about-copy">
				<p>Members can get help while they build and use original workshop material.</p>
				<p>
					The current workshop is Speedrun Programming in Science. Members can also take part in
					MariHacks.
				</p>
				<p class="beginner-note">You do not need programming experience to join.</p>
			</div>

			<nav aria-label="Club starting points">
				<ul class="destination-list ruled-index">
					<li>
						<a
							class="ruled-link ruled-link--primary"
							href={clubContent.signupUrl}
							{...(isExternalSignupUrl()
								? { target: '_blank', rel: 'external noopener noreferrer' }
								: {})}
						>
							<span>Join the club</span>
							<span aria-hidden="true">{isExternalSignupUrl() ? '↗' : '→'}</span>
						</a>
					</li>
					<li>
						<a class="ruled-link" href={resolve('/pbl', {})}>
							<span>Browse workshops</span>
							<span aria-hidden="true">→</span>
						</a>
					</li>
					<li>
						<a class="ruled-link" href={resolve('/resources', {})}>
							<span>Browse resources</span>
							<span aria-hidden="true">→</span>
						</a>
					</li>
					<li>
						<a
							class="ruled-link"
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

	.about-reading {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: clamp(2rem, 5vw, 3.5rem);
	}
</style>
