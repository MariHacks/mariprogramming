<script>
	import { errorContent } from '$lib/content';
	import { page } from '$app/stores';
	import SeeAlso from '$lib/components/SeeAlso.svelte';

	const { metaDesc, intro, info, contact, seeAlsoLinks } = errorContent;
</script>

<svelte:head>
	<meta name="description" content={metaDesc} />
	<title>{$page.status}: {$page.error?.message} | Programming Club</title>
</svelte:head>

<h2 class="alert alert-danger w-100 text-center">{$page.status}: {$page.error?.message}</h2>

<div class="px-5 py-3 text-body">
	<p>{intro}</p>
	<p>{info}</p>
	<ul class="d-flex flex-column gap-2">
		{#each Object.entries(contact) as [platform, contactInfo]}
			<li>{platform}: {contactInfo}</li>
		{/each}
	</ul>
</div>

<SeeAlso bg="light-gray" topSpacing {seeAlsoLinks} />
