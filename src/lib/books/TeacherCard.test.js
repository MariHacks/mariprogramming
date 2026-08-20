import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TeacherCard from './TeacherCard.svelte';
import { catalogue, getTeacherBooks } from '../../test/fixtures/book-catalogue';

const teacher = catalogue.teachers[0];
const course = catalogue.courses.find((candidate) => candidate.id === 'french-101');
if (!course) {
	throw new Error('Expected the French 101 course fixture');
}
const books = getTeacherBooks(teacher.id).filter((book) => book.courseId === course.id);

const props = {
	teacher,
	course,
	books
};

afterEach(cleanup);

describe('TeacherCard', () => {
	it('uses one full-card link for one teacher-course pair', () => {
		const { container } = render(TeacherCard, { props });
		const link = screen.getByRole('link', { name: 'FRE-101 French 101' });

		expect(link).toHaveAttribute('href', '/books/mme-tremblay/french-101');
		expect(link).toHaveAccessibleDescription(
			'Mme Tremblay Le Petit Prince $18.95 Bescherelle $29.95 2 books, $48.90 total'
		);
		expect(container.querySelectorAll('a[href], button, input, select, textarea')).toHaveLength(1);
		expect(link.querySelector('a[href], button, input, select, textarea')).not.toBeInTheDocument();
	});

	it('shows every assigned book with its individual price', () => {
		const { container } = render(TeacherCard, { props });
		const bookList = screen.getByRole('list', { name: 'Books for FRE-101' });
		const bookItems = within(bookList).getAllByRole('listitem');

		expect(screen.getByRole('heading', { level: 2, name: 'FRE-101 French 101' })).toBeVisible();
		expect(screen.getByText('Mme Tremblay')).toBeVisible();
		expect(bookItems).toHaveLength(2);
		expect(bookItems[0]).toHaveTextContent('Le Petit Prince $18.95');
		expect(bookItems[1]).toHaveTextContent('Bescherelle $29.95');
		expect(screen.getByText('2 books, $48.90 total')).toBeVisible();
		expect(container).not.toHaveTextContent('Open course list');
	});

	it('keeps the visible cover stack decorative and out of the card name', () => {
		const { container } = render(TeacherCard, { props });
		const stack = container.querySelector('.book-cover-stack');

		expect(stack).toHaveAttribute('aria-hidden', 'true');
		expect(stack).toHaveAttribute('data-count', '2');
		expect(stack?.querySelectorAll('[data-size="card"]')).toHaveLength(2);
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByRole('link')).toHaveAccessibleName('FRE-101 French 101');
	});

	it('removes decorative labels while keeping the card free of checkout-stage details', () => {
		const { container } = render(TeacherCard, { props });

		expect(container).not.toHaveTextContent(/assigned reading|courses|list size|sources/i);
		expect(container).not.toHaveTextContent(/cart|checkout|pickup|tax|service fee/i);
		expect(container).not.toHaveTextContent(/Renaud-Bray|Archambault/i);
	});
});
