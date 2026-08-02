import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TeacherCard from './TeacherCard.svelte';
import { catalogue, getTeacherBooks } from './catalogue';

const teacher = catalogue.teachers[0];
const courses = catalogue.courses.filter((course) => course.teacherId === teacher.id);
const books = getTeacherBooks(teacher.id);

const props = {
	teacher,
	courses,
	books
};

afterEach(cleanup);

describe('TeacherCard', () => {
	it('uses one full-card link whose accessible name identifies the teacher and courses', () => {
		const { container } = render(TeacherCard, { props });
		const link = screen.getByRole('link', {
			name: /Mme Tremblay[\s\S]*French 101[\s\S]*French 102/i
		});

		expect(link).toHaveAttribute('href', '/books/mme-tremblay');
		expect(container.querySelectorAll('a[href], button, input, select, textarea')).toHaveLength(1);
		expect(link.querySelector('a[href], button, input, select, textarea')).not.toBeInTheDocument();
	});

	it('shows every supplied course as visible scanning context', () => {
		render(TeacherCard, { props });

		expect(screen.getByRole('heading', { level: 3, name: 'Mme Tremblay' })).toBeInTheDocument();
		expect(screen.getByText('French 101')).toBeVisible();
		expect(screen.getByText('French 102')).toBeVisible();
		expect(screen.getByText('FRE-101')).toBeVisible();
		expect(screen.getByText('FRE-102')).toBeVisible();
	});

	it('derives list size, individual-price range, and distinct bookstore count from supplied books', () => {
		render(TeacherCard, { props: { ...props, books: [books[0], books[2]] } });

		expect(screen.getByText('2 required books')).toBeVisible();
		expect(screen.getByText('$16.95 to $18.95')).toBeVisible();
		expect(screen.getByText('2 bookstores')).toBeVisible();
		expect(screen.queryByText('$29.95')).not.toBeInTheDocument();
	});

	it('keeps the cover stack decorative and out of the card name', () => {
		const { container } = render(TeacherCard, { props });
		const stack = container.querySelector('.book-cover-stack');

		expect(stack).toHaveAttribute('aria-hidden', 'true');
		expect(stack).toHaveAttribute('data-count', '3');
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByRole('link')).not.toHaveAccessibleName(
			/Le Petit Prince|Bescherelle|Antigone/i
		);
	});

	it('presents individual book prices without checkout-stage or retailer actions', () => {
		const { container } = render(TeacherCard, { props });

		expect(screen.getByText('Individual book prices')).toBeVisible();
		expect(container).not.toHaveTextContent(/cart|checkout|pickup|tax|service fee/i);
		expect(container).not.toHaveTextContent(/Renaud-Bray|Archambault/i);
	});
});
