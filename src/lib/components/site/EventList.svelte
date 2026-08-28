<script>
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';

	/** @type {Array<{ id: string, startsAt: string, title: string, description?: string }>} */
	export let events = [];

	const eventDateFormatter = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone: 'America/Toronto'
	});

	/**
	 * @param {string} startsAt
	 * @returns {string}
	 */
	function formatEventDate(startsAt) {
		return eventDateFormatter.format(new Date(startsAt));
	}
</script>

{#if events.length}
	<ul class="event-list" aria-label="Confirmed events">
		{#each events as event (event.id)}
			<li>
				<article class="event-record">
					<div class="event-date">
						<time datetime={event.startsAt}>{formatEventDate(event.startsAt)}</time>
					</div>

					<div class="event-details">
						<h3>{event.title}</h3>
						{#if event.description}
							<p class="event-description">{event.description}</p>
						{/if}
					</div>
				</article>
			</li>
		{/each}
	</ul>
{:else}
	<section class="empty-state" aria-label="Event schedule status">
		<div class="empty-copy">
			<h3>No upcoming events are listed.</h3>
			<p>Confirmed dates appear here when published.</p>
		</div>
		<nav class="empty-actions" aria-label="While you wait">
			<a class="empty-action" href={resolve('/our-workshops', {})}>
				<span>Browse workshops</span>
				<span aria-hidden="true">→</span>
			</a>
			<a
				class="empty-action"
				href={clubContent.communityAction.url}
				target="_blank"
				rel="external noopener noreferrer"
			>
				<span>{clubContent.communityAction.label}</span>
				<span aria-hidden="true">↗</span>
			</a>
		</nav>
	</section>
{/if}

<style>
	.event-list {
		width: 100%;
		min-width: 0;
		margin: 0;
		padding: 0;
		border-block: var(--rule-strong);
		list-style: none;
	}

	.event-list > li {
		max-width: none;
		min-width: 0;
	}

	.event-list > li + li {
		border-block-start: var(--rule);
	}

	.event-record {
		display: grid;
		width: 100%;
		min-width: 0;
	}

	.event-date,
	.event-details {
		display: grid;
		align-content: start;
		min-width: 0;
		padding-block: var(--space-md);
	}

	.event-date time {
		max-width: 22ch;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.45;
	}

	.event-details {
		gap: var(--space-xs);
	}

	.event-details h3,
	.empty-state h3 {
		max-width: 30ch;
		font-size: var(--text-xl);
		letter-spacing: -0.025em;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.event-description {
		max-width: 50rem;
		color: var(--quiet-steel);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.empty-state {
		display: grid;
		align-items: start;
		min-width: 0;
		padding-block: var(--space-md);
		border-block: var(--rule-strong);
		gap: var(--space-md);
	}

	.empty-copy {
		display: grid;
		gap: var(--space-xs);
	}

	.empty-copy p {
		max-width: 36rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.empty-actions {
		display: grid;
		justify-items: start;
		gap: var(--space-sm);
	}

	.empty-action {
		display: inline-grid;
		grid-template-columns: minmax(0, auto) max-content;
		align-items: center;
		justify-self: start;
		min-height: var(--control-height);
		padding-block: 0.45rem;
		border-block-end: 1px solid currentColor;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.25;
		text-decoration: none;
		column-gap: var(--space-xs);
		transition:
			border-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.empty-action:hover {
		border-color: var(--midnight);
		color: var(--midnight);
	}

	.empty-action:active {
		transform: translateY(var(--press-distance));
	}

	@media (min-width: 42rem) {
		.event-record {
			grid-template-columns: minmax(10rem, 0.58fr) minmax(0, 1.42fr);
			column-gap: var(--space-lg);
		}

		.event-details {
			padding-inline-start: var(--space-lg);
			border-inline-start: var(--rule);
		}

		.empty-state {
			grid-template-columns: minmax(0, 1fr) max-content;
			align-items: center;
			column-gap: var(--space-lg);
		}
	}
</style>
