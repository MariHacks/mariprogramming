<script>
	const campusAddress = '4873 Westmount Ave, Westmount, QC H3Y 1X9';
	const campusQuery = encodeURIComponent(campusAddress);
	const mapEmbedUrl = `https://www.google.com/maps?q=${campusQuery}&output=embed`;
	const campusMapUrl = `https://www.google.com/maps/search/?api=1&query=${campusQuery}`;
</script>

<section class="pickup-map" aria-labelledby="pickup-location-title">
	<header class="pickup-map__header">
		<h2 id="pickup-location-title">Pickup location</h2>
	</header>

	<div class="map-viewport">
		<iframe
			title="Map to Marianopolis College"
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
			<p class="pickup-spot">Wayne's Front Desk</p>
		</div>
		<address>
			<strong>Marianopolis College</strong>
			<span>{campusAddress}</span>
		</address>
	</div>

	<a
		class="campus-map-link"
		href={campusMapUrl}
		target="_blank"
		rel="noreferrer"
		aria-label="Open in Maps in a new tab"
	>
		<span>Open in Maps</span>
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path d="M5 3h8v8M13 3 4 12" />
		</svg>
	</a>
</section>

<style>
	.pickup-map {
		display: grid;
		min-width: 0;
		padding-block-start: var(--space-md);
		border-block-start: 1px solid rgb(var(--sky-rgb) / 34%);
		color: var(--paper);
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
		color: var(--paper);
		font-size: var(--text-xl);
	}

	.map-viewport {
		position: relative;
		min-width: 0;
		min-height: 11rem;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border: 1px solid rgb(var(--sky-rgb) / 52%);
		background: var(--paper);
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
		border: 1px solid rgb(var(--midnight-rgb) / 34%);
		border-radius: var(--radius-xs);
		background: rgb(var(--paper-rgb) / 94%);
		box-shadow: var(--shadow-sm);
		color: var(--midnight);
		font-family: var(--font-body);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.07em;
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
		border-block-start: 1px solid rgb(var(--sky-rgb) / 34%);
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
		border-inline-start: 1px solid rgb(var(--sky-rgb) / 34%);
		padding-inline-start: var(--space-md);
		font-style: normal;
	}

	.pickup-spot,
	address strong {
		color: var(--paper);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.2;
	}

	address span {
		color: rgb(var(--paper-rgb) / 74%);
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
		border-block-start: 1px solid rgb(var(--sky-rgb) / 34%);
		color: var(--sky);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.3;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
		transition:
			color var(--motion-press) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
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
		outline: 3px solid var(--sky);
		outline-offset: 3px;
	}

	.campus-map-link:active {
		transform: translateY(var(--press-distance));
		transition-duration: 0ms;
	}

	@media (hover: hover) and (pointer: fine) {
		.campus-map-link:hover {
			color: var(--paper);
		}
	}

	@media (max-width: 22rem) {
		.map-viewport {
			min-height: 10rem;
		}

		.pickup-map__details {
			grid-template-columns: 1fr;
			gap: var(--space-sm);
		}

		address {
			border-block-start: 1px solid rgb(var(--sky-rgb) / 34%);
			border-inline-start: 0;
			padding-block-start: var(--space-sm);
			padding-inline-start: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.campus-map-link {
			transition: none;
		}

		.campus-map-link:active {
			transform: none;
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
		.pickup-spot,
		address strong,
		address span,
		.campus-map-link {
			color: CanvasText;
		}
	}
</style>
