<script>
	import { Handle, Position } from '@xyflow/svelte';

	let { data } = $props();
</script>

<article class="card" class:current={data.current}>
	{#if data.hasIn}
		<Handle type="target" position={Position.Top} />
	{/if}
	<h3>
		{data.title}
		{#if data.current}<span>This step</span>{/if}
	</h3>
	{#each data.lines as line (line)}
		<p>{line}</p>
	{/each}
	{#if data.hasOut}
		<Handle type="source" position={Position.Bottom} />
	{/if}
</article>

<style>
	.card {
		width: 100%;
		box-sizing: border-box;
		padding: 0.55rem 0.7rem 0.65rem;
		border: 1px solid rgb(15 23 42 / 14%);
		border-radius: 0.5rem;
		background: #fff;
		box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
	}

	.card.current {
		border: 2px solid #1d4e89;
		background: #e7f0fb;
		box-shadow: 0 0 0 3px rgb(29 78 137 / 18%);
	}

	h3 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem 0.5rem;
		margin: 0 0 0.35rem;
		color: #334155;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.current h3 {
		color: #1d4e89;
	}

	h3 span {
		letter-spacing: 0;
		text-transform: none;
		font-size: 0.72rem;
	}

	p {
		margin: 0;
		color: #17213a;
		font-size: 0.78rem;
		line-height: 1.35;
	}

	p + p {
		margin-top: 0.28rem;
	}

	.card :global(.svelte-flow__handle) {
		width: 7px;
		height: 7px;
		background: #94a3b8;
		border: 0;
	}
</style>
