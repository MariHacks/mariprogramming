<script>
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';
	import { createClubContactLinks } from '$lib/club-contact.js';
	import SocialIcon from './SocialIcon.svelte';

	const footerSocialLinks = clubContent.socialLinks.filter(({ label }) =>
		['Instagram', 'Discord'].includes(label)
	);
	const contactLinks = createClubContactLinks();
</script>

<footer class="site-footer">
	<div class="footer-frame" data-layout="compact-row">
		<a class="footer-brand" href={resolve('/', {})} aria-label={clubContent.name}>
			<span>
				<strong>{clubContent.name}</strong>
				<small>Building the developer community at Marianopolis.</small>
			</span>
		</a>

		<div class="footer-actions">
			<nav class="contact" aria-label="Club contact">
				<a href={contactLinks.bug.href} rel="external">{contactLinks.bug.label}</a>
			</nav>

			<nav class="community" aria-label="Club community">
				<ul class="social-list">
					<li>
						<a
							class="social-link"
							href={contactLinks.inquiry.href}
							rel="external"
							aria-label={contactLinks.inquiry.label}
						>
							<SocialIcon name="Mail" />
						</a>
					</li>
					{#each footerSocialLinks as link (link.label)}
						<li>
							<a
								class="social-link"
								href={link.url}
								aria-label={link.label}
								target="_blank"
								rel="external noopener noreferrer"
							>
								<SocialIcon name={link.label} />
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid rgb(var(--sky-rgb, 183 215 255) / 24%);
		background: var(--midnight, #061431);
		color: var(--paper, #f8fafc);
	}

	.footer-frame {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		width: 100%;
		max-width: calc(
			var(--layout-width, 76rem) + var(--page-gutter, 2rem) + var(--page-gutter, 2rem)
		);
		margin-inline: auto;
		min-height: 4.9375rem;
		padding: 0.7rem var(--page-gutter, 2rem);
		gap: 1rem 2rem;
	}

	.footer-brand {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		min-height: 2.75rem;
		gap: 0.75rem;
		color: var(--paper, #f8fafc);
		font-family: var(--font-display, sans-serif);
		font-size: 0.75rem;
		letter-spacing: -0.025em;
		text-decoration: none;
	}

	.footer-brand span {
		display: grid;
		gap: 0.3rem;
	}

	.footer-brand strong {
		font-size: 0.8rem;
		font-weight: 650;
	}

	.footer-brand small {
		color: rgb(var(--paper-rgb, 248 250 252) / 72%);
		font-family: var(--font-body);
		font-size: 0.6875rem;
		font-weight: 400;
		letter-spacing: 0;
	}

	.footer-actions {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-self: end;
		gap: 0.15rem;
	}

	.community {
		justify-self: end;
	}

	.contact {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		padding-inline-end: 0.15rem;
	}

	.contact a {
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		color: var(--paper, #f8fafc);
		font-family: var(--font-body);
		font-size: 0.75rem;
		font-weight: 600;
		text-decoration-color: rgb(var(--sky-rgb, 183 215 255) / 55%);
		text-underline-offset: 0.2em;
		white-space: nowrap;
	}

	.social-list {
		display: flex;
		align-items: center;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.social-link {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid transparent;
		border-radius: var(--radius-xs, 0.125rem);
		color: inherit;
		place-items: center;
		transition:
			background-color var(--motion-fast, 140ms) var(--ease-out, ease-out),
			border-color var(--motion-fast, 140ms) var(--ease-out, ease-out),
			transform var(--motion-press, 120ms) var(--ease-out, ease-out);
	}

	.social-link:hover {
		border-color: rgb(var(--sky-rgb, 183 215 255) / 48%);
		background: rgb(var(--sky-rgb, 183 215 255) / 12%);
	}

	.social-link:active {
		transform: translateY(var(--press-distance, 1px));
	}

	.site-footer a:focus-visible {
		outline: var(--focus-ring-width, 3px) solid var(--sky, #b7d7ff);
		outline-offset: var(--focus-ring-offset, 3px);
	}

	@media (max-width: 39.999rem) {
		.footer-frame {
			grid-template-columns: minmax(0, 1fr) auto;
			min-height: 6.5rem;
			padding-block: 1rem;
		}

		.footer-actions {
			flex-wrap: wrap;
			justify-self: stretch;
			justify-content: flex-start;
		}

		.footer-brand small {
			display: none;
		}
	}

	@media (forced-colors: active) {
		.site-footer,
		.community,
		.social-link {
			border-color: CanvasText;
		}

		.site-footer a:focus-visible {
			outline-color: Highlight;
		}
	}
</style>
