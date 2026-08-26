<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_LINE, MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { TOOL_SECTIONS } from '$lib/maritools/tools-nav.js';
	import '$lib/maritools/styles/index-pages.css';

	const today = new Date();
	const dayNumber = today.getDate();
</script>

<svelte:head>
	<title>{MARITOOLS_NAME}</title>
	<meta name="description" content={MARITOOLS_LINE} />
</svelte:head>

<section class="mt-index-page mt-tools-home">
	<div class="mt-home-intro">
		<div>
			<h1>Six useful places.<br />One readable semester.</h1>
			<p>{MARITOOLS_LINE}</p>
		</div>
		<aside class="mt-today-ticket" aria-label="Today">
			<span>Today</span>
			<strong>{dayNumber}</strong>
			<p>Schedule, free time, courses, and campus life in one place.</p>
		</aside>
	</div>

	<div class="mt-tool-index">
		{#each TOOL_SECTIONS as section (section.id)}
			<div class="mt-tool-group">
				<h2>{section.title}</h2>
				<p>{section.blurb}</p>
			</div>
			{#each section.items as item (item.href)}
				<a href={resolve(item.href, {})}>
					<b>{item.label}</b>
					<span>{item.summary}</span>
					<i>Open →</i>
				</a>
			{/each}
		{/each}
	</div>
</section>
