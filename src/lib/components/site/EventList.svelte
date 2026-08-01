<script>
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

	/**
	 * @param {number} index
	 * @returns {string}
	 */
	function formatEventIndex(index) {
		return String(index + 1).padStart(2, '0');
	}
</script>

{#if events.length}
	<ul class="event-list" aria-label="Confirmed events">
		{#each events as event, index (event.id)}
			<li>
				<article class="event-record">
					<div class="event-date">
						<p class="card-meta">Event {formatEventIndex(index)}</p>
						<time datetime={event.startsAt}>{formatEventDate(event.startsAt)}</time>
					</div>

					<div class="event-details">
						<p class="confirmation-label">Confirmed</p>
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
		<div class="empty-register">
			<p class="card-meta">Schedule status</p>
			<p class="status-word" aria-hidden="true">Planning</p>
		</div>

		<div class="empty-copy">
			<h3>New events are being planned</h3>
			<p>Dates will appear here after they are confirmed.</p>
			<a
				class="button-secondary"
				href={clubContent.communityAction.url}
				target="_blank"
				rel="noopener noreferrer"
			>
				{clubContent.communityAction.label}
			</a>
		</div>
	</section>
{/if}

<style>
	.event-list {
		display: grid;
		width: 100%;
		min-width: 0;
		margin: 0;
		padding: 0;
		border-block-start: 1px solid var(--color-border-strong);
		list-style: none;
	}

	.event-list > li {
		min-width: 0;
		border-block-end: 1px solid var(--color-border-strong);
	}

	.event-record,
	.empty-state {
		display: grid;
		grid-template-columns: minmax(11rem, 0.68fr) minmax(0, 1.32fr);
		width: 100%;
		min-width: 0;
		border-inline-start: 0.375rem solid var(--sky);
		background: var(--paper);
		color: var(--graphite);
	}

	.event-date,
	.empty-register {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: clamp(1.25rem, 3vw, 2rem);
		background: rgb(153 194 255 / 28%);
		gap: var(--space-xs);
	}

	.event-date time {
		max-width: 19ch;
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.3;
		text-wrap: balance;
	}

	.event-details,
	.empty-copy {
		display: grid;
		align-content: center;
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 2.5rem);
		gap: var(--space-sm);
	}

	.confirmation-label {
		width: fit-content;
		max-width: 100%;
		padding: 0.25rem 0.55rem;
		border: 1px solid rgb(13 33 115 / 32%);
		border-radius: var(--radius-pill);
		background: rgb(153 194 255 / 30%);
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	h3 {
		max-width: 28ch;
		font-size: var(--text-2xl);
		overflow-wrap: anywhere;
	}

	.event-description,
	.empty-copy > p {
		max-width: 54ch;
		line-height: 1.6;
		text-wrap: pretty;
	}

	.empty-state {
		border-block: 1px solid var(--color-border-strong);
		box-shadow: var(--shadow-sm);
	}

	.status-word {
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 600;
		letter-spacing: -0.035em;
		line-height: 1.2;
	}

	.empty-copy .button-secondary {
		justify-self: start;
		margin-block-start: var(--space-xs);
	}

	@media (max-width: 42rem) {
		.event-record,
		.empty-state {
			grid-template-columns: minmax(0, 1fr);
		}

		.event-date,
		.empty-register {
			border-block-end: 1px solid var(--color-border);
		}

		.event-date time {
			max-width: 30ch;
		}
	}
</style>
