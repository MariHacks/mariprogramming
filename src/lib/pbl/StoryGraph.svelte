<script>
	import { MarkerType, SvelteFlow, Background, Controls } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import FrameStory from './FrameStory.svelte';
	import StoryNode from './StoryNode.svelte';

	/** @type {{ nodes?: any[], edges?: any[] }} */
	let { nodes = [], edges = [] } = $props();

	const nodeTypes = { story: StoryNode };
</script>

<div class="canvas">
	<SvelteFlow
		{nodes}
		{edges}
		{nodeTypes}
		minZoom={0.4}
		maxZoom={1.4}
		panOnScroll={true}
		nodesDraggable={false}
		nodesConnectable={false}
		elementsSelectable={false}
		colorMode="light"
		defaultEdgeOptions={{
			type: 'smoothstep',
			markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 }
		}}
	>
		<FrameStory {nodes} />
		<Background />
		<Controls showLock={false} />
	</SvelteFlow>
</div>

<style>
	.canvas {
		position: absolute;
		inset: 0;
	}

	.canvas :global(.svelte-flow) {
		background: #f6f3ec;
	}
</style>
