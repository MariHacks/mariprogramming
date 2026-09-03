// @ts-nocheck

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CataloguePage from './+page.svelte';

const formMocks = vi.hoisted(() => {
	const state = { result: null };
	const enhance = vi.fn((formElement, submitCallback) => {
		const handleSubmit = async (event) => {
			event.preventDefault();
			let cancelled = false;
			const callback = await submitCallback({
				action: new URL(
					event.submitter?.getAttribute('formaction') ?? formElement.getAttribute('action') ?? '',
					document.baseURI
				),
				cancel: () => {
					cancelled = true;
				},
				controller: new AbortController(),
				formData: new FormData(formElement, event.submitter),
				formElement,
				submitter: event.submitter
			});
			if (cancelled || !callback) return;
			await callback({
				action: new URL(document.baseURI),
				formData: new FormData(formElement, event.submitter),
				formElement,
				result: await state.result,
				update: vi.fn(async () => {})
			});
		};
		formElement.addEventListener('submit', handleSubmit);
		return { destroy: () => formElement.removeEventListener('submit', handleSubmit) };
	});
	return { applyAction: vi.fn(async () => {}), enhance, state };
});
const navigationMocks = vi.hoisted(() => ({ invalidateAll: vi.fn(async () => {}) }));

vi.mock('$app/forms', () => ({ enhance: formMocks.enhance, applyAction: formMocks.applyAction }));
vi.mock('$app/navigation', () => ({ invalidateAll: navigationMocks.invalidateAll }));

const IDS = Object.freeze({
	teacher: '10000000-0000-4000-8000-000000000001',
	course: '20000000-0000-4000-8000-000000000001',
	store: '30000000-0000-4000-8000-000000000001',
	book: '40000000-0000-4000-8000-000000000001',
	assignment: '50000000-0000-4000-8000-000000000001'
});

const teacher = Object.freeze({
	id: IDS.teacher,
	slug: 'ada-lovelace',
	name: 'Ada Lovelace',
	active: true,
	effectiveActive: true,
	blockedBy: [],
	version: 1
});
const course = Object.freeze({
	id: IDS.course,
	teacherId: IDS.teacher,
	teacherName: 'Ada Lovelace',
	code: 'CSC 205',
	title: 'Data Structures',
	active: true,
	effectiveActive: true,
	blockedBy: [],
	version: 2
});
const bookstore = Object.freeze({
	id: IDS.store,
	name: 'Campus Books',
	serviceFeeCents: 500,
	active: true,
	effectiveActive: true,
	blockedBy: [],
	version: 3
});
const book = Object.freeze({
	id: IDS.book,
	bookstoreId: IDS.store,
	bookstoreName: 'Campus Books',
	title: 'The C Programming Language',
	author: 'Brian Kernighan and Dennis Ritchie',
	isbn: '9780131103627',
	retailerUrl: 'https://shop.example.com/books/c-programming',
	coverUrl: 'https://images.example.com/covers/c-programming.webp',
	priceCents: 4299,
	active: true,
	effectiveActive: true,
	blockedBy: [],
	version: 4
});
const assignment = Object.freeze({
	id: IDS.assignment,
	courseId: IDS.course,
	bookId: IDS.book,
	position: 0,
	courseCode: 'CSC 205',
	courseTitle: 'Data Structures',
	teacherName: 'Ada Lovelace',
	bookTitle: 'The C Programming Language',
	bookstoreName: 'Campus Books',
	active: true,
	effectiveActive: true,
	blockedBy: [],
	version: 5
});
const catalogueEntry = Object.freeze({
	id: IDS.assignment,
	courseId: IDS.course,
	bookId: IDS.book,
	courseCode: '603-101-MQ',
	section: '01',
	title: 'Composition and Literature: Intro to College English',
	instructor: 'Philip Dann',
	author: 'Sayaka Murata',
	bookTitle: 'Convenience Store Woman',
	edition: '',
	isbn: '9780802129628',
	bookstore: "The Book Stop (Follett's), Concordia Loyola",
	notes: '',
	sourceDate: '2026-08-20',
	active: true,
	effectiveActive: true,
	blockedBy: [],
	version: 1
});

function data(resource, overrides = {}) {
	return {
		resource,
		search: '',
		records: [],
		totalCount: 0,
		selected: null,
		mode: null,
		options: {},
		unavailable: false,
		...overrides
	};
}

async function submit(button) {
	const form = button.closest('form');
	const event = new SubmitEvent('submit', {
		bubbles: true,
		cancelable: true,
		submitter: button
	});
	await fireEvent(form, event);
}

