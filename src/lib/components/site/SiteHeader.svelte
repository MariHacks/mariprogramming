<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { endStaffSession } from '$lib/auth/staff-sign-out.js';
	import { clubContent, isExternalSignupUrl } from '$lib/content/club';
	import { createClubContactLinks } from '$lib/club-contact.js';
	import { resolvePblHeaderLabel } from '$lib/pbl/catalog.js';
	import SocialIcon from './SocialIcon.svelte';

	/** @type {string} */
	export let pathname;

	/** Compact IDE-density header on /pbl routes; expands on hover / focus-within. */
	/** @type {boolean} */
	export let compactPbl = false;

	/** @type {import('$lib/maritools/header-account.js').ReturnType<typeof import('$lib/maritools/header-account.js').headerAccountView>} */
	export let headerAccount = { kind: 'signed-out' };

	const primaryLinks = [
		{ label: 'About', href: '/about-us', external: false },
		{ label: 'Events', href: '/events', external: false },
		{ label: 'Workshops', href: '/pbl', external: false },
		{ label: 'MariTools', href: '/tools', external: false }
	];
	const statusLinks = [{ label: 'Workshop archive', href: '/our-workshops', external: false }];
	const compactLinks = primaryLinks.slice(0, 3);
	const moreLinks = [
		...primaryLinks.slice(3),
		...statusLinks,
		{ label: 'MariHacks', href: 'https://www.marihacks.com/', external: true }
	];
	const mobileLinks = [
		...primaryLinks,
		...statusLinks,
		{ label: 'MariHacks', href: 'https://www.marihacks.com/', external: true }
	];
	const headerSocialLinks = clubContent.socialLinks.filter(({ label }) =>
		['Instagram', 'Discord'].includes(label)
	);
	const contactLinks = createClubContactLinks();

	let mobileOpen = false;
	let moreOpen = false;
	let accountMenuOpen = false;
	let previousPathname = pathname;
	$: pblHeaderLabel = resolvePblHeaderLabel(pathname);
	/** @type {HTMLButtonElement} */
	let mobileButton;
	/** @type {HTMLButtonElement} */
	let moreButton;
	/** @type {HTMLElement} */
	let mobileRoot;
	/** @type {HTMLElement} */
	let compactRoot;

	$: if (pathname !== previousPathname) {
		previousPathname = pathname;
		mobileOpen = false;
		moreOpen = false;
		accountMenuOpen = false;
	}

	async function signOut() {
		await endStaffSession();
		accountMenuOpen = false;
		closeDisclosures();
		await invalidateAll();
		await goto(resolve('/', {}));
	}

	function toggleAccountMenu() {
		accountMenuOpen = !accountMenuOpen;
	}

	/** @param {string} href */
	function isCurrent(href) {
		if (href.startsWith('http') || href.includes('?')) return false;
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key !== 'Escape') return;
		if (moreOpen) {
			moreOpen = false;
			moreButton.focus();
		} else if (accountMenuOpen) {
			accountMenuOpen = false;
		} else if (mobileOpen) {
			mobileOpen = false;
			mobileButton.focus();
		}
	}

	/** @param {PointerEvent} event */
	function handleOutsidePointer(event) {
		if (!(event.target instanceof Node)) return;
		if (moreOpen && !compactRoot.contains(event.target)) moreOpen = false;
		if (accountMenuOpen && !event.target.closest('.account-demo')) accountMenuOpen = false;
		if (mobileOpen && !mobileRoot.contains(event.target)) mobileOpen = false;
	}

	function closeDisclosures() {
		mobileOpen = false;
		moreOpen = false;
		accountMenuOpen = false;
	}
</script>

<svelte:window on:keydown={handleKeydown} />
<svelte:document on:pointerdown={handleOutsidePointer} />

<header
	class="site-header"
	class:is-compact-pbl={compactPbl}
	data-shell-version="editorial"
	data-compact-pbl={compactPbl ? 'true' : 'false'}
