<script>
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount } from 'svelte';

	let { nodes = [] } = $props();
	const flow = useSvelteFlow();
	const opening = ['0', '1', '2', '3', '4', '4-0', '4-1', '4-2'];

	onMount(() => {
		const present = nodes.filter((node) => opening.includes(node.id));
		const target = present.length >= opening.length ? present : nodes;
		requestAnimationFrame(() => {
			flow.fitView({
				nodes: target.map((node) => ({ id: node.id })),
				padding: 0.14,
				minZoom: 0.62,
				maxZoom: 0.9,
				duration: 0
			});
		});
	});
</script>
