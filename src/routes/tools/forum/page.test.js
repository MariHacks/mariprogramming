import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ForumPage from './+page.svelte';

afterEach(cleanup);

const COURSE = {
	id: '11111111-1111-4111-8111-111111111111',
	code: '203-SN3-RE',
	title: 'Modern Physics'
};

describe('forum page', () => {
	it('lets anyone read and sends guests to sign in', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [],
					courses: [],
					category: '',
					courseId: '',
					query: '',
					signedIn: false
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Forum' })).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Search discussions')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
		expect(screen.getByText('No threads yet.')).toBeInTheDocument();
		expect(screen.getByText(/Read without an account/)).toBeInTheDocument();
		const signInLinks = screen.getAllByRole('link', { name: 'Sign in with Google' });
		expect(signInLinks).toHaveLength(1);
		expect(signInLinks[0]).toHaveAttribute('href', '/tools/account');
	});

	it('points signed-in students at the composer when the board is empty', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [],
					courses: [],
					category: '',
					courseId: '',
					query: '',
					signedIn: true
				}
			}
		});
		expect(screen.getByText('No threads yet.')).toBeInTheDocument();
		expect(screen.getByText(/Start the first discussion below/)).toBeInTheDocument();
		expect(screen.queryByText(/Read without an account/)).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Start a thread' })).toHaveAttribute(
			'href',
			'#composer'
		);
		expect(screen.getByRole('button', { name: 'Post thread' })).toBeInTheDocument();
	});

	it('lists threads with course tags and the post form when signed in', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [
						{
							id: 't1',
							title: 'Midterm tips',
							body: 'Bring a calculator.',
							category: 'courses',
							courseCode: '203-SN3-RE'
						},
						{
							id: 't2',
							title: 'Club hours',
							body: 'When does the workshop start?',
							category: 'student-life',
							createdAt: '2026-02-03T12:00:00.000Z'
						}
					],
					courses: [COURSE],
					category: 'courses',
					courseId: COURSE.id,
					query: '',
					signedIn: true
				},
				form: { error: 'Check the thread and try again.' }
			}
		});
		expect(screen.getByRole('link', { name: /Midterm tips/ })).toHaveAttribute(
			'href',
			'/tools/forum/t1'
		);
		expect(screen.getByText('Bring a calculator.')).toBeInTheDocument();
		expect(screen.getAllByText('Course help').length).toBeGreaterThan(0);
		expect(screen.getByRole('link', { name: /Club hours/ })).toHaveAttribute(
			'href',
			'/tools/forum/t2'
		);
		expect(screen.getByRole('button', { name: 'Post thread' })).toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent('Check the thread');
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
	});

	it('groups the composer metadata beside the title and keeps the body on its own row', () => {
		const { container } = render(ForumPage, {
			props: {
				data: {
					threads: [],
					courses: [COURSE],
					category: '',
					courseId: '',
					query: '',
					signedIn: true
				}
			}
		});

		const primaryFields = container.querySelector('.composer-primary');
		expect(primaryFields).not.toBeNull();
		expect(primaryFields).toContainElement(screen.getByLabelText('Title'));
		expect(primaryFields).toContainElement(screen.getByLabelText('Category'));
		expect(primaryFields).toContainElement(screen.getByLabelText('Course tag'));
		expect(primaryFields).not.toContainElement(screen.getByLabelText('Body'));
	});

	it('explains when the forum is unavailable', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [],
					courses: [],
					category: '',
					courseId: '',
					query: '',
					signedIn: false,
					unavailable: true
				}
			}
		});
		expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
		expect(screen.queryByText('Read threads without an account.')).not.toBeInTheDocument();
		expect(screen.queryByText(/Read without an account/)).not.toBeInTheDocument();
	});

	it('keeps a course filter on Latest and skips invalid dates', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [
						{
							id: 't3',
							title: 'Hall hours',
							body: 'The hall closes at ten.',
							category: 'campus',
							createdAt: 'not-a-date'
						},
						{
							id: 't4',
							title: 'Lab notes',
							body: 'Check the repo first.',
							category: 'courses',
							createdAt: new Date('2026-03-01T12:00:00.000Z')
						}
					],
					courses: [COURSE],
					category: '',
					courseId: COURSE.id,
					query: 'lab',
					signedIn: false
				}
			}
		});
		expect(screen.getByRole('link', { name: 'Latest' })).toHaveAttribute(
			'href',
			`?course=${COURSE.id}`
		);
		expect(screen.getByRole('link', { name: /Hall hours/ })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Lab notes/ })).toBeInTheDocument();
	});

	it('falls back to the category label when a thread has no body', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [
						{
							id: 't5',
							title: 'Silent thread',
							category: 'student-life'
						}
					],
					courses: [],
					category: '',
					courseId: '',
					query: '',
					signedIn: false
				}
			}
		});
		expect(screen.getByRole('link', { name: /Silent thread/ })).toHaveTextContent('Student life');
	});
});
