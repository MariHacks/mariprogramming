import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BookCover from './BookCover.svelte';

/** @type {Array<[string, 'compact' | 'card']>} */
const coverVariants = [
	['sky', 'compact'],
	['coral', 'card'],
	['midnight', 'card'],
	['paper', 'compact']
];

describe('BookCover', () => {
	it('gives a sourced card cover a descriptive name without deferring its load', () => {
		render(BookCover, {
			props: {
				title: 'Le Petit Prince',
				src: '/covers/le-petit-prince.webp',
				size: 'card'
			}
		});

		const cover = screen.getByRole('img', { name: 'Cover of Le Petit Prince' });

		expect(cover).toHaveAttribute('src', '/covers/le-petit-prince.webp');
		expect(cover).toHaveAttribute('loading', 'eager');
		expect(cover).toHaveAttribute('decoding', 'async');
	});

	it('lazy-loads a sourced compact row thumbnail', () => {
		render(BookCover, {
			props: {
				title: 'Antigone',
				src: '/covers/antigone.webp',
				size: 'compact'
			}
		});

		expect(screen.getByRole('img', { name: 'Cover of Antigone' })).toHaveAttribute(
			'loading',
			'lazy'
		);
	});

	it('exposes a generated fallback as one named image', () => {
		const { container } = render(BookCover, {
			props: {
				title: 'The Great Gatsby',
				src: null,
				theme: 'paper'
			}
		});

		const cover = screen.getByRole('img', {
			name: 'Cover placeholder for The Great Gatsby'
		});

		expect(cover.tagName).toBe('DIV');
		expect(cover).toHaveTextContent('The Great Gatsby');
		expect(container.querySelector('[aria-label]:not([role])')).not.toBeInTheDocument();
	});

	it('removes duplicate semantics from decorative sourced and generated covers', () => {
		const sourced = render(BookCover, {
			props: {
				title: 'Bescherelle',
				src: '/covers/bescherelle.webp',
				decorative: true
			}
		});
		const sourcedCover = sourced.container.querySelector('img');

		expect(sourcedCover).toHaveAttribute('alt', '');
		expect(sourcedCover).toHaveAttribute('aria-hidden', 'true');
		expect(sourcedCover).not.toHaveAttribute('aria-label');
		expect(sourcedCover).toHaveAttribute('loading', 'lazy');
		sourced.unmount();

		const generated = render(BookCover, {
			props: {
				title: 'Bescherelle',
				src: null,
				decorative: true
			}
		});
		const generatedCover = generated.container.firstElementChild;

		expect(generatedCover).toHaveAttribute('aria-hidden', 'true');
		expect(generatedCover).not.toHaveAttribute('role');
		expect(generatedCover).not.toHaveAttribute('aria-label');
		expect(generated.container.querySelector('[role="img"]')).not.toBeInTheDocument();
	});

	it.each(coverVariants)('applies the %s theme at %s size', (theme, size) => {
		const { container } = render(BookCover, {
			props: { title: 'Course text', src: null, theme, size }
		});
		const cover = container.firstElementChild;

		expect(cover).toHaveClass(`book-cover--${theme}`, `book-cover--${size}`);
		expect(cover).toHaveAttribute('data-theme', theme);
		expect(cover).toHaveAttribute('data-size', size);
	});
});
