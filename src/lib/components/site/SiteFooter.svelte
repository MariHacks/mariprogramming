<script>
	import { clubContent } from '$lib/content/club';
</script>

<footer class="site-footer">
	<div class="footer-frame">
		<div class="footer-main">
			<div class="club-return">
				<a class="club-home" href="/">
					<span class="syntax" aria-hidden="true">&lt;</span>
					<span class="club-name">{clubContent.name}</span>
					<span class="syntax" aria-hidden="true">/&gt;</span>
					<span class="home-label">Home</span>
				</a>
				<p class="club-purpose">{clubContent.mission}</p>
			</div>

			<nav class="community" aria-label="Club community">
				<p class="community-label">Community</p>
				<ul class="social-list">
					{#each clubContent.socialLinks as link (link.label)}
						<li>
							<a class="social-link" href={link.url} target="_blank" rel="noopener noreferrer">
								<span class="social-icon" aria-hidden="true">
									<img src={link.icon} alt="" width="24" height="24" loading="lazy" />
								</span>
								<span>{link.label}</span>
								<span class="external-mark" aria-hidden="true">↗</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>

		<div class="footer-closing">
			<small>© {clubContent.name}</small>
			<p>Made for Marianopolis students.</p>
		</div>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid rgb(153 194 255 / 24%);
		background: var(--midnight, #050d2e);
		color: var(--paper, #f7f4ed);
	}

	.footer-frame {
		width: 100%;
		max-width: calc(
			var(--layout-width, 78rem) + var(--page-gutter, 2rem) + var(--page-gutter, 2rem)
		);
		margin-inline: auto;
		padding: clamp(3rem, 7vw, 5.5rem) clamp(1.25rem, 4vw, var(--page-gutter, 4rem))
			clamp(1.5rem, 3vw, 2.25rem);
	}

	.footer-main {
		display: grid;
		gap: clamp(2.5rem, 6vw, 5rem);
	}

	.club-return {
		display: grid;
		align-content: start;
		gap: var(--space-md, 1.5rem);
	}

	.club-home {
		display: flex;
		align-items: baseline;
		width: fit-content;
		max-width: 100%;
		flex-wrap: wrap;
		gap: 0.32em;
		color: var(--paper, #f7f4ed);
		font-family: var(--font-display, sans-serif);
		font-size: clamp(1.35rem, 3vw, 2rem);
		font-weight: 600;
		letter-spacing: -0.04em;
		line-height: 1.2;
		text-decoration: none;
	}

	.club-home:hover .club-name {
		color: var(--sky, #99c2ff);
	}

	.syntax {
		color: var(--sky, #99c2ff);
		font-family: var(--font-mono, monospace);
		font-size: 0.72em;
		font-weight: 500;
		letter-spacing: 0;
	}

	.club-name {
		transition: color var(--motion-fast, 140ms) var(--ease-out, ease-out);
	}

	.home-label {
		margin-inline-start: 0.45rem;
		color: var(--sky, #99c2ff);
		font-family: var(--font-mono, monospace);
		font-size: var(--text-xs, 0.75rem);
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.club-purpose {
		max-width: 39rem;
		color: rgb(247 244 237 / 76%);
		font-size: var(--text-lg, 1.125rem);
		line-height: 1.55;
	}

	.community {
		padding-block-start: var(--space-lg, 2rem);
		border-top: 1px solid rgb(153 194 255 / 24%);
	}

	.community-label {
		color: var(--sky, #99c2ff);
		font-family: var(--font-mono, monospace);
		font-size: var(--text-xs, 0.75rem);
		font-weight: 600;
		letter-spacing: 0.11em;
		line-height: 1.4;
		text-transform: uppercase;
	}

	.social-list {
		display: grid;
		margin: var(--space-sm, 1rem) 0 0;
		padding: 0;
		list-style: none;
	}

	.social-list li {
		min-width: 0;
		border-top: 1px solid rgb(153 194 255 / 18%);
	}

	.social-link {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr) auto;
		align-items: center;
		min-height: 3.5rem;
		gap: var(--space-xs, 0.75rem);
		padding-block: 0.65rem;
		color: var(--paper, #f7f4ed);
		font-weight: 600;
		text-decoration: none;
		transition:
			color var(--motion-fast, 140ms) var(--ease-out, ease-out),
			padding-inline var(--motion-fast, 140ms) var(--ease-out, ease-out);
	}

	.social-link:hover {
		padding-inline: 0.35rem;
		color: var(--sky, #99c2ff);
	}

	.social-icon {
		display: grid;
		width: 1.5rem;
		height: 1.5rem;
		place-items: center;
	}

	.social-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.external-mark {
		color: var(--sky, #99c2ff);
		font-family: var(--font-mono, monospace);
		font-size: 0.95rem;
	}

	.footer-closing {
		display: grid;
		gap: var(--space-2xs, 0.5rem);
		margin-block-start: clamp(3rem, 7vw, 5rem);
		padding-block-start: var(--space-md, 1.5rem);
		border-top: 1px solid rgb(153 194 255 / 24%);
		color: rgb(247 244 237 / 58%);
		font-family: var(--font-mono, monospace);
		font-size: var(--text-xs, 0.75rem);
		letter-spacing: 0.035em;
		line-height: 1.5;
	}

	.footer-closing small {
		font: inherit;
	}

	.footer-closing p {
		font: inherit;
	}

	.site-footer a:focus-visible {
		outline: 3px solid var(--color-focus, #df5b48);
		outline-offset: 4px;
	}

	@media (min-width: 48rem) {
		.footer-main {
			grid-template-columns: minmax(0, 1.15fr) minmax(19rem, 0.85fr);
			align-items: start;
		}

		.community {
			padding-block-start: 0;
			padding-inline-start: clamp(2rem, 4vw, 4rem);
			border-top: 0;
			border-left: 1px solid rgb(153 194 255 / 24%);
		}

		.social-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: clamp(1.25rem, 3vw, 2.5rem);
		}

		.footer-closing {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: baseline;
		}
	}

	@media (forced-colors: active) {
		.site-footer,
		.community,
		.social-list li,
		.footer-closing {
			border-color: CanvasText;
		}

		.club-purpose,
		.footer-closing {
			color: CanvasText;
		}
	}
</style>
