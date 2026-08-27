import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ThreadPage from './+page.svelte';

afterEach(cleanup);

const THREAD = {
	id: '20000000-0000-4000-8000-000000000001',
	title: 'Midterm tips',
	body: 'Bring a calculator.',
	category: 'courses',
	lockedAt: null
};

describe('forum thread page', () => {
	it('shows a missing thread', () => {
		render(ThreadPage, { props: { data: { thread: null, replies: [], notFound: true } } });
		expect(screen.getByText('That thread is not available.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Back to forum' })).toHaveAttribute('href', '/tools/forum');
	});

	it('shows an unavailable thread', () => {
		render(ThreadPage, {
			props: { data: { thread: null, replies: [], unavailable: true } }
		});
		expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
	});

	it('lets signed-in students reply and report without showing a student number', () => {
		render(ThreadPage, {
			props: {
				data: {
					thread: THREAD,
					replies: [{ id: 'r1', body: 'Thanks' }],
					signedIn: true,
					canReply: true,
					staff: false
				},
				form: { replied: true, reported: true, error: 'Could not post that reply.' }
			}
		});
		expect(screen.getByRole('heading', { name: 'Midterm tips' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '← All discussions' })).toHaveAttribute(
			'href',
			'/tools/forum'
		);
		expect(screen.getByText('Course help')).toBeInTheDocument();
		expect(screen.getByText('Original poster')).toBeInTheDocument();
		expect(screen.getAllByText('Student').length).toBeGreaterThan(0);
		expect(screen.getByText('Thanks')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Write a clear, useful reply…')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Post reply' })).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Report' }).length).toBeGreaterThan(0);
		expect(screen.getByText('Reply posted.')).toBeInTheDocument();
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
	});

	it('shows staff controls and a locked empty thread', () => {
		render(ThreadPage, {
			props: {
				data: {
					thread: { ...THREAD, lockedAt: new Date() },
					replies: [],
					signedIn: true,
					canReply: false,
					staff: true
				},
				form: { moderated: true }
			}
		});
		expect(screen.getByText('Thread locked.')).toBeInTheDocument();
		expect(screen.getByText('No replies yet.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Lock thread' })).toBeInTheDocument();
		expect(screen.getByText('Moderation applied.')).toBeInTheDocument();
	});
});
