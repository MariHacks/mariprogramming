const WIDTH = 300;
const GAP_X = 56;
const GAP_Y = 72;

/** @param {unknown} scene */
export function sceneLines(scene) {
	return String(scene ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

/** @param {string[]} lines */
function heightFor(lines) {
	const rows = lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 32)), 0);
	return 64 + rows * 22;
}

/**
 * @param {string} source
 * @param {string} target
 */
function edge(source, target) {
	return { id: `${source}->${target}`, source, target, type: 'smoothstep' };
}

/**
 * @param {Array<{ id: string, stepId: number, title: string, lines: string[], position: { x: number, y: number } }>} placed
 * @param {Array<{ id: string, source: string, target: string, type: string }>} edges
 * @param {number} currentStep
 */
function toFlow(placed, edges, currentStep) {
	const incoming = new Set(edges.map((item) => item.target));
	const outgoing = new Set(edges.map((item) => item.source));
	return {
		nodes: placed.map((node) => ({
			id: node.id,
			type: 'story',
			position: node.position,
			data: {
				title: node.title,
				lines: node.lines,
				current: node.stepId === currentStep,
				hasIn: incoming.has(node.id),
				hasOut: outgoing.has(node.id)
			},
			style: `width: ${WIDTH}px`,
			draggable: false,
			connectable: false
		})),
		edges
	};
}

/**
 * @param {Array<{ id: number, title: string, scene?: string }>} steps
 * @param {number} currentStep
 */
function linearGraph(steps, currentStep) {
	const sourced = steps.filter((step) => sceneLines(step.scene).length > 0);
	let y = 0;
	const placed = sourced.map((step) => {
		const lines = sceneLines(step.scene);
		const position = { x: 0, y };
		y += heightFor(lines) + GAP_Y;
		return {
			id: String(step.id),
			stepId: step.id,
			title: `${step.id} ${step.title}`,
			lines,
			position
		};
	});
	const edges = placed.slice(1).map((node, index) => edge(placed[index].id, node.id));
	return toFlow(placed, edges, currentStep);
}

/**
 * @param {Map<number, { id: number, title: string, scene?: string }>} byId
 * @param {number} currentStep
 */
function gamejamGraph(byId, currentStep) {
	const col = [0, WIDTH + GAP_X, 2 * (WIDTH + GAP_X)];
	/** @type {Array<{ id: string, stepId: number, title: string, lines: string[], position: { x: number, y: number } }>} */
	const placed = [];
	/** @type {Array<{ id: string, source: string, target: string, type: string }>} */
	const edges = [];

	/**
	 * @param {string} id
	 * @param {number} stepId
	 * @param {string} title
	 * @param {string[]} lines
	 * @param {number} x
	 * @param {number} y
	 */
	function add(id, stepId, title, lines, x, y) {
		placed.push({ id, stepId, title, lines, position: { x, y } });
		return heightFor(lines);
	}

	let y = 0;
	for (const id of [0, 1, 2, 3]) {
		const step = byId.get(id);
		const height = add(String(id), id, `${id} ${step.title}`, sceneLines(step.scene), col[1], y);
		if (id > 0) edges.push(edge(String(id - 1), String(id)));
		y += height + GAP_Y;
	}

	const choiceStep = byId.get(4);
	const choiceLines = sceneLines(choiceStep.scene);
	const choices = choiceLines.slice(1);
	const choiceTitle = `4 ${choiceStep.title}`;
	y += add('4', 4, choiceTitle, [choiceLines[0]], col[1], y) + GAP_Y;
	edges.push(edge('3', '4'));

	const choiceIds = choices.map((line, index) => {
		const id = `4-${index}`;
		add(id, 4, choiceTitle, [line], col[index], y);
		edges.push(edge('4', id));
		return id;
	});
	y += Math.max(...choices.map((line) => heightFor([line]))) + GAP_Y;

	const bonusStep = byId.get(5);
	const deathStep = byId.get(6);
	const bonusLines = sceneLines(bonusStep.scene).filter((line) => line !== choices[0]);
	const deathLines = sceneLines(deathStep.scene).filter((line) => line !== choices[2]);
	const bonusHeight = add('5', 5, `5 ${bonusStep.title}`, bonusLines, col[0], y);
	const deathHeight = add('6', 6, `6 ${deathStep.title}`, deathLines, col[2], y);
	edges.push(edge(choiceIds[0], '5'));
	edges.push(edge(choiceIds[1], '7'));
	edges.push(edge(choiceIds[2], '6'));
	y += Math.max(bonusHeight, deathHeight) + GAP_Y;

	const ap = byId.get(7);
	y += add('7', 7, `7 ${ap.title}`, sceneLines(ap.scene), col[1], y) + GAP_Y;
	edges.push(edge('5', '7'));

	const fate = byId.get(8);
	const fateLines = sceneLines(fate.scene);
	const mid = Math.ceil(fateLines.length / 2);
	const libraryHeight = add('8-library', 8, `8 ${fate.title}`, fateLines.slice(0, mid), col[0], y);
	const foodHeight = add('8-food', 8, `8 ${fate.title}`, fateLines.slice(mid), col[2], y);
	edges.push(edge('7', '8-library'), edge('7', '8-food'));
	y += Math.max(libraryHeight, foodHeight) + GAP_Y;

	const yours = byId.get(11);
	y += add('11', 11, `11 ${yours.title}`, sceneLines(yours.scene), col[1], y) + GAP_Y;
	edges.push(edge('8-library', '11'), edge('8-food', '11'));

	const quiz = byId.get(9);
	y += add('9', 9, `9 ${quiz.title}`, sceneLines(quiz.scene), col[1], y) + GAP_Y;
	edges.push(edge('11', '9'));

	const ending = byId.get(10);
	const endingLines = sceneLines(ending.scene);
	const endingTitle = `10 ${ending.title}`;
	add('10-passed', 10, endingTitle, endingLines.slice(0, 1), col[0], y);
	add('10-failed', 10, endingTitle, endingLines.slice(1), col[2], y);
	edges.push(edge('9', '10-passed'), edge('9', '10-failed'));

	return toFlow(placed, edges, currentStep);
}

/**
 * @param {Array<{ id: number, title: string, scene?: string }>} steps
 * @param {number} [currentStep]
 */
export function storyGraph(steps, currentStep = -1) {
	const sourced = steps.filter((step) => sceneLines(step.scene).length > 0);
	const byId = new Map(sourced.map((step) => [step.id, step]));
	const gamejam = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every((id) => byId.has(id));
	if (!gamejam) return linearGraph(steps, currentStep);
	return gamejamGraph(byId, currentStep);
}
