<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_LINE, MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { TOOL_SECTIONS } from '$lib/maritools/tools-nav.js';
	import '$lib/maritools/styles/index-pages.css';

	const today = new Date();
	const todayIso = today.toISOString().slice(0, 10);
	const todayLabel = today.toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
</script>

<svelte:head>
	<title>{MARITOOLS_NAME}</title>
	<meta name="description" content={MARITOOLS_LINE} />
</svelte:head>

<section class="mt-index-page mt-tools-home">
	<div class="mt-home-intro">
		<h1>{MARITOOLS_NAME}</h1>
		<time class="mt-home-date" datetime={todayIso}>{todayLabel}</time>
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
