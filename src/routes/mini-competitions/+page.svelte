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

<section class="competition-page" aria-labelledby="competition-title">
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

		<nav class="competition-links" aria-label="Programming links">
			<a href={resolve('/our-workshops', {})}>
				<span>Browse workshop archive</span>
				<span aria-hidden="true">→</span>
			</a>
			<a href={discordUrl} target="_blank" rel="external noopener noreferrer">
				<span>Join Discord</span>
				<span aria-hidden="true">↗</span>
			</a>
		</nav>
	</div>
</section>

<style>
	.competition-page {
		border-block-end: var(--rule);
		background: #fff;
	}

	.competition-frame {
		display: grid;
		width: 100%;
		max-width: 90rem;
		min-height: calc(100vh - 4.5rem - 4.9375rem);
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
		border-block: var(--rule);
	}

	.competition-links a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		min-height: 3.5rem;
		padding-inline: 0.5rem;
		color: var(--midnight);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
	}

	.competition-links a + a {
		border-block-start: var(--rule);
	}

	.competition-links a:hover {
		background: var(--mist);
		color: var(--club-blue);
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
		.competition-frame {
			min-height: calc(100vh - 4.25rem - 6.5rem);
		}
	}

	@media (max-width: 23rem) {
		h1 {
			font-size: 2.75rem;
		}
	}
</style>
