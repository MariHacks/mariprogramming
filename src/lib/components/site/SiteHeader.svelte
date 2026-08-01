<script>
	import { clubContent } from '$lib/content/club';

	/** @type {string} */
	export let pathname;

	const navigationLinks = [
		{ label: 'Club', href: '/about-us' },
		{ label: 'Workshops', href: '/our-workshops' },
		{ label: 'Events', href: '/events' },
		{ label: 'Resources', href: '/resources' },
		{ label: 'Book Delivery', href: '/books', service: true }
	];

	let menuOpen = false;
	/** @type {HTMLButtonElement} */
	let menuButton;

	/**
	 * Keep a section current while a student moves through its nested routes.
	 * @param {string} href
	 */
	function isCurrent(href) {
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key !== 'Escape' || !menuOpen) return;

		menuOpen = false;
		menuButton.focus();
	}

	function closeMenu() {
		menuOpen = false;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<header class="site-header">
	<div class="header-frame">
		<a class="brand" href="/">
			<img
				class="brand-mark"
				src="/logo-icon.svg"
				alt="Marianopolis Programming Club, home"
				width="173"
				height="182"
			/>
			<span class="brand-name" aria-hidden="true">
				<span class="brand-campus">Marianopolis</span>
				<span>Programming Club</span>
			</span>
		</a>

		<button
			bind:this={menuButton}
			class="menu-toggle"
			type="button"
			aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
			aria-controls="site-navigation"
			aria-expanded={menuOpen}
			on:click={() => (menuOpen = !menuOpen)}
		>
			<span class="menu-label" aria-hidden="true">{menuOpen ? 'Close' : 'Menu'}</span>
			<span class:open={menuOpen} class="menu-icon" aria-hidden="true">
				<span></span>
				<span></span>
			</span>
		</button>

		<nav
			id="site-navigation"
			class="primary-nav"
			aria-label="Primary navigation"
			data-open={menuOpen}
		>
			<ul class="nav-list">
				{#each navigationLinks as link (link.href)}
					<li class:service-route={link.service}>
						<a
							class="nav-link"
							class:current={isCurrent(link.href)}
							href={link.href}
							aria-current={isCurrent(link.href) ? 'page' : undefined}
							on:click={closeMenu}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>

			<a
				class="community-link"
				href={clubContent.communityAction.url}
				target="_blank"
				rel="noopener noreferrer"
				on:click={closeMenu}>{clubContent.communityAction.label}</a
			>
		</nav>
	</div>
</header>

<style>
	.site-header {
		position: relative;
		z-index: 20;
		border-bottom: 1px solid rgb(153 194 255 / 26%);
		background: var(--midnight, #050d2e);
		color: var(--paper, #f7f4ed);
	}

	.header-frame {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		width: 100%;
		max-width: calc(
			var(--layout-width, 78rem) + var(--page-gutter, 2rem) + var(--page-gutter, 2rem)
		);
		margin-inline: auto;
		padding-inline: clamp(1rem, 4vw, var(--page-gutter, 4rem));
	}

	.brand {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		max-width: 100%;
		min-height: 4.75rem;
		gap: 0.7rem;
		color: var(--paper, #f7f4ed);
		text-decoration: none;
	}

	.brand-mark {
		width: 2rem;
		height: 2.125rem;
		flex: 0 0 auto;
		object-fit: contain;
	}

	.brand-name {
		display: grid;
		min-width: 0;
		font-family: var(--font-display, sans-serif);
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.brand-campus {
		color: var(--sky, #99c2ff);
		font-family: var(--font-mono, monospace);
		font-size: 0.58rem;
		font-weight: 600;
		letter-spacing: 0.13em;
		line-height: 1.5;
		text-transform: uppercase;
	}

	.menu-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 5.5rem;
		min-height: 2.75rem;
		gap: 0.6rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid rgb(153 194 255 / 52%);
		border-radius: var(--radius-sm, 0.5rem);
		background: transparent;
		color: var(--paper, #f7f4ed);
		cursor: pointer;
	}

	.menu-toggle:hover {
		border-color: var(--sky, #99c2ff);
		background: rgb(153 194 255 / 12%);
	}

	.menu-label {
		font-family: var(--font-mono, monospace);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.menu-icon {
		display: grid;
		width: 1rem;
		gap: 0.3rem;
	}

	.menu-icon span {
		display: block;
		width: 100%;
		height: 1px;
		background: currentColor;
		transform-origin: center;
		transition: transform var(--motion-fast, 140ms) var(--ease-out, ease-out);
	}

	.menu-icon.open span:first-child {
		transform: translateY(0.2rem) rotate(45deg);
	}

	.menu-icon.open span:last-child {
		transform: translateY(-0.2rem) rotate(-45deg);
	}

	.primary-nav {
		grid-column: 1 / -1;
		padding-block: 0.75rem 1.25rem;
		border-top: 1px solid rgb(153 194 255 / 18%);
	}

	.nav-list {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nav-link,
	.community-link {
		display: flex;
		align-items: center;
		min-height: 3rem;
		border-radius: var(--radius-xs, 0.25rem);
		font-weight: 600;
		text-decoration: none;
	}

	.nav-link {
		position: relative;
		padding: 0.65rem 0.85rem 0.65rem 1.1rem;
		color: var(--paper, #f7f4ed);
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		letter-spacing: 0.035em;
	}

	.nav-link::before {
		position: absolute;
		top: 0.75rem;
		bottom: 0.75rem;
		left: 0;
		width: 2px;
		background: transparent;
		content: '';
	}

	.nav-link:hover {
		background: rgb(153 194 255 / 10%);
		color: var(--sky, #99c2ff);
	}

	.primary-nav .nav-link:focus-visible {
		outline: 3px solid var(--color-focus, #df5b48);
		outline-offset: 3px;
		box-shadow: none;
	}

	.nav-link.current {
		background: rgb(153 194 255 / 14%);
		color: var(--sky, #99c2ff);
	}

	.nav-link.current::before {
		background: var(--sky, #99c2ff);
	}

	.service-route {
		margin-top: 0.55rem;
		padding-top: 0.55rem;
		border-top: 1px solid rgb(153 194 255 / 25%);
	}

	.community-link {
		justify-content: center;
		margin-top: 0.85rem;
		padding: 0.65rem 1rem;
		border: 1px solid var(--sky, #99c2ff);
		background: var(--sky, #99c2ff);
		color: var(--midnight, #050d2e);
		font-size: 0.875rem;
	}

	.community-link:hover {
		border-color: var(--paper, #f7f4ed);
		background: var(--paper, #f7f4ed);
		color: var(--midnight, #050d2e);
	}

	@media (max-width: 69.999rem) {
		.primary-nav {
			display: none;
		}

		.primary-nav[data-open='true'] {
			display: block;
		}
	}

	@media (min-width: 70rem) {
		.header-frame {
			grid-template-columns: auto minmax(0, 1fr);
			gap: clamp(1.25rem, 2.5vw, 3rem);
			min-height: 5.25rem;
		}

		.brand {
			min-height: 5.25rem;
		}

		.brand-mark {
			width: 2.125rem;
			height: 2.25rem;
		}

		.brand-name {
			font-size: 0.95rem;
		}

		.menu-toggle {
			display: none;
		}

		.primary-nav {
			display: flex;
			grid-column: auto;
			align-items: center;
			justify-content: flex-end;
			min-width: 0;
			padding: 0;
			border: 0;
		}

		.nav-list {
			display: flex;
			align-items: center;
			min-width: 0;
			gap: 0.1rem;
		}

		.nav-link {
			min-height: 2.75rem;
			padding: 0.65rem clamp(0.55rem, 0.8vw, 0.8rem);
			font-size: clamp(0.68rem, 0.15vw + 0.62rem, 0.75rem);
			white-space: nowrap;
		}

		.nav-link::before {
			top: auto;
			right: 0.65rem;
			bottom: 0.2rem;
			left: 0.65rem;
			width: auto;
			height: 2px;
		}

		.service-route {
			margin-top: 0;
			margin-left: 0.5rem;
			padding-top: 0;
			padding-left: 0.5rem;
			border-top: 0;
			border-left: 1px solid rgb(153 194 255 / 32%);
		}

		.community-link {
			min-height: 2.75rem;
			margin-top: 0;
			margin-left: clamp(0.65rem, 1.2vw, 1.1rem);
			padding: 0.6rem clamp(0.75rem, 1vw, 1rem);
			white-space: nowrap;
		}
	}

	@media (max-width: 24rem) {
		.brand {
			gap: 0.5rem;
		}

		.brand-mark {
			width: 1.75rem;
			height: 1.875rem;
		}

		.brand-name {
			font-size: 0.82rem;
			line-height: 1.05;
		}

		.brand-campus {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.menu-icon span {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.site-header,
		.primary-nav,
		.service-route,
		.menu-toggle,
		.community-link {
			border-color: CanvasText;
		}

		.nav-link.current::before {
			background: Highlight;
		}

		.primary-nav .nav-link:focus-visible {
			outline: 3px solid Highlight;
			outline-offset: 3px;
			box-shadow: none;
		}
	}
</style>
