<script>
	import { resolve } from '$app/paths';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';
	import { PBL_CATALOG } from '$lib/pbl/catalog.js';
</script>

<svelte:head>
	<title>Workshops | {clubContent.name}</title>
	<meta
		name="description"
		content="Live programming workshops from Marianopolis Programming Club. The old workshop archive stays available."
	/>
</svelte:head>

<section class="pbl-page surface-paper editorial-page">
	<div class="page-container pbl-frame editorial-frame">
		<SectionIntro
			title="Workshops"
			summary="Build one program together in the browser. No install. The older slide decks stay in the archive."
		/>

		<ul class="pbl-list" aria-label="Current workshops">
			{#each PBL_CATALOG as workshop (workshop.id)}
				<li>
					<article class="pbl-row">
						<div class="pbl-copy">
							<p class="series">{workshop.series}</p>
							<h2>{workshop.title}</h2>
							<p>{workshop.summary}</p>
							<p class="duration">{workshop.duration}</p>
						</div>
						<a class="ruled-link" href={resolve(workshop.href, {})}>
							<span>Open {workshop.series}</span>
							<span aria-hidden="true">→</span>
						</a>
					</article>
				</li>
			{/each}
		</ul>

		<nav class="archive-link" aria-label="Workshop archive">
			<a class="quiet-link" href={resolve('/our-workshops', {})}>
				Workshop archive <span aria-hidden="true">→</span>
			</a>
		</nav>
	</div>
</section>

<style>
	.pbl-frame {
		gap: clamp(2.75rem, 7vw, 5.5rem);
	}

	.pbl-list {
		margin: 0;
		padding: 0;
		border-block: var(--rule-strong);
		list-style: none;
	}

	.pbl-row {
		display: grid;
		min-width: 0;
		padding-block: var(--space-lg);
		gap: var(--space-md);
	}

	.pbl-copy {
		display: grid;
		gap: var(--space-xs);
	}

	.series,
	.duration {
		color: var(--club-blue);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.duration {
		color: var(--quiet-steel);
	}

	.pbl-copy h2 {
		max-width: 18ch;
		font-size: var(--text-2xl);
	}

	.pbl-copy p:not(.series):not(.duration) {
		max-width: 42rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.55;
	}

	.archive-link {
		padding-block-end: var(--space-lg);
	}

	@media (min-width: 52rem) {
		.pbl-row {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: end;
		}
	}
</style>
