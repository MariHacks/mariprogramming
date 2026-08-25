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
					signedIn: false
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Forum' })).toBeInTheDocument();
		expect(screen.getByText(/Course tags come from the catalog/)).toBeInTheDocument();
		expect(screen.getByText('No threads yet.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
	});

	it('lists threads with course tags and the post form when signed in', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [
						{
							id: 't1',
							title: 'Midterm tips',
							category: 'courses',
							courseCode: '203-SN3-RE'
						}
					],
					courses: [COURSE],
					category: 'courses',
					courseId: COURSE.id,
					signedIn: true
				},
				form: { error: 'Check the thread and try again.' }
			}
		});
		expect(screen.getByRole('link', { name: /Midterm tips/ })).toHaveAttribute(
			'href',
			'/tools/forum/t1'
		);
		expect(screen.getByText(/courses · 203-SN3-RE/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Post thread' })).toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent('Check the thread');
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
	});

	it('explains when the forum is unavailable', () => {
		render(ForumPage, {
			props: {
				data: {
					threads: [],
					courses: [],
					category: '',
					courseId: '',
					signedIn: false,
					unavailable: true
				}
			}
		});
		expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
	});
});
