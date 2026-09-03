import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SemesterPage from './+page.svelte';

const stylesDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../lib/maritools/styles'
);

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('semester page', () => {
	it('sends visitors to the account page when they are signed out', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-sign-in' } } } });
		expect(screen.getByRole('heading', { name: 'Sign in to upload outlines' })).toBeInTheDocument();
		const openAccount = screen.getByRole('link', { name: 'Open account' });
		expect(openAccount).toHaveAttribute('href', '/tools/account');
		expect(openAccount).toHaveClass('primary-button');
		expect(
			screen.getByText(/Course facts are shared to the catalog by default when you save/)
		).toBeInTheDocument();
		const stackGate = screen.getByRole('link', { name: 'Sign in to add an outline' });
		expect(stackGate).toHaveAttribute('href', '/tools/account');
		expect(stackGate).not.toHaveClass('primary-button');
		expect(stackGate).toHaveClass('quiet-button');
		const primaryAccountLinks = screen
			.getAllByRole('link')
			.filter(
				(link) =>
					link.classList.contains('primary-button') &&
					link.getAttribute('href') === '/tools/account'
			);
		expect(primaryAccountLinks).toHaveLength(1);
		expect(screen.queryByLabelText('Add outline PDF')).not.toBeInTheDocument();
	});

	it('opens one multi-file picker immediately from Add outline PDF', async () => {
		const user = userEvent.setup();
		render(SemesterPage, { props: { data: { view: { kind: 'ready' } } } });
		const input = screen.getByLabelText('Choose outline PDFs');
		const picker = vi.spyOn(input, 'click');
		expect(input).toHaveAttribute('multiple');
		expect(input).not.toBeVisible();

		await user.click(screen.getByRole('button', { name: 'Add outline PDF' }));

		expect(picker).toHaveBeenCalledOnce();
		expect(screen.queryByRole('button', { name: 'Extract outline' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Upload an outline' })).toBeInTheDocument();
		expect(screen.getByText(/Scanned image PDFs will not work/)).toBeInTheDocument();
		expect(screen.queryByText('No file selected')).not.toBeInTheDocument();
		expect(screen.getByText(/Extraction starts as soon as you pick the file/)).toBeInTheDocument();
	});

	it('starts every selected PDF as an independent concurrent request', async () => {
		const requests = vi.fn(() => new Promise(() => {}));
		vi.stubGlobal('fetch', requests);
		const user = userEvent.setup();
		render(SemesterPage, { props: { data: { view: { kind: 'ready' }, activeTerm: null } } });
		const input = screen.getByLabelText('Choose outline PDFs');
		const files = [
			new File(['one'], 'physics.pdf', { type: 'application/pdf' }),
			new File(['two'], 'calculus.pdf', { type: 'application/pdf' })
		];

		await user.upload(input, files);

		expect(requests).toHaveBeenCalledTimes(2);
		expect(screen.getByText('physics.pdf')).toBeInTheDocument();
		expect(screen.getByText('calculus.pdf')).toBeInTheDocument();
		const pendingCards = document.querySelectorAll('.course-stack button.pending-upload');
		expect(pendingCards).toHaveLength(2);
		expect(pendingCards[0]).not.toBeDisabled();

		await user.click(pendingCards[1]);

		expect(pendingCards[1]).toHaveClass('is-selected');
		expect(screen.getByRole('heading', { name: 'Extracting your outline' })).toBeInTheDocument();
		expect(document.querySelector('.processing-copy')).toHaveTextContent('calculus.pdf');
	});

	it('shows an honest processing state immediately after a PDF is chosen', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => new Promise(() => {}))
		);
		const user = userEvent.setup();
		render(SemesterPage, { props: { data: { view: { kind: 'ready' } } } });
		const input = screen.getByLabelText('Choose outline PDFs');
		const file = new File(['outline'], 'calculus.pdf', { type: 'application/pdf' });

		await user.upload(input, file);
		expect(input).not.toBeDisabled();
		const status = screen.getByRole('status');
		expect(status).toHaveTextContent('calculus.pdf');
		expect(status).toHaveTextContent('Processing outline');
	});

	it('sends incomplete accounts back to finish setup', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'need-profile' } } } });
		expect(screen.getByRole('heading', { name: 'Finish your account' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open account' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		expect(screen.getByText('Finish account to upload')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Finish account to add an outline' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		expect(screen.queryByLabelText('Add outline PDF')).not.toBeInTheDocument();
	});

	it('asks for outline analysis confirmation inside the Semester workspace', () => {
		render(SemesterPage, {
			props: { data: { view: { kind: 'need-analysis-confirmation' } } }
		});

		expect(
			screen.getByRole('heading', { name: 'Before you upload an outline' })
		).toBeInTheDocument();
		expect(screen.getByText(/use the text to find course details/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Continue to Semester' })).toHaveAttribute(
			'formaction',
			'?/confirmAnalysis'
		);
		expect(screen.queryByRole('link', { name: 'Open account' })).not.toBeInTheDocument();
		expect(screen.queryByText(/NVIDIA/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Add outline PDF')).not.toBeInTheDocument();
	});

	it('lets a student review extracted assessments and opt out of sharing', async () => {
		const user = userEvent.setup();
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: true,
						sha256: 'ab'.repeat(32),
						proposals: {
							courseCode: '420-SNT-MS',
							title: 'Web Programming',
							section: '00001',
							teacherName: 'Ada',
							assessments: [
								{
									title: 'First test',
									weight: null,
									weightLabel: '30% / 40%',
									date: 'Friday, October 2',
									dateIso: '2026-10-02'
								}
							],
							books: [{ title: 'University Physics', author: 'Young', required: true }]
						}
					}
				}
			}
		});
		expect(screen.getByDisplayValue('First test')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Friday, October 2')).toBeInTheDocument();
		expect(screen.getByDisplayValue('30% / 40%')).toBeInTheDocument();
		expect(screen.getByDisplayValue('420-SNT-MS')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Web Programming')).toBeInTheDocument();
		expect(screen.getByDisplayValue('00001')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Ada')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Review extracted details' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Course details' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Books' })).toBeInTheDocument();
		const sharing = screen.getByRole('checkbox', {
			name: 'Share these course facts in the catalog'
		});
		expect(sharing).toBeChecked();
		expect(screen.getByText(/Uncheck to keep this outline in your account only/)).toBeInTheDocument();
		expect(screen.getByText('This outline will be shared in the catalog.')).toBeInTheDocument();
		await user.click(sharing);
		expect(sharing).not.toBeChecked();
		expect(screen.getByText('This outline will stay in your account only.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
		const selected = screen.getByRole('button', { name: /Web Programming/ });
		expect(selected).toHaveTextContent('4/4 identity');
		expect(selected).not.toHaveClass('needs-dates');
	});

	it('marks missing assessment dates on the selected course chip', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: true,
						sha256: 'ab'.repeat(32),
						proposals: {
							assessments: [{ title: 'Midterm', weight: 30, date: '' }],
							books: []
						}
					}
				}
			}
		});
		const selected = screen.getByRole('button', { name: /Untitled outline/ });
		expect(selected).toHaveTextContent('1 date missing');
		expect(selected).toHaveClass('needs-dates');
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
		expect(screen.getByText('Used a saved extraction for this file.')).toBeInTheDocument();
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

	it('restores saved courses and pending processing from account data', async () => {
		const user = userEvent.setup();
		render(SemesterPage, {
			props: {
				data: {
					view: { kind: 'ready' },
					outlines: [
						{
							sha256: 'ab'.repeat(32),
							extraction: {
								proposals: {
									courseCode: '203-SN3-RE',
									title: 'Modern Physics',
									section: '00021',
									teacherName: 'Baharak Fatholahzadeh',
									assessments: [],
									books: []
								},
								inferenceCount: 1
							}
						},
						{ sha256: 'cd'.repeat(32), extraction: null }
					]
				}
			}
		});

		expect(screen.getByRole('button', { name: /Modern Physics/ })).toBeInTheDocument();
		expect(screen.getByText('Processing PDF')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Review extracted details' })).toBeInTheDocument();
		expect(screen.getByDisplayValue('203-SN3-RE')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /Processing PDF/ }));
		expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
		expect(screen.getByRole('heading', { name: 'Extracting your outline' })).toBeInTheDocument();
	});

	it('keeps a saved course read-only until Edit and exposes Save and private Delete actions', async () => {
		const user = userEvent.setup();
		render(SemesterPage, {
			props: {
				data: {
					view: { kind: 'ready' },
					activeTerm: { id: 'fall-2026', name: 'Fall 2026' },
					outlines: [
						{
							sha256: 'ab'.repeat(32),
							extraction: {
								proposals: {
									courseCode: '203-SN3-RE',
									title: 'Modern Physics',
									section: '00021',
									teacherName: 'Baharak',
									assessments: [],
									books: []
								}
							}
						}
					]
				}
			}
		});

		const title = screen.getByDisplayValue('Modern Physics');
		expect(title).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Edit' }));

		expect(title).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
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

	it('lets the student add and remove assessment rows', () => {
		render(SemesterPage, {
			props: {
				data: { view: { kind: 'ready' } },
				form: {
					extraction: {
						ok: true,
						sha256: 'ab'.repeat(32),
						proposals: {
							assessments: [{ title: 'Final project', weight: 20, date: '' }],
							books: [{ title: '', author: '', isbn: '', required: false }]
						}
					}
				}
			}
		});
		expect(screen.getAllByText(/date missing/i).length).toBeGreaterThan(0);
		expect(screen.getByText('1 assessment date missing')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '+ Add assessment' }));
		expect(screen.getAllByLabelText('Assessment')).toHaveLength(2);
		fireEvent.click(screen.getAllByRole('button', { name: 'Remove assessment' })[0]);
		expect(screen.getAllByLabelText('Assessment')).toHaveLength(1);
		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});

	it('uses one multiple PDF control owned by the account upload form', () => {
		render(SemesterPage, { props: { data: { view: { kind: 'ready' } } } });
		const input = screen.getByLabelText('Choose outline PDFs');
		expect(input).toHaveAttribute('type', 'file');
		expect(input).toHaveAttribute('multiple');
		expect(input).toHaveAttribute('form', 'semester-outline-upload');
		expect(document.querySelectorAll('input[type="file"][name="outline"]')).toHaveLength(1);
		expect(screen.queryByRole('button', { name: 'Extract outline' })).not.toBeInTheDocument();
		expect(screen.queryByText('No file selected')).not.toBeInTheDocument();
	});

	it('keeps the course-stack action separate from the visible picker', () => {
		const extras = readFileSync(path.join(stylesDir, 'preview-extras.css'), 'utf8');
		const pages = readFileSync(path.join(stylesDir, 'preview-pages.css'), 'utf8');
		const merged = readFileSync(path.join(stylesDir, 'merged-pages.css'), 'utf8');
		const cascade = `${pages}\n${extras}\n${merged}`;

		expect(pages).toMatch(
			/\.course-stack\s+\.stack-head\s+\.add-outline\s*\{[^}]*\bposition:\s*relative\b/s
		);
		expect(cascade).toMatch(/\.add-outline/);
		expect(extras).toMatch(/\.outline-native-picker\s+input\[type=['"]file['"]\]/);
		expect(extras).not.toMatch(/\.outline-native-picker[^}]*\bopacity:\s*0\b/s);
	});
});
