<script>
	/** @type {string} */
	export let title;

	/** @type {string | null} */
	export let src = null;

	/** @type {string} */
	export let theme = 'sky';

	/** @type {'compact' | 'card'} */
	export let size = 'card';

	/** @type {boolean} */
	export let decorative = false;

	const coverThemes = ['sky', 'coral', 'midnight', 'paper'];

	$: resolvedTheme = coverThemes.includes(theme) ? theme : 'sky';
	$: resolvedSize = size === 'compact' ? 'compact' : 'card';
	$: coverClass = `book-cover book-cover--${resolvedTheme} book-cover--${resolvedSize}`;
</script>

{#if src}
	<img
		class={coverClass}
		data-theme={resolvedTheme}
		data-size={resolvedSize}
		{src}
		alt={decorative ? '' : `Cover of ${title}`}
		aria-hidden={decorative ? 'true' : undefined}
		loading={decorative || resolvedSize === 'compact' ? 'lazy' : 'eager'}
		decoding="async"
	/>
{:else}
	<div
		class="{coverClass} book-cover--fallback"
		data-theme={resolvedTheme}
		data-size={resolvedSize}
		role={decorative ? undefined : 'img'}
		aria-label={decorative ? undefined : `Cover of ${title}`}
		aria-hidden={decorative ? 'true' : undefined}
	>
		<span class="cover-title">{title}</span>
		<span class="cover-rule" aria-hidden="true"></span>
	</div>
{/if}

<style>
	.book-cover {
		display: block;
		flex: 0 0 auto;
		max-width: 100%;
		aspect-ratio: 2 / 3;
		border: 1px solid var(--cover-border, rgb(var(--midnight-rgb) / 34%));
		border-radius: var(--radius-xs);
		background: var(--cover-background, var(--sky));
		box-shadow:
			0 1px 1px rgb(var(--midnight-rgb) / 16%),
			0 0.45rem 1rem rgb(var(--midnight-rgb) / 14%);
		color: var(--cover-ink, var(--midnight));
		overflow: hidden;
	}

	img.book-cover {
		aspect-ratio: 2 / 3;
		object-fit: cover;
		object-position: center top;
	}

	.book-cover--compact {
		width: 3.25rem;
	}

	.book-cover--card {
		width: clamp(7.5rem, 22vw, 9.75rem);
	}

	.book-cover--fallback {
		position: relative;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		isolation: isolate;
		overflow: hidden;
		padding: 0.8rem 0.8rem 0.8rem 1.25rem;
		gap: 0.65rem;
	}

	.book-cover--fallback::before {
		position: absolute;
		z-index: -1;
		inset-block: 0;
		inset-inline-start: 0;
		width: 0.45rem;
		background: var(--cover-spine, var(--club-blue));
		content: '';
	}

	.book-cover--sky {
		--cover-background: var(--sky);
		--cover-border: rgb(var(--midnight-rgb) / 38%);
		--cover-ink: var(--midnight);
		--cover-spine: var(--club-blue);
	}

	.book-cover--coral {
		--cover-background: var(--club-blue);
		--cover-border: rgb(var(--midnight-rgb) / 42%);
		--cover-ink: var(--paper);
		--cover-spine: var(--sky);
	}

	.book-cover--midnight {
		--cover-background: var(--midnight);
		--cover-border: rgb(var(--midnight-rgb) / 58%);
		--cover-ink: var(--paper);
		--cover-spine: var(--sky);
	}

	.book-cover--paper {
		--cover-background: var(--paper);
		--cover-border: rgb(var(--midnight-rgb) / 38%);
		--cover-ink: var(--midnight);
		--cover-spine: var(--club-blue);
	}

	.cover-title {
		display: -webkit-box;
		align-self: center;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: clamp(0.9rem, 2.8vw, 1.125rem);
		font-weight: 700;
		letter-spacing: -0.035em;
		line-height: 1.08;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		line-clamp: 5;
		-webkit-line-clamp: 5;
	}

	.cover-rule {
		display: block;
		width: 58%;
		height: 0.1875rem;
		background: currentColor;
	}

	.book-cover--compact.book-cover--fallback {
		grid-template-rows: minmax(0, 1fr) auto;
		padding: 0.45rem 0.35rem 0.4rem 0.7rem;
		gap: 0.25rem;
	}

	.book-cover--compact.book-cover--fallback::before {
		width: 0.28rem;
	}

	.book-cover--compact .cover-title {
		font-size: 0.625rem;
		letter-spacing: -0.03em;
		line-height: 1.08;
		line-clamp: 4;
		-webkit-line-clamp: 4;
	}

	.book-cover--compact .cover-rule {
		height: 0.125rem;
	}
</style>
