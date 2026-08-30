// @ts-nocheck

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from './+page.svelte';

const THREAD = '20000000-0000-4000-8000-000000000001';
const REPORT = '40000000-0000-4000-8000-000000000001';
const AUTHOR = 'author-1';
const REPORTER = 'reporter-1';

const formMocks = vi.hoisted(() => {
	const enhance = vi.fn(() => ({ destroy() {} }));
	return { applyAction: vi.fn(async () => {}), enhance };
});
const navigationMocks = vi.hoisted(() => ({ invalidateAll: vi.fn(async () => {}) }));

vi.mock('$app/forms', () => ({
	enhance: formMocks.enhance,
	applyAction: formMocks.applyAction
}));
vi.mock('$app/navigation', () => ({ invalidateAll: navigationMocks.invalidateAll }));

afterEach(() => {
	cleanup();
	formMocks.applyAction.mockClear();
	formMocks.enhance.mockClear();
	navigationMocks.invalidateAll.mockClear();
});

const openReport = {
	id: REPORT,
	targetKind: 'thread',
	targetId: THREAD,
	threadId: THREAD,
	targetTitle: 'Quiet study hall',
	reporterUserId: REPORTER,
	reporterDisplayName: 'Blake',
	reporterProfileHref: `/tools/people/${REPORTER}`,
	subjectUserId: AUTHOR,
	subjectDisplayName: 'Ada',
	subjectProfileHref: `/tools/people/${AUTHOR}`,
	reason: 'spam in the title',
	status: 'open',
	resolvedAt: null,
	createdAt: '2026-08-28T16:00:00.000Z',
	href: `/tools/forum/${THREAD}`
};

describe('staff reports page', () => {
	it('renders human labels and one action row with lock/mute/ban', () => {
		render(ReportsPage, {
			data: {
				statusFilter: 'open',
				unavailable: false,
				reports: [openReport]
			}
		});
		expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Open reports' })).toBeInTheDocument();
		expect(screen.getByText('spam in the title')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Quiet study hall' })).toHaveAttribute(
			'href',
			`/tools/forum/${THREAD}`
		);
		expect(screen.getByRole('link', { name: /by Ada/i })).toHaveAttribute(
			'href',
			`/tools/people/${AUTHOR}`
		);
		expect(screen.getByRole('link', { name: 'Blake' })).toHaveAttribute(
			'href',
			`/tools/people/${REPORTER}`
		);
		expect(screen.queryByText(THREAD)).not.toBeInTheDocument();
		expect(screen.queryByText(REPORTER)).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Lock' })).toHaveAttribute(
			'formaction',
			'?/lockThread'
		);
		expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute(
			'formaction',
			'?/muteAuthor'
		);
		expect(screen.getByRole('button', { name: 'Ban' })).toHaveAttribute('formaction', '?/banAuthor');
		expect(screen.getByRole('button', { name: 'Resolve' })).toHaveAttribute(
			'formaction',
			'?/resolve'
		);
		expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveAttribute(
			'formaction',
			'?/dismiss'
		);
		expect(formMocks.enhance).toHaveBeenCalled();
	});

	it('hides moderation actions for closed reports', () => {
		render(ReportsPage, {
			data: {
				statusFilter: 'resolved',
				unavailable: false,
				reports: [{ ...openReport, status: 'resolved', resolvedAt: '2026-08-28T19:00:00.000Z' }]
			}
		});
		expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
	});

	it('shows an empty state when the queue has no rows', () => {
		render(ReportsPage, {
			data: { statusFilter: 'open', unavailable: false, reports: [] }
		});
		expect(screen.getByText(/No open reports/i)).toBeInTheDocument();
	});

	it('shows an unavailable alert when the store is down', () => {
		render(ReportsPage, {
			data: { statusFilter: 'open', unavailable: true, reports: [] }
		});
		expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
	});
});
