<script>
	/** @type {any[]} */
	export let nodes = [];
	/** @type {any[]} */
	export let edges = [];
</script>

<div role="region" aria-label="Situation diagram">
	{#each nodes as node (node.id)}
		<article class:current={node.data.current}>
			<h3>
				{node.data.title}
				{#if node.data.current}<span>This step</span>{/if}
			</h3>
			{#each node.data.lines as line (line)}
				<p>{line}</p>
			{/each}
		</article>
	{/each}
	{#each edges as edge (edge.id)}
		<span class="flow-edge"></span>
	{/each}
</div>
