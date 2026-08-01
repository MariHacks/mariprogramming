import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ContentCard from './ContentCard.svelte';

describe('ContentCard', () => {
	it('renders the complete card as one descriptive link', () => {
		const { container } = render(ContentCard, {
			props: {
				title: 'Python foundations',
				summary: 'Start with the basics and leave with a working program.',
				href: '/our-workshops/python-foundations',
				meta: 'Beginner workshop',
				variant: 'navy'
			}
		});

		const link = screen.getByRole('link', {
			name: /python foundations.*start with the basics and leave with a working program/i
		});

		expect(link).toHaveAttribute('href', '/our-workshops/python-foundations');
		expect(container.querySelectorAll('a')).toHaveLength(1);
		expect(screen.getByText('Beginner workshop')).toHaveClass('card-meta');
	});

	it('renders an unlinked article without empty optional elements', () => {
		const { container } = render(ContentCard, {
			props: {
				title: 'Open practice',
				summary: '',
				href: '',
				meta: ''
			}
		});

		const article = container.querySelector('article');

		expect(article).toBeInTheDocument();
		expect(article).not.toHaveAttribute('href');
		expect(screen.getByRole('heading', { level: 3, name: 'Open practice' })).toBeInTheDocument();
		expect(container.querySelector('a')).not.toBeInTheDocument();
		expect(article?.querySelector('p')).not.toBeInTheDocument();
	});
});