afterEach(() => {
	cleanup();
	formMocks.applyAction.mockClear();
	formMocks.enhance.mockClear();
	formMocks.state.result = null;
	navigationMocks.invalidateAll.mockClear();
});

describe('staff catalogue workspace', () => {
	it('renders the five-resource index, search, count, and a ruled teacher table', () => {
		const { container } = render(CataloguePage, {
			props: {
				data: data('teachers', {
					search: 'ada',
					records: [teacher],
					totalCount: 6
				})
			}
		});

		expect(screen.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible();
		expect(screen.getByRole('navigation', { name: 'Catalogue resources' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Entries' })).toHaveAttribute(
			'href',
			'/staff/catalogue/entries'
		);
		expect(screen.getByRole('link', { name: 'Teachers' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('link', { name: 'Assignments' })).toHaveAttribute(
			'href',
			'/staff/catalogue/assignments'
		);
		expect(screen.getByRole('searchbox', { name: 'Search teachers' })).toHaveValue('ada');
		expect(screen.getByText('1 result')).toBeVisible();
		expect(screen.getByText('from 6 total')).toBeVisible();
		expect(screen.getByRole('table', { name: 'Teachers catalogue' })).toBeVisible();
		expect(screen.getByRole('cell', { name: /^Ada Lovelace ada-lovelace$/ })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Edit Ada Lovelace' })).toHaveAttribute(
			'href',
			`/staff/catalogue/teachers?q=ada&edit=${IDS.teacher}`
		);
		expect(container.querySelector('.catalogue-grid')).not.toHaveClass('cards');
	});

	it('shows direct and effective visibility, including inactive ancestry', () => {
		render(CataloguePage, {
			props: {
				data: data('courses', {
					records: [
						{
							...course,
							effectiveActive: false,
							blockedBy: ['teacher']
						}
					],
					totalCount: 1,
					options: { teachers: [teacher] }
				})
			}
		});

		expect(screen.getByText('Direct: Active')).toBeVisible();
		expect(screen.getByText('Public: Hidden')).toBeVisible();
		expect(screen.getByText('Blocked by inactive teacher')).toBeVisible();
	});

	it.each([
		['teachers', teacher, 'Ada Lovelace'],
		['courses', course, 'CSC 205'],
		['bookstores', bookstore, 'Campus Books'],
		['books', book, 'The C Programming Language'],
		['assignments', assignment, 'CSC 205: The C Programming Language'],
		['entries', catalogueEntry, '603-101-MQ 01: Convenience Store Woman']
	])('renders a labeled operational row for %s', (resource, record, accessibleName) => {
		render(CataloguePage, {
			props: {
				data: data(resource, {
					records: [record],
					totalCount: 1,
					options: {
						teachers: [teacher],
						bookstores: [bookstore],
						courses: [course],
						books: [book]
					}
				})
			}
		});
		expect(screen.getByRole('row', { name: new RegExp(accessibleName, 'i') })).toBeVisible();
	});

	it('adds, edits, and displays Mios catalogue entries including blank ISBN and store', () => {
		render(CataloguePage, {
			props: {
				data: data('entries', {
					records: [catalogueEntry],
					totalCount: 1,
					selected: {
						...catalogueEntry,
						isbn: null,
						bookstore: null,
						notes: 'store not named'
					},
					mode: 'edit',
					skippedPacks: [
						{
							instructor: 'Newell',
							courseCode: '603-101-MQ',
							section: '24',
							reason: 'course pack',
							outOfCatalog: true
						}
					],
					source: {
						teacher: 'Mios',
						date: '2026-08-20',
						updatedAtLabel: '19:09 America/Toronto'
					},
					contact: { email: 'team@marihacks.com', instagram: '@marihacks' },
					notices: ['Petruzziello: unnamed independent store with a student discount.'],
					bookstores: [
						{
							name: 'Zone libre',
							address: '262 rue Sainte-Catherine Est (métro Berri-UQAM)',
							notes: 'Laurence Sylvain literary works (10–15% student discount).'
						}
					]
				})
			}
		});

		expect(screen.getByRole('link', { name: 'Entries' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('heading', { level: 2, name: 'Edit catalogue entry' })).toBeVisible();
		expect(screen.getByLabelText('Course code')).toHaveValue('603-101-MQ');
		expect(screen.getByLabelText('Section, optional')).toHaveValue('01');
		expect(screen.getByLabelText('Instructor')).toHaveValue('Philip Dann');
		expect(screen.getByLabelText('Book title')).toHaveValue('Convenience Store Woman');
		expect(screen.getByLabelText('ISBN, optional')).toHaveValue('');
		expect(screen.getByLabelText('Bookstore, optional')).toHaveValue('');
		expect(screen.getByLabelText('Notes, optional')).toHaveValue('store not named');
		expect(screen.getByLabelText('ISBN, optional')).not.toBeRequired();
		expect(screen.getByLabelText('Bookstore, optional')).not.toBeRequired();
		expect(screen.getByText(/teacher Mios, 2026-08-20/)).toBeVisible();
		expect(screen.getByRole('link', { name: 'team@marihacks.com' })).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com'
		);
		expect(screen.getByText(/ · @marihacks/)).toBeVisible();
		expect(screen.getByText(/Petruzziello/)).toBeVisible();
		expect(screen.getByRole('heading', { level: 3, name: 'Out of catalog' })).toBeVisible();
		expect(screen.getByText(/Newell 603-101-MQ 24: course pack/)).toBeVisible();
		expect(screen.getByRole('heading', { level: 3, name: 'Bookstores' })).toBeVisible();
		expect(screen.getByText('Zone libre')).toBeVisible();
		expect(
			screen.getByRole('link', { name: 'Edit 603-101-MQ 01: Convenience Store Woman' })
		).toBeVisible();
	});

	it('shows the unsaved Mios list and a load action when no entries are stored yet', () => {
		render(CataloguePage, {
			props: {
				data: data('entries', {
					sourceEntries: [
						{
							courseCode: '603-103-MQ',
							section: '19',
							title: '(title not in Mio)',
							instructor: 'Blair Morris',
							author: '',
							bookTitle: 'Macbeth',
							edition: '',
							isbn: '',
							bookstore: 'The Book Stop, Concordia Loyola',
							notes: 'class Mio; no edition/ISBN',
							sourceDate: '2026-08-16'
						}
					],
					skippedPacks: [],
					source: { teacher: 'Mios', date: '2026-08-20', updatedAtLabel: '19:09 America/Toronto' },
					contact: { email: 'team@marihacks.com', instagram: '@marihacks' }
				})
			}
		});
		expect(screen.getByText(/Showing the Mios teacher list before it is saved/)).toBeVisible();
		expect(screen.getByRole('cell', { name: /603-103-MQ 19: Macbeth/ })).toBeVisible();
		expect(screen.getByText('Load the teacher list to edit.')).toBeVisible();
		expect(screen.getByRole('button', { name: 'Load Mios teacher list' })).toHaveAttribute(
			'formaction',
			'?/importSource'
		);
		expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
	});

	it('opens a complete book editor with relationship and URL fields', () => {
		render(CataloguePage, {
			props: {
				data: data('books', {
					selected: book,
					mode: 'edit',
					options: { bookstores: [bookstore] }
				})
			}
		});

		expect(screen.getByRole('heading', { level: 2, name: 'Edit book' })).toBeVisible();
		expect(screen.getByLabelText('Bookstore')).toHaveValue(IDS.store);
		expect(screen.getByLabelText('Title')).toHaveValue(book.title);
		expect(screen.getByLabelText('Author, optional')).toHaveValue(book.author);
		expect(screen.getByLabelText('ISBN, optional')).toHaveValue(book.isbn);
		expect(screen.getByLabelText('Retailer URL')).toHaveValue(book.retailerUrl);
		expect(screen.getByLabelText('Cover URL, optional')).toHaveValue(book.coverUrl);
		expect(screen.getByLabelText('Price, CAD')).toHaveValue('42.99');
		expect(screen.getByRole('button', { name: 'Save book' })).toHaveAttribute(
			'formaction',
			'?/update'
		);
		expect(screen.getByDisplayValue(IDS.book)).toHaveAttribute('type', 'hidden');
		expect(screen.getByDisplayValue('4')).toHaveAttribute('type', 'hidden');
	});

	it('keeps assignment identity immutable in edit mode', () => {
		const { container } = render(CataloguePage, {
			props: {
				data: data('assignments', {
					selected: assignment,
					mode: 'edit',
					options: { courses: [course], books: [book] }
				})
			}
		});

		expect(screen.getByText('CSC 205, Data Structures')).toBeVisible();
		expect(screen.getByText('The C Programming Language')).toBeVisible();
		expect(screen.getByLabelText('Position')).toHaveValue(0);
		expect(container.querySelector('select[name="courseId"]')).not.toBeInTheDocument();
		expect(container.querySelector('select[name="bookId"]')).not.toBeInTheDocument();
	});

	it('renders exact create fields and inactive option context for a new course', () => {
		render(CataloguePage, {
			props: {
				data: data('courses', {
					mode: 'add',
					options: {
						teachers: [{ ...teacher, active: false, effectiveActive: false }]
					}
				})
			}
		});

		expect(screen.getByRole('heading', { level: 2, name: 'Add course' })).toBeVisible();
		expect(screen.getByLabelText('Teacher')).toHaveTextContent('Ada Lovelace (inactive)');
		expect(screen.getByLabelText('Course code')).toBeRequired();
		expect(screen.getByLabelText('Course title')).toBeRequired();
		expect(screen.getByRole('button', { name: 'Add course' })).toHaveAttribute(
			'formaction',
			'?/create'
		);
	});

	it('focuses a bounded validation summary and associates field errors', async () => {
		render(CataloguePage, {
			props: {
				data: data('teachers', { mode: 'add' }),
				form: {
					action: 'create',
					errorSummary: 'Check the highlighted fields.',
					fieldErrors: { name: 'Enter a name.' },
					values: { slug: 'ada-lovelace', name: '' }
				}
			}
		});

		const summary = screen.getByRole('alert');
		await waitFor(() => expect(summary).toHaveFocus());
		expect(screen.getAllByRole('alert')).toHaveLength(1);
		expect(summary).toHaveAttribute('aria-live', 'assertive');
		expect(summary).toHaveTextContent('Could not add teacher.');
		expect(summary).toHaveTextContent('Check the highlighted fields.');
		expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'name-error');
		expect(screen.getByText('Enter a name.')).toHaveAttribute('id', 'name-error');
		expect(screen.getByLabelText('Slug')).toHaveValue('ada-lovelace');
	});

	it.each([
		['activate', 409, 'This entry changed. Reload it before saving again.'],
		['activate', 429, 'Too many changes. Wait a moment and try again.'],
		['activate', 503, 'Catalogue changes are unavailable. Try again.'],
		['deactivate', 409, 'This entry changed. Reload it before saving again.'],
		['deactivate', 429, 'Too many changes. Wait a moment and try again.'],
		['deactivate', 503, 'Catalogue changes are unavailable. Try again.']
	])(
		'announces and focuses an enhanced $action failure at $status',
		async (action, status, errorSummary) => {
			const active = action === 'deactivate';
			const record = { ...teacher, active, effectiveActive: active };
			formMocks.state.result = {
				type: 'failure',
				status,
				data: {
					action,
					errorSummary,
					fieldErrors: {},
					values: {},
					selectedId: IDS.teacher
				}
			};
			render(CataloguePage, {
				props: {
					data: data('teachers', { records: [record], totalCount: 1 })
				}
			});
			const actionButton = screen.getByRole('button', {
				name: `${action === 'deactivate' ? 'Deactivate' : 'Activate'} Ada Lovelace`
			});
			await submit(actionButton);

			const summary = await screen.findByRole('alert');
			await waitFor(() => expect(summary).toHaveFocus());
			expect(summary).toHaveAttribute('aria-live', 'assertive');
			expect(summary).toHaveAttribute('aria-atomic', 'true');
			expect(summary).toHaveTextContent(`Could not ${action} Ada Lovelace.`);
			expect(summary).toHaveTextContent(errorSummary);
			expect(screen.queryByText('Saving changes')).not.toBeInTheDocument();
			expect(formMocks.applyAction).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'failure',
					status,
					data: expect.objectContaining({ action, selectedId: IDS.teacher })
				})
			);
			expect(formMocks.enhance).toHaveBeenCalled();
		}
	);

	it('shows a bounded named alert when an enhanced request cannot reach the server', async () => {
		formMocks.state.result = {
			type: 'error',
			status: 500,
			error: new Error('private network detail')
		};
		render(CataloguePage, {
			props: { data: data('teachers', { records: [teacher], totalCount: 1 }) }
		});
		await submit(screen.getByRole('button', { name: 'Deactivate Ada Lovelace' }));

		const summary = await screen.findByRole('alert');
		await waitFor(() => expect(summary).toHaveFocus());
		expect(summary).toHaveTextContent('Could not deactivate Ada Lovelace.');
		expect(summary).toHaveTextContent('The request could not be completed. Try again.');
		expect(summary).not.toHaveTextContent('private network detail');
		expect(formMocks.applyAction).not.toHaveBeenCalled();
		expect(screen.queryByText('Saving changes')).not.toBeInTheDocument();
	});

	it('disables mutations while an enhanced request is pending and restores them afterward', async () => {
		let finish;
		formMocks.state.result = new Promise((resolve) => {
			finish = resolve;
		});
		render(CataloguePage, {
			props: { data: data('teachers', { records: [teacher], totalCount: 1 }) }
		});
		const button = screen.getByRole('button', { name: 'Deactivate Ada Lovelace' });
		await submit(button);

		expect(screen.getByRole('status')).toHaveTextContent('Saving changes');
		expect(button).toBeDisabled();
		finish({
			type: 'failure',
			status: 503,
			data: {
				action: 'deactivate',
				errorSummary: 'Catalogue changes are unavailable. Try again.',
				fieldErrors: {},
				values: {},
				selectedId: IDS.teacher
			}
		});

		await screen.findByRole('alert');
		expect(button).toBeEnabled();
		expect(screen.queryByText('Saving changes')).not.toBeInTheDocument();
	});

	it('applies a successful enhanced result and refreshes catalogue data', async () => {
		formMocks.state.result = {
			type: 'success',
			status: 200,
			data: {
				success: true,
				message: 'Teacher deactivated.',
				selectedId: IDS.teacher
			}
		};
		render(CataloguePage, {
			props: { data: data('teachers', { records: [teacher], totalCount: 1 }) }
		});
		await submit(screen.getByRole('button', { name: 'Deactivate Ada Lovelace' }));

		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent('Teacher deactivated.')
		);
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(formMocks.applyAction).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'success', status: 200 })
		);
		expect(navigationMocks.invalidateAll).toHaveBeenCalledOnce();
	});

	it.each(['applying the result', 'refreshing catalogue data'])(
		'keeps a committed success when %s fails',
		async (clientStep) => {
			formMocks.state.result = {
				type: 'success',
				status: 200,
				data: {
					success: true,
					message: 'Teacher deactivated.',
					selectedId: IDS.teacher
				}
			};
			if (clientStep === 'applying the result') {
				formMocks.applyAction.mockRejectedValueOnce(new Error('private result detail'));
			} else {
				navigationMocks.invalidateAll.mockRejectedValueOnce(new Error('private refresh detail'));
			}
			render(CataloguePage, {
				props: { data: data('teachers', { records: [teacher], totalCount: 1 }) }
			});
			await submit(screen.getByRole('button', { name: 'Deactivate Ada Lovelace' }));

			await waitFor(() =>
				expect(screen.getByRole('status')).toHaveTextContent('Teacher deactivated.')
			);
			expect(screen.queryByRole('alert')).not.toBeInTheDocument();
			expect(document.body).not.toHaveTextContent(/private (result|refresh) detail/u);
			expect(screen.queryByText('Saving changes')).not.toBeInTheDocument();
			expect(formMocks.applyAction).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'success', status: 200 })
			);
			expect(navigationMocks.invalidateAll).toHaveBeenCalledTimes(
				clientStep === 'applying the result' ? 0 : 1
			);
		}
	);

	it('uses a deliberate inline confirmation for deactivation and a POST activation action', () => {
		render(CataloguePage, {
			props: { data: data('teachers', { records: [teacher], totalCount: 1 }) }
		});
		const deactivate = screen.getByRole('button', { name: 'Deactivate Ada Lovelace' });
		expect(deactivate).toHaveAttribute('formaction', '?/deactivate');
		expect(deactivate.closest('form')).toHaveAttribute('method', 'post');
		expect(screen.getByText('Deactivate?')).toBeVisible();

		cleanup();
		render(CataloguePage, {
			props: {
				data: data('teachers', {
					records: [{ ...teacher, active: false, effectiveActive: false }],
					totalCount: 1
				})
			}
		});
		expect(screen.getByRole('button', { name: 'Activate Ada Lovelace' })).toHaveAttribute(
			'formaction',
			'?/activate'
		);
	});

	it('announces saved state, empty results, and repository unavailability without leaking internals', () => {
		const { rerender } = render(CataloguePage, {
			props: {
				data: data('books'),
				form: { success: true, message: 'Book saved.', selectedId: IDS.book }
			}
		});
		expect(screen.getByRole('status')).toHaveTextContent('Book saved.');
		expect(screen.getByText('No books found.')).toBeVisible();
		expect(screen.getAllByRole('link', { name: 'Add book' }).length).toBeGreaterThan(0);

		rerender({ data: data('books', { unavailable: true }), form: null });
		expect(screen.getByRole('alert')).toHaveTextContent('Catalogue data is unavailable.');
		expect(screen.getByRole('link', { name: 'Reload catalogue' })).toBeVisible();
		expect(document.body).not.toHaveTextContent(/database|postgres|secret/i);
	});
});
