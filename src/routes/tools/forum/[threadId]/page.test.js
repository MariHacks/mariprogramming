import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import ThreadPage from './+page.svelte';

afterEach(cleanup);

const THREAD = {
	id: '20000000-0000-4000-8000-000000000001',
	title: 'Midterm tips',
	body: 'Bring a calculator.',
	category: 'courses',
	lockedAt: null,
	canManage: false
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

	it('lets signed-in students reply and report without showing a student number', async () => {
		const user = userEvent.setup();
		const { container } = render(ThreadPage, {
			props: {
				data: {
					thread: {
						...THREAD,
						authorDisplayName: 'Zhich',
						authorProfileImageDataUrl: 'data:image/png;base64,YQ==',
						authorUserId: 'author-1',
						authorProfileHref: '/tools/people/author-1'
					},
					replies: [
						{
							id: 'r1',
							body: 'Thanks',
							canManage: false,
							authorDisplayName: 'nick',
							authorUserId: 'author-2',
							authorProfileHref: '/tools/people/author-2'
						}
					],
					signedIn: true,
					canReply: true,
					staff: false
				},
				form: { replied: true, reported: true, error: 'Could not post that reply.' }
			}
		});
		expect(screen.getByRole('link', { name: 'Zhich' })).toHaveAttribute(
			'href',
			'/tools/people/author-1'
		);
		expect(screen.getByRole('link', { name: 'nick' })).toHaveAttribute(
			'href',
			'/tools/people/author-2'
		);
		expect(screen.getByRole('heading', { name: 'Midterm tips' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '← All discussions' })).toHaveAttribute(
			'href',
			'/tools/forum'
		);
		expect(screen.getByText('Course help')).toBeInTheDocument();
		expect(screen.getByText('Original poster')).toBeInTheDocument();
		expect(screen.getByText('Zhich')).toBeInTheDocument();
		expect(container.querySelector('.origin .post-avatar img')).toHaveAttribute(
			'src',
			'data:image/png;base64,YQ=='
		);
		expect(screen.getByText('nick')).toBeInTheDocument();
		expect(screen.getByText('NI')).toBeInTheDocument();
		expect(screen.queryByText('Student')).not.toBeInTheDocument();
		expect(screen.getByText('Thanks')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Write a clear, useful reply…')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Post reply' })).toBeInTheDocument();
		expect(screen.queryByPlaceholderText('Why are you reporting this?')).not.toBeInTheDocument();
		const reportButtons = screen.getAllByRole('button', { name: 'Report' });
		expect(reportButtons.length).toBeGreaterThan(0);
		expect(reportButtons[0]).toHaveAttribute('aria-expanded', 'false');
		await user.click(reportButtons[0]);
		expect(reportButtons[0]).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByPlaceholderText('Why are you reporting this?')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument();
		await user.keyboard('{Escape}');
		expect(screen.queryByPlaceholderText('Why are you reporting this?')).not.toBeInTheDocument();
		expect(screen.getByText('Reply posted.')).toBeInTheDocument();
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
	});

	it('falls back to Student initials when display names are missing', () => {
		render(ThreadPage, {
			props: {
				data: {
					thread: { ...THREAD, authorDisplayName: null },
					replies: [{ id: 'r1', body: 'Thanks', canManage: false }],
					signedIn: true,
					canReply: true,
					staff: false
				}
			}
		});
		expect(screen.getAllByText('Student').length).toBeGreaterThan(0);
		expect(screen.getAllByText('ST').length).toBeGreaterThan(0);
	});

	it('lets authors edit and delete their own posts', async () => {
		const user = userEvent.setup();
		render(ThreadPage, {
			props: {
				data: {
					thread: { ...THREAD, canManage: true },
					replies: [{ id: 'r1', body: 'Thanks', canManage: true }],
					signedIn: true,
					canReply: true,
					staff: false
				}
			}
		});
		expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
		expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
		await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
		expect(screen.getByDisplayValue('Bring a calculator.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save edit' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('button', { name: 'Save edit' })).not.toBeInTheDocument();
	});

	it('shows staff controls and a locked empty thread', () => {
		render(ThreadPage, {
			props: {
				data: {
					thread: { ...THREAD, lockedAt: new Date(), canManage: true },
					replies: [],
					signedIn: true,
					canReply: false,
					staff: true
				},
				form: { moderated: true }
			}
		});
		expect(screen.getByText(/This thread is locked/i)).toBeInTheDocument();
		expect(screen.getByText(/Existing posts stay visible/i)).toBeInTheDocument();
		expect(screen.getByText('No replies yet.')).toBeInTheDocument();
		expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Midterm tips' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Lock thread' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
		expect(screen.getByText('Moderation applied.')).toBeInTheDocument();
	});

	it('gates replies for guests without exposing the reply form', () => {
		render(ThreadPage, {
			props: {
				data: {
					thread: THREAD,
					replies: [],
					signedIn: false,
					canReply: false,
					staff: false
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Midterm tips' })).toBeInTheDocument();
		expect(screen.getByText(/Sign in with Google to reply/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		expect(screen.queryByRole('button', { name: 'Post reply' })).not.toBeInTheDocument();
		expect(screen.queryByPlaceholderText('Write a clear, useful reply…')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
	});

	it('shows edit and delete status messages', () => {
		render(ThreadPage, {
			props: {
				data: {
					thread: { ...THREAD, canManage: true },
					replies: [],
					signedIn: true,
					canReply: true,
					staff: false
				},
				form: { edited: true, deleted: true }
			}
		});
		expect(screen.getByText('Edit saved.')).toBeInTheDocument();
		expect(screen.getByText('Post deleted.')).toBeInTheDocument();
	});
});