>
	<div class="header-frame">
		<a
			class="brand header-cluster-left"
			href={resolve('/', {})}
			aria-label="Marianopolis Programming Club, home"
			on:click={closeDisclosures}
		>
			<img class="brand-mark" src="/logo-icon.svg" alt="" width="173" height="182" />
			<span class="brand-name">
				<span>Marianopolis</span>
				<span>Programming Club</span>
			</span>
		</a>

		{#if compactPbl}
			<p class="pbl-context" data-pbl-context aria-hidden="true">{pblHeaderLabel}</p>
		{/if}

		<nav class="wide-navigation" aria-label="Primary navigation" data-navigation-mode="wide">
			<ul class="navigation-list">
				{#each primaryLinks as link (link.href)}
					<li class:pbl-morph-slot={link.href === '/pbl'}>
						<a
							class:current={isCurrent(link.href)}
							class="navigation-link"
							class:pbl-morph-target={link.href === '/pbl'}
							data-pbl-morph={link.href === '/pbl' ? 'workshops' : undefined}
							href={resolve(link.href, {})}
							aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="compact-shell" bind:this={compactRoot}>
			<nav
				class="compact-navigation"
				aria-label="Compact navigation"
				data-navigation-mode="compact"
			>
				<ul class="navigation-list">
					{#each compactLinks as link (link.href)}
						<li class:pbl-morph-slot={link.href === '/pbl'}>
							<a
								class:current={isCurrent(link.href)}
								class="navigation-link"
								class:pbl-morph-target={link.href === '/pbl'}
								data-pbl-morph={link.href === '/pbl' ? 'workshops' : undefined}
								href={resolve(link.href, {})}
								aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a
							>
						</li>
					{/each}
					<li class="more-item">
						<button
							bind:this={moreButton}
							class:current={moreLinks.some(({ href }) => isCurrent(href))}
							class="disclosure-button"
							type="button"
							aria-expanded={moreOpen}
							aria-controls="compact-more-menu"
							on:click={() => (moreOpen = !moreOpen)}
						>
							More
							<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg>
						</button>
						<div
							id="compact-more-menu"
							class="more-menu"
							data-open={moreOpen}
							aria-hidden={moreOpen ? undefined : 'true'}
						>
							{#each moreLinks as link (link.href)}
								{#if link.external}
									<a
										class="menu-link"
										href={link.href}
										target="_blank"
										rel="external noopener noreferrer"
										tabindex={moreOpen ? undefined : -1}
										on:click={closeDisclosures}>{link.label}</a
									>
								{:else}
									<a
										class:current={isCurrent(link.href)}
										class="menu-link"
										href={resolve(link.href, {})}
										aria-current={isCurrent(link.href) ? 'page' : undefined}
										tabindex={moreOpen ? undefined : -1}
										on:click={closeDisclosures}>{link.label}</a
									>
								{/if}
							{/each}
						</div>
					</li>
				</ul>
			</nav>
		</div>

		<div class="mobile-shell" bind:this={mobileRoot}>
			<button
				bind:this={mobileButton}
				class="mobile-toggle"
				type="button"
				aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
				aria-expanded={mobileOpen}
				aria-controls="mobile-navigation"
				on:click={() => (mobileOpen = !mobileOpen)}
			>
				<span aria-hidden="true">{mobileOpen ? 'Close' : 'Menu'}</span>
				<svg viewBox="0 0 16 16" aria-hidden="true">
					{#if mobileOpen}<path d="m3 3 10 10M13 3 3 13" />{:else}<path d="M2 5h12M2 11h12" />{/if}
				</svg>
			</button>

			<nav
				id="mobile-navigation"
				class="mobile-navigation"
				aria-label="Mobile navigation"
				data-navigation-mode="mobile"
				data-open={mobileOpen}
				aria-hidden={mobileOpen ? undefined : 'true'}
			>
				<ul class="mobile-list">
					{#each mobileLinks as link (`${link.label}-${link.href}`)}
						<li>
							{#if link.external}
								<a
									class="menu-link"
									href={link.href}
									target="_blank"
									rel="external noopener noreferrer"
									tabindex={mobileOpen ? undefined : -1}
									on:click={closeDisclosures}>{link.label}</a
								>
							{:else}
								<a
									class:current={isCurrent(link.href)}
									class="menu-link"
									href={resolve(link.href, {})}
									aria-current={isCurrent(link.href) ? 'page' : undefined}
									tabindex={mobileOpen ? undefined : -1}
									on:click={closeDisclosures}>{link.label}</a
								>
							{/if}
						</li>
					{/each}
					<li>
						<a
							class="menu-link"
							href={contactLinks.bug.href}
							rel="external"
							tabindex={mobileOpen ? undefined : -1}>{contactLinks.bug.label}</a
						>
					</li>
					<li>
						<a
							class="menu-link"
							href={contactLinks.inquiry.href}
							rel="external"
							aria-label={contactLinks.inquiry.label}
							tabindex={mobileOpen ? undefined : -1}
						>
							<SocialIcon name="Mail" />
						</a>
					</li>
					<li>
						{#if headerAccount.kind === 'signed-in'}
							<a
								class="menu-link"
								href={resolve('/tools/account', {})}
								tabindex={mobileOpen ? undefined : -1}
								on:click={closeDisclosures}>Account</a
							>
						{:else if isExternalSignupUrl()}
							<a
								class="menu-link"
								href={clubContent.signupUrl}
								target="_blank"
								rel="external noopener noreferrer"
								tabindex={mobileOpen ? undefined : -1}
								on:click={closeDisclosures}>Sign up</a
							>
						{:else}
							<a
								class="menu-link"
								href={resolve(clubContent.signupUrl, {})}
								tabindex={mobileOpen ? undefined : -1}
								on:click={closeDisclosures}>Sign up</a
							>
						{/if}
					</li>
				</ul>
			</nav>
		</div>

		<div class="header-actions header-cluster-right">
			<nav class="header-contact" aria-label="Club contact">
				<a href={contactLinks.bug.href} rel="external">{contactLinks.bug.label}</a>
			</nav>

			<div class="header-socials" aria-label="Club social links">
				<a
					class="social-link"
					href={contactLinks.inquiry.href}
					rel="external"
					aria-label={contactLinks.inquiry.label}
				>
					<SocialIcon name="Mail" />
				</a>
				{#each headerSocialLinks as link (link.label)}
					<a
						class="social-link"
						href={link.url}
						aria-label={link.label}
						target="_blank"
						rel="external noopener noreferrer"><SocialIcon name={link.label} /></a
					>
				{/each}
			</div>

			<div class="account-demo" class:signed-in={headerAccount.kind === 'signed-in'}>
				{#if headerAccount.kind === 'signed-out'}
					{#if isExternalSignupUrl()}
						<a
							class="signup-link"
							href={clubContent.signupUrl}
							target="_blank"
							rel="external noopener noreferrer"
							on:click={closeDisclosures}>Sign up</a
						>
					{:else}
						<a
							class="signup-link"
							href={resolve(clubContent.signupUrl, {})}
							on:click={closeDisclosures}>Sign up</a
						>
					{/if}
				{:else}
					<button
						class="identity-button"
						type="button"
						aria-expanded={accountMenuOpen}
						aria-controls="account-menu"
						on:click={toggleAccountMenu}
					>
						<span class="identity-avatar">
							{#if headerAccount.profileImageDataUrl}
								<img src={headerAccount.profileImageDataUrl} alt="" />
							{:else}
								{headerAccount.initials}
							{/if}
						</span><b>{headerAccount.displayName}</b><svg viewBox="0 0 12 12" aria-hidden="true"
							><path d="m2.5 4.5 3.5 3 3.5-3" /></svg
						>
					</button>
					<div class="account-menu" id="account-menu" hidden={!accountMenuOpen}>
						<a href={resolve('/tools/account', {})} on:click={closeDisclosures}>Your account</a>
						<button type="button" on:click={signOut}>Sign out</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>

<style>
	.site-header {
		position: relative;
		z-index: 30;
		height: 4.5rem;
		border-bottom: 1px solid rgb(var(--midnight-rgb) / 20%);
		background: #fff;
		color: var(--midnight);
	}

	.header-frame {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		width: 100%;
		max-width: 90rem;
		height: 100%;
		margin-inline: auto;
		padding-inline: clamp(1rem, 4.6vw, 3rem);
		gap: clamp(0.4rem, 1vw, 1rem);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		min-width: 0;
		min-height: 2.75rem;
		gap: 0.75rem;
		color: inherit;
		text-decoration: none;
	}

	.brand-mark {
		width: 1.85rem;
		height: 1.95rem;
		object-fit: contain;
		filter: brightness(0) saturate(100%) invert(11%) sepia(28%) saturate(1700%) hue-rotate(180deg)
			brightness(90%) contrast(100%);
	}

	.brand-name {
		display: grid;
		font-family: var(--font-display);
		font-size: 0.875rem;
		font-weight: 650;
		letter-spacing: -0.025em;
		line-height: 1.05;
	}

	.wide-navigation {
		justify-self: center;
	}

	.navigation-list,
	.mobile-list {
		display: flex;
		align-items: center;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.navigation-link,
	.disclosure-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.65rem clamp(0.45rem, 0.75vw, 0.8rem);
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}

	.navigation-link::after,
	.disclosure-button::after {
		position: absolute;
		right: 0.6rem;
		bottom: 0.25rem;
		left: 0.6rem;
		height: 2px;
		background: transparent;
		content: '';
	}

	.navigation-link:hover,
	.disclosure-button:hover,
	.navigation-link.current,
	.disclosure-button.current {
		color: var(--club-blue);
	}

	.navigation-link.current::after,
	.disclosure-button.current::after {
		background: currentColor;
	}

	.compact-shell,
	.mobile-shell {
		display: none;
	}

	.more-item,
	.mobile-shell {
		position: relative;
	}

	.disclosure-button {
		gap: 0.3rem;
	}

	.disclosure-button svg {
		width: 0.75rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: square;
		stroke-width: 1.4;
	}

	.more-menu,
	.mobile-navigation {
		position: absolute;
		top: calc(100% + 0.875rem);
		right: 0;
		display: grid;
		min-width: 14rem;
		border: 1px solid rgb(var(--midnight-rgb) / 24%);
		background: #fff;
		box-shadow: 0 1rem 2.5rem rgb(var(--midnight-rgb) / 14%);
		opacity: 0;
		pointer-events: none;
		transform: translateY(-0.35rem);
		visibility: hidden;
		transition:
			opacity var(--motion-fast) var(--ease-out),
			transform var(--motion-fast) var(--ease-out),
			visibility 0s linear var(--motion-fast);
	}

	.more-menu[data-open='true'],
	.mobile-navigation[data-open='true'] {
		opacity: 1;
		pointer-events: auto;
		transform: none;
		visibility: visible;
		transition-delay: 0s;
	}

	.menu-link {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid rgb(var(--midnight-rgb) / 14%);
		color: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
	}

	.menu-link:last-child {
		border-bottom: 0;
	}

	.menu-link:hover,
	.menu-link.current {
		background: var(--mist);
		color: var(--club-blue);
	}

	.header-actions {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-self: end;
		flex: 0 0 auto;
		gap: 0.15rem;
	}

	.header-contact {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		padding-inline-end: 0.15rem;
	}

	.header-contact a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: inherit;
		font-size: 0.75rem;
		font-weight: 650;
		text-decoration: none;
		white-space: nowrap;
	}

	.header-contact a:hover {
		color: var(--club-blue);
	}

	.header-socials {
		display: flex;
		align-items: center;
	}

	.social-link {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		color: inherit;
		place-items: center;
	}

	.social-link:hover {
		color: var(--club-blue);
	}

	.account-demo {
		position: relative;
		display: flex;
		align-items: center;
	}

	.identity-button {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid rgb(var(--midnight-rgb) / 18%);
		border-radius: 999px;
		background: #fff;
		color: inherit;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 650;
		gap: 0.45rem;
		cursor: pointer;
	}

	.identity-avatar {
		display: grid;
		width: 1.65rem;
		height: 1.65rem;
		overflow: hidden;
		border-radius: 999px;
		background: var(--mist);
		color: var(--midnight);
		font-size: 0.625rem;
		font-weight: 700;
		place-items: center;
	}

	.identity-avatar img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.identity-button svg {
		width: 0.75rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: square;
		stroke-width: 1.4;
	}

	.account-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		display: grid;
		min-width: 11rem;
		border: 1px solid rgb(var(--midnight-rgb) / 24%);
		background: #fff;
		box-shadow: 0 1rem 2.5rem rgb(var(--midnight-rgb) / 14%);
	}

	.account-menu[hidden] {
		display: none;
	}

	.account-menu a,
	.account-menu button {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.7rem 1rem;
		border: 0;
		border-bottom: 1px solid rgb(var(--midnight-rgb) / 14%);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.account-menu button:last-child,
	.account-menu a:last-child {
		border-bottom: 0;
	}

	.account-menu a:hover,
	.account-menu button:hover {
		background: var(--mist);
		color: var(--club-blue);
	}

	.signup-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.7rem 1.05rem;
		border: 1px solid var(--club-blue);
		border-radius: 0;
		background: var(--club-blue);
		color: #fff;
		font-size: 0.8125rem;
		font-weight: 650;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		margin-inline-start: 0.45rem;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			border-color var(--motion-fast) var(--ease-out),
			border-radius var(--motion-fast) var(--ease-out);
	}

	.signup-link:hover {
		border-color: var(--midnight);
		background: var(--midnight);
	}

	.mobile-toggle {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.6rem 0.75rem;
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		gap: 0.5rem;
		cursor: pointer;
	}

	.mobile-toggle svg {
		width: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: square;
		stroke-width: 1.4;
	}

	@media (min-width: 43.75rem) and (max-width: 63.999rem) {
		.header-frame {
			grid-template-columns: auto minmax(0, 1fr) auto;
			padding-inline: 1.25rem;
			gap: 0.25rem;
		}

		.wide-navigation {
			display: none;
		}

		.compact-shell,
		.compact-navigation {
			display: block;
		}

		.compact-shell {
			justify-self: center;
		}
	}

	@media (max-width: 43.749rem) {
		.site-header {
			height: 4.25rem;
		}

		.header-frame {
			grid-template-columns: minmax(0, 1fr) auto auto;
			padding-inline: 1rem;
		}

		.brand-mark {
			width: 1.7rem;
			height: 1.8rem;
		}

		.brand-name {
			font-size: 0.72rem;
		}

		.wide-navigation,
		.compact-shell,
		.header-contact,
		.header-socials {
			display: none;
		}

		.mobile-shell {
			display: block;
		}

		.signup-link {
			padding-inline: 0.8rem;
		}

		.identity-button b {
			display: none;
		}

		.mobile-navigation {
			top: calc(100% + 0.7rem);
			right: -4.9rem;
			width: min(calc(100vw - 2rem), 22rem);
		}

		.mobile-list {
			display: grid;
		}
	}

	@media (max-width: 23.5rem) {
		.header-frame {
			gap: 0.35rem;
		}

		.brand {
			gap: 0.45rem;
		}

		.brand-mark {
			width: 1.55rem;
			height: 1.65rem;
			flex: 0 0 auto;
		}

		.brand-name {
			min-width: 0;
			font-size: 0.625rem;
			line-height: 1.08;
			white-space: nowrap;
		}

		.mobile-toggle {
			justify-content: center;
			width: 2.75rem;
			padding-inline: 0;
		}

		.mobile-toggle span {
			display: none;
		}

		.signup-link {
			padding-inline: 0.65rem;
		}
	}

	/* Absolute center morph: PBL label <-> Workshops (same slot). */
	.pbl-context {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 3;
		margin: 0;
		max-width: min(36rem, 70vw);
		overflow: hidden;
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.1;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.96);
		visibility: hidden;
		transition:
			opacity var(--pbl-header-motion, 360ms) var(--pbl-header-ease, var(--ease-out)),
			transform var(--pbl-header-motion, 360ms) var(--pbl-header-ease, var(--ease-out)),
			visibility 0s linear var(--pbl-header-motion, 360ms);
	}

	.site-header.is-compact-pbl {
		--pbl-header-motion: 360ms;
		--pbl-header-ease: cubic-bezier(0.22, 1, 0.36, 1);
		transition:
			height var(--pbl-header-motion) var(--pbl-header-ease),
			border-radius var(--pbl-header-motion) var(--pbl-header-ease);
	}

	.site-header.is-compact-pbl .header-frame {
		overflow: visible;
	}

	.site-header.is-compact-pbl .header-cluster-left,
	.site-header.is-compact-pbl .header-cluster-right,
	.site-header.is-compact-pbl .brand-name,
	.site-header.is-compact-pbl .brand-mark,
	.site-header.is-compact-pbl .wide-navigation .navigation-list > li:not(.pbl-morph-slot),
	.site-header.is-compact-pbl .compact-navigation .navigation-list > li:not(.pbl-morph-slot),
	.site-header.is-compact-pbl .header-contact,
	.site-header.is-compact-pbl .header-socials,
	.site-header.is-compact-pbl .navigation-link,
	.site-header.is-compact-pbl .disclosure-button,
	.site-header.is-compact-pbl .signup-link,
	.site-header.is-compact-pbl .identity-button,
	.site-header.is-compact-pbl .pbl-morph-target {
		transition:
			opacity var(--pbl-header-motion) var(--pbl-header-ease),
			transform var(--pbl-header-motion) var(--pbl-header-ease),
			visibility 0s linear 0s,
			min-height var(--pbl-header-motion) var(--pbl-header-ease),
			padding var(--pbl-header-motion) var(--pbl-header-ease),
			width var(--pbl-header-motion) var(--pbl-header-ease),
			height var(--pbl-header-motion) var(--pbl-header-ease),
			max-width var(--pbl-header-motion) var(--pbl-header-ease),
			max-height var(--pbl-header-motion) var(--pbl-header-ease),
			gap var(--pbl-header-motion) var(--pbl-header-ease),
			font-size var(--pbl-header-motion) var(--pbl-header-ease),
			margin var(--pbl-header-motion) var(--pbl-header-ease),
			border-radius var(--pbl-header-motion) var(--pbl-header-ease);
	}

	.site-header.is-compact-pbl .header-cluster-left {
		transform-origin: right center;
	}

	.site-header.is-compact-pbl .header-cluster-right {
		transform-origin: left center;
	}

	.site-header.is-compact-pbl .wide-navigation .navigation-list > li:first-child,
	.site-header.is-compact-pbl .wide-navigation .navigation-list > li:nth-child(2),
	.site-header.is-compact-pbl .compact-navigation .navigation-list > li:first-child {
		transform-origin: right center;
	}

	.site-header.is-compact-pbl .wide-navigation .navigation-list > li:last-child,
	.site-header.is-compact-pbl .compact-navigation .more-item,
	.site-header.is-compact-pbl .header-contact,
	.site-header.is-compact-pbl .header-socials {
		transform-origin: left center;
	}

	/*
	 * Collapsed PBL chrome: fine-pointer hover devices only.
	 * Touch / coarse pointers and small breakpoints stay on the full header
	 * so navigation is never hover-trapped (mobile keeps the existing menu).
	 *
	 * Collapsed = elements pulled toward the center morph pivot + scaled down;
	 * Workshops is absolute-centered (hidden) under the PBL name for the crossfade.
	 * Expand (hover/focus-within) = radiate outward (translate away + scale up)
	 * while PBL fades out and Workshops settles into its normal nav flex slot.
	 */
	@media (hover: hover) and (pointer: fine) {
		/*
		 * Morph slot stays in normal flex flow. Workshops is only absolutely
		 * centered while collapsed; on expand it returns to this slot so it
		 * sits between Events and MariTools with no overlap.
		 */
		.site-header.is-compact-pbl .wide-navigation .pbl-morph-slot,
		.site-header.is-compact-pbl .compact-navigation .pbl-morph-slot {
			position: static;
			z-index: 2;
			flex: 0 0 auto;
		}

		/* Expanded default: Workshops in-flow (nav-link already position:relative). */
		.site-header.is-compact-pbl .wide-navigation .pbl-morph-target,
		.site-header.is-compact-pbl .compact-navigation .pbl-morph-target {
			position: relative;
			top: auto;
			left: auto;
			z-index: 2;
			transform: none;
			transform-origin: center center;
			/* Opacity-only morph: position/transform snap so expand cannot leave a centered ghost. */
			transition:
				opacity var(--pbl-header-motion) var(--pbl-header-ease),
				visibility 0s linear 0s;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) {
			height: 2rem;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .header-frame {
			align-items: center;
			align-content: center;
			/* Even top/bottom breathing room inside the 2rem IDE bar. */
			padding-block: 0.2rem;
		}

		/* Left cluster: tiny home mark, tucked toward the pivot. */
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .header-cluster-left {
			min-height: 0;
			height: 1.25rem;
			gap: 0;
			align-self: center;
			transform: translateX(2.75rem) scale(0.88);
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .brand-name {
			max-width: 0;
			margin: 0;
			opacity: 0;
			overflow: hidden;
			transform: translateX(-0.25rem) scale(0.9);
			visibility: hidden;
			transition:
				opacity var(--pbl-header-motion) var(--pbl-header-ease),
				transform var(--pbl-header-motion) var(--pbl-header-ease),
				max-width var(--pbl-header-motion) var(--pbl-header-ease),
				visibility 0s linear var(--pbl-header-motion);
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .brand-mark {
			display: block;
			width: 0.9375rem;
			height: 1rem;
			object-fit: contain;
			overflow: visible;
		}

		/* Center morph: show PBL name; hide Workshops in the same slot. */
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .pbl-context {
			top: 50%;
			margin: 0;
			line-height: 1;
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
			visibility: visible;
			transition-delay: 0s;
		}

		/* Collapsed only: park Workshops on the absolute center for the PBL crossfade. */
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .pbl-morph-target {
			position: absolute;
			top: 50%;
			left: 50%;
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.94);
			visibility: hidden;
			pointer-events: none;
			transition:
				opacity var(--pbl-header-motion) var(--pbl-header-ease),
				visibility 0s linear var(--pbl-header-motion);
		}

		/* Nav wings collapse into the pivot (About/Events from left, MariTools from right). */
		.site-header.is-compact-pbl:not(:hover):not(:focus-within)
			.wide-navigation
			.navigation-list
			> li:not(.pbl-morph-slot) {
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			transition:
				opacity var(--pbl-header-motion) var(--pbl-header-ease),
				transform var(--pbl-header-motion) var(--pbl-header-ease),
				visibility 0s linear var(--pbl-header-motion);
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within)
			.wide-navigation
			.navigation-list
			> li:first-child {
			transform: translateX(3.25rem) scale(0.85);
			transition-delay: 0ms;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within)
			.wide-navigation
			.navigation-list
			> li:nth-child(2) {
			transform: translateX(1.75rem) scale(0.85);
			transition-delay: 30ms;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within)
			.wide-navigation
			.navigation-list
			> li:last-child {
			transform: translateX(-3.25rem) scale(0.85);
			transition-delay: 30ms;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within)
			.compact-navigation
			.navigation-list
			> li:not(.pbl-morph-slot) {
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within)
			.compact-navigation
			.navigation-list
			> li:first-child {
			transform: translateX(2.5rem) scale(0.85);
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .compact-navigation .more-item {
			transform: translateX(-2.5rem) scale(0.85);
		}

		/* Right utilities (except account control) fold into the pivot. */
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .header-contact,
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .header-socials {
			opacity: 0;
			transform: translateX(-2.5rem) scale(0.85);
			visibility: hidden;
			pointer-events: none;
			max-width: 0;
			max-height: 0;
			height: 0;
			min-height: 0;
			overflow: hidden;
			margin: 0;
			padding: 0;
			transition:
				opacity var(--pbl-header-motion) var(--pbl-header-ease),
				transform var(--pbl-header-motion) var(--pbl-header-ease),
				max-width var(--pbl-header-motion) var(--pbl-header-ease),
				max-height var(--pbl-header-motion) var(--pbl-header-ease),
				visibility 0s linear var(--pbl-header-motion);
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .header-cluster-right {
			align-self: center;
			align-items: center;
			min-height: 0;
			height: 1.25rem;
			transform: translateX(-1.75rem) scale(0.94);
			gap: 0;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .navigation-link,
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .disclosure-button,
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .header-contact a {
			min-height: 0;
			height: 1.25rem;
			padding-block: 0;
			line-height: 1;
		}

		/* Compact chip: text-sm type, tight padding, fits ~28-32px bar. */
		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .signup-link {
			align-self: center;
			min-height: 0;
			height: 1.25rem;
			padding: 0 0.55rem;
			margin-inline-start: 0;
			border-radius: 999px;
			font-size: 0.75rem;
			font-weight: 650;
			line-height: 1;
			transform: scale(0.96);
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .identity-button {
			align-self: center;
			min-height: 0;
			height: 1.25rem;
			padding: 0 0.35rem 0 0;
			gap: 0.3rem;
			font-size: 0.75rem;
			line-height: 1;
			overflow: hidden;
		}

		.site-header.is-compact-pbl:not(:hover):not(:focus-within) .identity-avatar {
			width: 1.25rem;
			height: 1.25rem;
			font-size: 0.5rem;
			flex: 0 0 auto;
			overflow: hidden;
		}

		/* Expanded: stagger wings slightly as they radiate out from center. */
		.site-header.is-compact-pbl:is(:hover, :focus-within) .header-cluster-left {
			transition-delay: 0ms;
		}

		.site-header.is-compact-pbl:is(:hover, :focus-within)
			.wide-navigation
			.navigation-list
			> li:first-child {
			transition-delay: 16ms;
		}

		.site-header.is-compact-pbl:is(:hover, :focus-within)
			.wide-navigation
			.navigation-list
			> li:nth-child(2) {
			transition-delay: 28ms;
		}

		.site-header.is-compact-pbl:is(:hover, :focus-within)
			.wide-navigation
			.navigation-list
			> li:last-child {
			transition-delay: 28ms;
		}

		.site-header.is-compact-pbl:is(:hover, :focus-within) .header-cluster-right,
		.site-header.is-compact-pbl:is(:hover, :focus-within) .header-contact,
		.site-header.is-compact-pbl:is(:hover, :focus-within) .header-socials {
			transition-delay: 16ms;
		}

		/* Expanded: force Workshops back into the nav flex slot (no absolute center). */
		.site-header.is-compact-pbl:is(:hover, :focus-within) .wide-navigation .pbl-morph-target,
		.site-header.is-compact-pbl:is(:hover, :focus-within) .compact-navigation .pbl-morph-target {
			position: relative;
			top: auto;
			left: auto;
			transform: none;
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
		}
	}

	@media (max-width: 43.749rem) {
		.site-header.is-compact-pbl .pbl-context {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.more-menu,
		.mobile-navigation,
		.signup-link,
		.site-header.is-compact-pbl,
		.site-header.is-compact-pbl .header-cluster-left,
		.site-header.is-compact-pbl .header-cluster-right,
		.site-header.is-compact-pbl .brand-name,
		.site-header.is-compact-pbl .brand-mark,
		.site-header.is-compact-pbl .wide-navigation .navigation-list > li,
		.site-header.is-compact-pbl .compact-navigation .navigation-list > li,
		.site-header.is-compact-pbl .header-contact,
		.site-header.is-compact-pbl .header-socials,
		.site-header.is-compact-pbl .navigation-link,
		.site-header.is-compact-pbl .signup-link,
		.site-header.is-compact-pbl .identity-button,
		.site-header.is-compact-pbl .pbl-morph-target,
		.pbl-context {
			transition-duration: 1ms !important;
			transition-delay: 0s !important;
		}
	}

	@media (forced-colors: active) {
		.site-header,
		.more-menu,
		.mobile-navigation,
		.signup-link {
			border-color: CanvasText;
		}

		.signup-link {
			background: ButtonFace;
			color: ButtonText;
		}

		.navigation-link.current::after,
		.disclosure-button.current::after {
			background: Highlight;
		}
	}
</style>
