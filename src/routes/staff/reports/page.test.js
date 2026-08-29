// @ts-nocheck

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from './+page.svelte';

const THREAD = '20000000-0000-4000-8000-000000000001';
const REPORT = '40000000-0000-4000-8000-000000000001';

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

describe('staff reports page', () => {
	it('renders the open report queue with target and reason', () => {
		render(ReportsPage, {
			data: {
				statusFilter: 'open',
				unavailable: false,
				reports: [
					{
						id: REPORT,
						targetKind: 'thread',
						targetId: THREAD,
						threadId: THREAD,
						reporterUserId: 'reporter-1',
						reason: 'spam in the title',
						status: 'open',
						resolvedAt: null,
						createdAt: '2026-08-28T16:00:00.000Z',
						href: `/tools/forum/${THREAD}`
					}
				]
			}
		});
		expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
		expect(screen.getByText('spam in the title')).toBeInTheDocument();
		expect(screen.getByText('open')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Open thread/i })).toHaveAttribute(
			'href',
			`/tools/forum/${THREAD}`
		);
		expect(screen.getByText('reporter-1')).toBeInTheDocument();
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

	it('hides resolve and dismiss actions for closed reports', () => {
		render(ReportsPage, {
			data: {
				statusFilter: 'resolved',
				unavailable: false,
				reports: [
					{
						id: REPORT,
						targetKind: 'thread',
						targetId: THREAD,
						threadId: THREAD,
						reporterUserId: 'reporter-1',
						reason: 'already handled',
						status: 'resolved',
						resolvedAt: '2026-08-28T19:00:00.000Z',
						createdAt: '2026-08-28T16:00:00.000Z',
						href: `/tools/forum/${THREAD}`
					}
				]
			}
		});
		expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
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
