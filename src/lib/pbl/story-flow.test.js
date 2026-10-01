import { describe, expect, it } from 'vitest';
import { GAMEJAM_STEPS } from './gamejam-workshop.js';
import { storyGraph } from './story-flow.js';

const LISTEN = 'You actually listen and learn something.';
const WORDLE = 'You open Wordle with your brightness at minimum. You understand 5% of the lecture.';
const NAP =
	'You close your eyes for 5 minutes. You wake up and everyone is gone. A ceiling tile falls on your head.';

describe('story flow', () => {
	it('links ordinary steps in order and marks the current one', () => {
		const flow = storyGraph(
			[
				{ id: 0, title: 'Start', scene: '----- 8:00 AM | GETTING TO SCHOOL -----' },
				{ id: 1, title: 'Wake', scene: 'Oops, it is 8:07 AM.\nTime to email your prof.' },
				{ id: 2, title: 'Blank', scene: '   \n' },
				{ id: 3, title: 'None' }
			],
			1
		);
		expect(flow.nodes.map((node) => node.id)).toEqual(['0', '1']);
		expect(flow.nodes[1].data.lines).toEqual(['Oops, it is 8:07 AM.', 'Time to email your prof.']);
		expect(flow.nodes[0].data.current).toBe(false);
		expect(flow.nodes[1].data.current).toBe(true);
		expect(flow.nodes[0].data.hasIn).toBe(false);
		expect(flow.nodes[1].data.hasOut).toBe(false);
		expect(flow.edges).toEqual([{ id: '0->1', source: '0', target: '1', type: 'smoothstep' }]);
		expect(storyGraph([{ id: 0, title: 'Only', scene: 'Hi' }]).nodes[0].data.current).toBe(false);
	});

	it('draws the three class choices as separate branches', () => {
		const flow = storyGraph(GAMEJAM_STEPS, 4);
		const listen = flow.nodes.find((node) => node.data.lines[0] === LISTEN);
		const wordle = flow.nodes.find((node) => node.data.lines[0] === WORDLE);
		const nap = flow.nodes.find((node) => node.data.lines[0] === NAP);
		expect(listen?.id).toBe('4-0');
		expect(wordle?.id).toBe('4-1');
		expect(nap?.id).toBe('4-2');
		expect(listen?.data.lines).toEqual([LISTEN]);
		expect(wordle?.data.lines).toEqual([WORDLE]);
		expect(nap?.data.lines).toEqual([NAP]);
		expect(listen?.data.current).toBe(true);
		expect(flow.nodes.find((node) => node.id === '5')?.data.current).toBe(false);
		expect(flow.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ source: '4', target: '4-0' }),
				expect.objectContaining({ source: '4', target: '4-1' }),
				expect.objectContaining({ source: '4', target: '4-2' }),
				expect.objectContaining({ source: '4-0', target: '5' }),
				expect.objectContaining({ source: '4-1', target: '7' }),
				expect.objectContaining({ source: '4-2', target: '6' }),
				expect.objectContaining({ source: '5', target: '7' })
			])
		);
		expect(flow.edges.some((item) => item.source === '6' && item.target === '7')).toBe(false);
		expect(flow.nodes.find((node) => node.id === '5')?.data.lines).toEqual([
			'BONUS: +1 chance for later.'
		]);
		expect(flow.nodes.find((node) => node.id === '6')?.data.lines).toEqual(['YOU DIED.']);
		expect(flow.nodes.find((node) => node.id === '10-passed')?.data.lines[0]).toMatch(
			/passed the quiz/
		);
		expect(flow.nodes.find((node) => node.id === '8-library')?.data.lines[0]).toMatch(/book off the shelf/);
		expect(flow.nodes.find((node) => node.id === '8-food')?.data.lines[0]).toMatch(/one bite/);
	});
});
