import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import ResourcesPage from './+page.svelte';

afterEach(cleanup);

describe('resources route', () => {
	it('introduces practical learning paths with useful metadata', () => {
		const { container } = render(ResourcesPage);

		expect(
			screen.getByRole('heading', {
				level: 1,
				name: 'Choose a learning path for your next step'
			})
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(
			screen.getByText(/start with the goal that matches what you want to learn/i)
		).toBeInTheDocument();
		expect(document.title).toBe(`Resources | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			'Choose a practical programming learning path and open current resources collected by the Marianopolis Programming Club.'
		);
	});

	it('renders every centralized path in source order with its authentic resources', () => {
		render(ResourcesPage);

		const pathList = screen.getByRole('list', { name: 'Programming learning paths' });
		const pathArticles = within(pathList).getAllByRole('article');

		expect(pathArticles).toHaveLength(clubContent.resources.length);

		clubContent.resources.forEach((path, index) => {
			const pathArticle = pathArticles[index];

			expect(
				within(pathArticle).getByRole('heading', { level: 2, name: path.title })
			).toBeInTheDocument();
			expect(within(pathArticle).getByText(path.description)).toBeInTheDocument();

			for (const resource of path.links) {
				expect(
					within(pathArticle).getByRole('link', {
						name: `Open ${resource.label} for ${path.title}`
					})
				).toHaveAttribute('href', resource.url);
			}
		});
	});

	it('opens every external resource safely in a new tab', () => {
		render(ResourcesPage);

		for (const path of clubContent.resources) {
			for (const resource of path.links) {
				const link = screen.getByRole('link', {
					name: `Open ${resource.label} for ${path.title}`
				});

				expect(link).toHaveAttribute('target', '_blank');
				expect(link).toHaveAttribute('rel', 'noopener noreferrer');
			}
		}
	});

	it('ends with the current community action without commerce or legacy leakage', () => {
		const { container } = render(ResourcesPage);
		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'noopener noreferrer');
		expect(screen.getByRole('link', { name: 'Browse club workshops' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(container).not.toHaveTextContent(/discord|fall 2024|coming soon/i);
		expect(container).not.toHaveTextContent(
			/\bcart\b|checkout|pickup|service fee|book delivery|\$[0-9]/i
		);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
