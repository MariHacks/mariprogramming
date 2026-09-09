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
			summary="Pick a problem. Build one program together in the browser. No install. The older slide decks stay in the archive."
		/>

		<div class="set">
			<div class="set-head">
				<p class="set-kicker">Problem set</p>
				<p class="set-count">{PBL_CATALOG.length} workshop</p>
			</div>
			<table class="set-table">
				<caption class="visually-hidden">Current workshops</caption>
				<thead>
					<tr>
						<th scope="col">#</th>
						<th scope="col">Title</th>
						<th scope="col">Series</th>
						<th scope="col">Length</th>
					</tr>
				</thead>
				<tbody>
					{#each PBL_CATALOG as workshop, index (workshop.id)}
						<tr>
							<td class="num">{index + 1}</td>
							<td>
								<h2>{workshop.title}</h2>
								<p>{workshop.summary}</p>
								<a class="open" href={resolve(workshop.href, {})}>Open {workshop.series}</a>
							</td>
							<td class="series">{workshop.series}</td>
							<td class="length">{workshop.duration}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<nav class="archive-link" aria-label="Workshop archive">
			<a class="quiet-link" href={resolve('/our-workshops', {})}>
				Workshop archive <span aria-hidden="true">→</span>
			</a>
		</nav>
	</div>
</section>

<style>
	.pbl-frame {
		gap: clamp(2rem, 5vw, 3.5rem);
	}

	.set {
		border: var(--rule);
		border-radius: 0.5rem;
		background: #fff;
		overflow: hidden;
	}

	.set-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.85rem 1.1rem;
		border-block-end: var(--rule);
		gap: 0.5rem;
	}

	.set-kicker,
	.set-count,
	.series,
	.length {
		color: var(--quiet-steel);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.set-table {
		width: 100%;
		border-collapse: collapse;
	}

	.set-table th {
		padding: 0.55rem 1.1rem;
		border-block-end: var(--rule);
		color: var(--quiet-steel);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-align: left;
		text-transform: uppercase;
	}

	.set-table td {
		padding: 1rem 1.1rem;
		vertical-align: top;
	}

	.set-table tbody tr:hover {
		background: #f7f9fc;
	}

	.num {
		width: 2.5rem;
		color: var(--quiet-steel);
		font-variant-numeric: tabular-nums;
		font-weight: 650;
	}

	.set-table h2 {
		max-width: 22ch;
		font-size: var(--text-xl);
	}

	.set-table p {
		max-width: 42rem;
		margin-block: 0.35rem 0.7rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.open {
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 700;
		text-decoration: none;
	}

	.open:hover {
		text-decoration: underline;
	}

	.length {
		color: #157347;
		white-space: nowrap;
	}

	.archive-link {
		padding-block-end: var(--space-lg);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 51.99rem) {
		.set-table thead {
			display: none;
		}

		.set-table,
		.set-table tbody,
		.set-table tr,
		.set-table td {
			display: block;
			width: 100%;
		}

		.num,
		.series,
		.length {
			padding-block: 0.15rem;
		}
	}
</style>
