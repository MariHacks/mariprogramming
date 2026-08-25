import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SemesterPage from './+page.svelte';

afterEach(cleanup);

describe('semester page', () => {
	it('sends visitors to the account page when they are signed out', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-sign-in' } } } });
		expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/tools/account');
		expect(screen.queryByLabelText('Course outline PDF')).not.toBeInTheDocument();
	});

	it('accepts a PDF upload when the account is ready', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'ready' } } } });
		expect(screen.getByLabelText('Course outline PDF')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Read outline' })).toBeInTheDocument();
	});

	it('sends incomplete accounts back to finish setup', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-profile' } } } });
		expect(screen.getByRole('link', { name: 'Finish your account' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		cleanup();
		render(SemesterPage, { props: { data: { view: { kind: 'need-disclosure' } } } });
		expect(screen.getByRole('link', { name: 'Confirm the NVIDIA disclosure' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
	});

	it('lets a student review extracted assessments privately', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: true,
						sha256: 'ab'.repeat(32),
						proposals: {
							assessments: [{ title: 'Midterm', weight: 30, date: '2026-10-20' }],
							books: [{ title: 'University Physics', author: 'Young', required: true }]
						}
					}
				}
			}
		});
		expect(screen.getByDisplayValue('Midterm')).toBeInTheDocument();
		expect(screen.getByText(/Private use is the default/)).toBeInTheDocument();
		expect(screen.getByLabelText('Share these fields to the course catalog')).toBeInTheDocument();
	});

	it('explains a missing NVIDIA key and a reused extraction', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: false,
						reason: 'missing-key',
						sha256: 'ab'.repeat(32),
						cacheHit: true,
						proposals: { assessments: [], books: [] }
					}
				}
			}
		});
		expect(screen.getByText(/Automatic extraction is unavailable/)).toBeInTheDocument();
		expect(screen.getByText('Reused a saved extraction for this file.')).toBeInTheDocument();
		cleanup();
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					error: 'Upload a PDF file.',
					extraction: {
						ok: false,
						reason: 'provider',
						sha256: 'ab'.repeat(32),
						proposals: { assessments: [], books: [] }
					}
				}
			}
		});
		expect(screen.getByText(/We could not extract this outline automatically/)).toBeInTheDocument();
		expect(screen.getByText('Upload a PDF file.')).toBeInTheDocument();
	});

	it('confirms a catalog share', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: { contributed: true }
			}
		});
		expect(screen.getByText('Saved to the catalog.')).toBeInTheDocument();
	});
});
