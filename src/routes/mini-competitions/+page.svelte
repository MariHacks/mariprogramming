<script>
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';

	const discordUrl = clubContent.socialLinks.find(({ label }) => label === 'Discord')?.url;
</script>

<svelte:head>
	<title>Mini-Competitions | {clubContent.name}</title>
	<meta
		name="description"
		content="Launch status for Marianopolis Programming Club mini-competitions."
	/>
</svelte:head>

<section class="competition-page editorial-page" aria-labelledby="competition-title">
	<div class="competition-frame">
		<header class="competition-heading">
			<h1 id="competition-title">
				Mini-<wbr /><span data-heading-word="competitions">Competitions</span>
			</h1>
			<p class="status">Coming Soon</p>
		</header>

		<div class="competition-copy">
			<p>We are preparing short programming challenges for Marianopolis students.</p>
			<p>New challenges will appear here when they are ready.</p>
		</div>

		<nav class="competition-links ruled-index" aria-label="Programming links">
			<a class="ruled-link" href={resolve('/our-workshops', {})}>
				<span>Browse workshop archive</span>
				<span aria-hidden="true">→</span>
			</a>
			<a class="ruled-link" href={discordUrl} target="_blank" rel="external noopener noreferrer">
				<span>Join Discord</span>
				<span aria-hidden="true">↗</span>
			</a>
		</nav>
	</div>
</section>

<style>
	.competition-page {
		background: #fff;
	}

	.competition-frame {
		display: grid;
		width: 100%;
		max-width: 90rem;
		margin-inline: auto;
		padding: clamp(3.5rem, 8vw, 7rem) clamp(1rem, 4.6vw, 3rem);
		gap: clamp(2rem, 5vw, 4rem);
	}

	.competition-heading {
		display: grid;
		align-content: start;
		gap: 1.25rem;
	}

	h1 {
		max-width: 12ch;
		font-size: clamp(3.25rem, 6.2vw, 5.5rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 0.92;
	}

	h1 span {
		white-space: nowrap;
	}

	.status {
		width: fit-content;
		color: var(--club-blue);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.competition-copy {
		display: grid;
		align-content: start;
		padding-block-start: 1.5rem;
		border-block-start: var(--rule-strong);
		gap: 1rem;
	}

	.competition-copy p {
		max-width: 36rem;
		font-size: var(--text-lg);
		line-height: 1.55;
	}

	.competition-links {
		align-self: end;
	}

	@media (min-width: 52rem) {
		.competition-frame {
			grid-template-columns: minmax(32rem, 1.1fr) minmax(16rem, 0.9fr);
			align-content: center;
		}

		.competition-heading {
			grid-row: span 2;
		}

		.competition-links {
			align-self: end;
		}
	}

	@media (max-width: 43.749rem) {
		h1 {
			font-size: 2.75rem;
		}
	}
</style>
