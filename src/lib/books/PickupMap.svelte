<script>
	const campusAddress = '4873 Westmount Ave, Westmount, QC H3Y 1X9';
	const campusQuery = encodeURIComponent(campusAddress);
	const mapEmbedUrl = `https://www.google.com/maps?q=${campusQuery}&output=embed`;
	const campusMapUrl = `https://www.google.com/maps/search/?api=1&query=${campusQuery}`;
</script>

<section class="pickup-map" aria-labelledby="pickup-location-title">
	<header class="pickup-map__header">
		<p class="utility-label">Campus pickup</p>
		<h2 id="pickup-location-title">Pickup location</h2>
	</header>

	<div class="map-viewport">
		<iframe
			title="Map centered on Marianopolis College"
			src={mapEmbedUrl}
			loading="lazy"
			referrerpolicy="no-referrer"
		></iframe>
		<p class="map-marker" aria-hidden="true">
			<span></span>
			Wayne's Front Desk
		</p>
	</div>

	<div class="pickup-map__details">
		<div>
			<p class="detail-label">Pickup spot</p>
			<p class="pickup-spot">Wayne's Front Desk</p>
		</div>
		<address>
			<p class="detail-label">Campus address</p>
			<strong>Marianopolis College</strong>
			<span>{campusAddress}</span>
		</address>
	</div>

	<a
		class="campus-map-link"
		href={campusMapUrl}
		target="_blank"
		rel="noreferrer"
		aria-label="Open campus map in a new tab"
	>
		<span>Open campus map</span>
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path d="M5 3h8v8M13 3 4 12" />
		</svg>
	</a>
</section>

<style>
	.pickup-map {
		display: grid;
		min-width: 0;
		padding: clamp(1.25rem, 4vw, 2rem);
		border: 1px solid rgb(5 13 46 / 24%);
		border-block-start: 0.375rem solid var(--sky);
		border-radius: var(--radius-md);
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		color: var(--graphite);
		gap: var(--space-md);
	}

	.pickup-map__header {
		display: grid;
		gap: var(--space-2xs);
	}

	h2,
	p,
	address,
	strong,
	span {
		margin: 0;
	}

	h2 {
		color: var(--midnight);
		font-size: var(--text-xl);
	}

	.map-viewport {
		position: relative;
		min-width: 0;
		min-height: 13rem;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border: 1px solid rgb(5 13 46 / 32%);
		border-radius: var(--radius-xs);
		background: linear-gradient(135deg, rgb(153 194 255 / 66%), transparent 58%), var(--paper);
	}

	iframe {
		display: block;
		width: 100%;
		height: 100%;
		position: absolute;
		inset: 0;
		border: 0;
	}

	.map-marker {
		display: inline-flex;
		align-items: center;
		max-width: calc(100% - 2rem);
		position: absolute;
		inset-block-start: var(--space-sm);
		inset-inline-start: var(--space-sm);
		padding: 0.45rem 0.6rem;
		border: 1px solid rgb(5 13 46 / 34%);
		border-radius: var(--radius-xs);
		background: rgb(247 244 237 / 94%);
		box-shadow: var(--shadow-sm);
		color: var(--midnight);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.05em;
		line-height: 1.3;
		pointer-events: none;
		text-transform: uppercase;
		gap: var(--space-2xs);
	}

	.map-marker span {
		width: 0.6rem;
		height: 0.6rem;
		flex: 0 0 auto;
		border: 1px solid var(--midnight);
		border-radius: var(--radius-pill);
		background: var(--coral);
	}

	.pickup-map__details {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		min-width: 0;
		border-block-start: 1px solid rgb(5 13 46 / 18%);
		gap: var(--space-md);
	}

	.pickup-map__details > div,
	address {
		display: grid;
		min-width: 0;
		padding-block-start: var(--space-sm);
		gap: 0.2rem;
	}

	address {
		border-inline-start: 1px solid rgb(5 13 46 / 18%);
		padding-inline-start: var(--space-md);
		font-style: normal;
	}

	.detail-label {
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	.pickup-spot,
	address strong {
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.2;
	}

	address span {
		color: rgb(24 27 37 / 76%);
		font-size: var(--text-sm);
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.campus-map-link {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		min-height: 2.75rem;
		padding: 0.55rem 0;
		border-block-start: 1px solid rgb(5 13 46 / 18%);
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.3;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
		transition: color var(--motion-fast) var(--ease-out);
	}

	.campus-map-link svg {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.5;
	}

	.campus-map-link:focus-visible {
		outline: 3px solid var(--coral);
		outline-offset: 3px;
		box-shadow: 0 0 0 6px var(--paper);
	}

	@media (hover: hover) and (pointer: fine) {
		.campus-map-link:hover {
			color: var(--midnight);
		}
	}

	@media (max-width: 22rem) {
		.pickup-map {
			padding: var(--space-md);
		}

		.map-viewport {
			min-height: 11rem;
		}

		.pickup-map__details {
			grid-template-columns: 1fr;
			gap: var(--space-sm);
		}

		address {
			border-block-start: 1px solid rgb(5 13 46 / 18%);
			border-inline-start: 0;
			padding-block-start: var(--space-sm);
			padding-inline-start: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.campus-map-link {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.pickup-map,
		.map-viewport,
		.pickup-map__details,
		address,
		.campus-map-link {
			border-color: CanvasText;
		}

		.pickup-map,
		.map-viewport,
		.map-marker {
			background: Canvas;
			color: CanvasText;
		}

		h2,
		.detail-label,
		.pickup-spot,
		address strong,
		address span,
		.campus-map-link {
			color: CanvasText;
		}
	}
</style>
