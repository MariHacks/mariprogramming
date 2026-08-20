import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import ResourcesPage from './+page.svelte';

afterEach(cleanup);

const resourcePaths = [
	{
		title: 'Learn the foundations',
		description: 'Follow a structured course when you want a clear place to begin.'
	},
	{
		title: 'Build for the web',
		description: 'Learn web development by creating complete, practical projects.'
	},
	{
		title: 'Practice problem solving',
		description: 'Strengthen algorithms and implementation skills with focused challenges.'
	},
	{
		title: 'Watch and ask questions',
		description: 'Use focused video guides, then research questions when you get stuck.'
	}
];

const resourceDestinations = [
	{
		name: 'Open freeCodeCamp for Learn the foundations',
		url: 'https://www.freecodecamp.org/learn'
	},
	{ name: 'Open Codecademy for Learn the foundations', url: 'https://www.codecademy.com/' },
	{ name: 'Open Harvard CS50x for Learn the foundations', url: 'https://cs50.harvard.edu/x/' },
	{ name: 'Open The Odin Project for Build for the web', url: 'https://www.theodinproject.com/' },
	{ name: 'Open web.dev for Build for the web', url: 'https://web.dev/learn' },
	{
		name: 'Open Frontend Mentor for Build for the web',
		url: 'https://www.frontendmentor.io/challenges'
	},
	{ name: 'Open LeetCode for Practice problem solving', url: 'https://leetcode.com/' },
	{ name: 'Open Codewars for Practice problem solving', url: 'https://www.codewars.com/' },
	{ name: 'Open HackerRank for Practice problem solving', url: 'https://www.hackerrank.com/' },
	{
		name: 'Open freeCodeCamp on YouTube for Watch and ask questions',
		url: 'https://www.youtube.com/@freecodecamp'
	},
	{
		name: 'Open Tech with Tim for Watch and ask questions',
		url: 'https://www.youtube.com/@TechWithTim'
	},
	{
		name: 'Open Traversy Media for Watch and ask questions',
		url: 'https://www.youtube.com/@TraversyMedia'
	},
	{
		name: 'Open Coder Coder for Watch and ask questions',
		url: 'https://www.youtube.com/@TheCoderCoder'
	},
	{
		name: 'Open Pooky Codes for Watch and ask questions',
		url: 'https://www.youtube.com/@PookyCodes'
	},
	{
		name: 'Open Stack Overflow for Watch and ask questions',
		url: 'https://stackoverflow.com/'
	}
];

describe('resources route', () => {
	it('keeps the directory focused on its useful destinations', () => {
		const { container } = render(ResourcesPage);

		expect(
			screen.getByRole('heading', {
				level: 1,
				name: 'Resources'
			})
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(container).not.toHaveTextContent('Choose a topic, then open a resource.');
		expect(document.title).toBe(`Resources | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			'Programming resources from Marianopolis Programming Club.'
		);
	});

	it('keeps the path descriptions students need to choose where to start', () => {
		render(ResourcesPage);

		const pathList = screen.getByRole('list', { name: 'Programming learning paths' });
		const pathArticles = within(pathList).getAllByRole('article');

		expect(pathArticles).toHaveLength(resourcePaths.length);

		resourcePaths.forEach((path, index) => {
			const pathArticle = pathArticles[index];

			expect(
				within(pathArticle).getByRole('heading', { level: 2, name: path.title })
			).toBeInTheDocument();
			expect(within(pathArticle).getByText(path.description)).toBeInTheDocument();
		});
	});

	it('opens every external resource safely in a new tab', () => {
		render(ResourcesPage);

		expect(screen.getAllByRole('link')).toHaveLength(resourceDestinations.length);

		for (const destination of resourceDestinations) {
			const link = screen.getByRole('link', { name: destination.name });

			expect(link).toHaveAttribute('href', destination.url);
			expect(link).toHaveAttribute('target', '_blank');
			expect(link).toHaveAttribute('rel', 'external noopener noreferrer');
		}
	});

	it('does not add commerce or legacy content to the resource directory', () => {
		const { container } = render(ResourcesPage);
		expect(container).not.toHaveTextContent(/discord|fall 2024|coming soon/i);
		expect(container).not.toHaveTextContent(
			/\bcart\b|checkout|pickup|service fee|book delivery|\$[0-9]/i
		);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
