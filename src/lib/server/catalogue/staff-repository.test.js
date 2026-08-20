// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	StaffCatalogueConflictError,
	StaffCatalogueUnavailableError,
	StaffCatalogueValidationError,
	createStaffCatalogueRepository,
	normalizeStaffCatalogueInput,
	normalizeStaffCatalogueSearch
} from './staff-repository.js';

const IDS = Object.freeze({
	teacher: '10000000-0000-4000-8000-000000000001',
	otherTeacher: '10000000-0000-4000-8000-000000000002',
	course: '20000000-0000-4000-8000-000000000001',
	store: '30000000-0000-4000-8000-000000000001',
	book: '40000000-0000-4000-8000-000000000001',
	assignment: '50000000-0000-4000-8000-000000000001',
	request: '60000000-0000-4000-8000-000000000001'
});
const NOW = new Date('2026-08-13T17:00:00.000Z');
const actor = Object.freeze({
	userId: 'staff-user-id',
	email: 'team@marihacks.com',
	requestId: IDS.request
});
const HOSTS = ['shop.example.com', 'images.example.com'];

function teacherRow(overrides = {}) {
	return {
		id: IDS.teacher,
		slug: 'ada-lovelace',
		name: 'Ada Lovelace',
		active: true,
		version: 1,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides
	};
}

function courseRow(overrides = {}) {
	return {
		id: IDS.course,
		teacherId: IDS.teacher,
		code: 'CSC 205',
		title: 'Data Structures',
		active: true,
		version: 1,
		createdAt: NOW,
		updatedAt: NOW,
		teacherName: 'Ada Lovelace',
		teacherActive: true,
		...overrides
	};
}

function bookstoreRow(overrides = {}) {
	return {
		id: IDS.store,
		name: 'Campus Books',
		serviceFeeCents: 500,
		active: true,
		version: 1,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides
	};
}

function bookRow(overrides = {}) {
	return {
		id: IDS.book,
		bookstoreId: IDS.store,
		title: 'The C Programming Language',
		author: 'Brian Kernighan and Dennis Ritchie',
		isbn: '9780131103627',
		retailerUrl: 'https://shop.example.com/books/c-programming',
		coverUrl: 'https://images.example.com/covers/c-programming.webp',
		priceCents: 4299,
		active: true,
		version: 1,
		createdAt: NOW,
		updatedAt: NOW,
		bookstoreName: 'Campus Books',
		bookstoreActive: true,
		...overrides
	};
}

function assignmentRow(overrides = {}) {
	return {
		id: IDS.assignment,
		courseId: IDS.course,
		bookId: IDS.book,
		position: 0,
		active: true,
		version: 1,
		createdAt: NOW,
		updatedAt: NOW,
		courseCode: 'CSC 205',
		courseTitle: 'Data Structures',
		courseActive: true,
		teacherName: 'Ada Lovelace',
		teacherActive: true,
		bookTitle: 'The C Programming Language',
		bookActive: true,
		bookstoreName: 'Campus Books',
		bookstoreActive: true,
		...overrides
	};
}

function validBookInput(overrides = {}) {
	return {
		bookstoreId: IDS.store,
		title: 'Book',
		author: '',
		isbn: '',
		retailerUrl: 'https://shop.example.com/book',
		coverUrl: '',
		price: '10.00',
		...overrides
	};
}

function chain(result, operation) {
	const builder = {
		from: vi.fn(() => builder),
		innerJoin: vi.fn(() => builder),
		where: vi.fn(() => builder),
		orderBy: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		for: vi.fn((mode) => {
			operation.lock = mode;
			return builder;
		}),
		values: vi.fn((values) => {
			operation.values = values;
			return builder;
		}),
		set: vi.fn((values) => {
			operation.values = values;
			return builder;
		}),
		returning: vi.fn(() => builder),
		then(resolve, reject) {
			const value = typeof result === 'function' ? result(operation) : result;
			return (value instanceof Error ? Promise.reject(value) : Promise.resolve(value)).then(
				resolve,
				reject
			);
		}
	};
	return builder;
}

/** @param {any[]} results */
function scriptedTransaction(results) {
	const operations = [];
	let call = 0;
	const next = (kind, table) => {
		const operation = { kind, table, lock: null, values: null };
		operations.push(operation);
		return chain(results[call++], operation);
	};
	return {
		transaction: {
			select: vi.fn(() => next('select', null)),
			insert: vi.fn((table) => next('insert', table)),
			update: vi.fn((table) => next('update', table))
		},
		operations
	};
}

function repositoryWith(results) {
	const { transaction, operations } = scriptedTransaction(results);
	const runTransaction = vi.fn((operation) => operation(transaction));
	return {
		repository: createStaffCatalogueRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: HOSTS,
			runTransaction,
			getNow: () => NOW
		}),
		runTransaction,
		operations
	};
}

describe('staff catalogue form normalization', () => {
	it.each([
		[
			'teachers',
			'create',
			{ slug: 'ada-lovelace', name: 'Ada Lovelace' },
			{ slug: 'ada-lovelace', name: 'Ada Lovelace' }
		],
		[
			'courses',
			'create',
			{ teacherId: IDS.teacher, code: 'CSC 205', title: 'Data Structures' },
			{ teacherId: IDS.teacher, code: 'CSC 205', title: 'Data Structures' }
		],
		[
			'bookstores',
			'create',
			{ name: 'Campus Books', serviceFee: '7.00' },
			{ name: 'Campus Books', serviceFeeCents: 700 }
		],
		[
			'books',
			'create',
			{
				bookstoreId: IDS.store,
				title: 'The C Programming Language',
				author: '',
				isbn: '978-0-13-110362-7',
				retailerUrl: 'https://shop.example.com/books/c-programming',
				coverUrl: '',
				price: '42.99'
			},
			{
				bookstoreId: IDS.store,
				title: 'The C Programming Language',
				author: null,
				isbn: '9780131103627',
				retailerUrl: 'https://shop.example.com/books/c-programming',
				coverUrl: null,
				priceCents: 4299
			}
		],
		[
			'assignments',
			'create',
			{ courseId: IDS.course, bookId: IDS.book, position: '12' },
			{ courseId: IDS.course, bookId: IDS.book, position: 12 }
		],
		['assignments', 'update', { position: '1' }, { position: 1 }]
	])('normalizes %s %s without floating point money', (resource, mode, input, expected) => {
		expect(normalizeStaffCatalogueInput(resource, mode, input, new Set(HOSTS))).toEqual(expected);
	});

	it.each([
		['bad slug', 'teachers', 'create', { slug: 'Ada Lovelace', name: 'Ada' }, 'slug'],
		['unknown field', 'teachers', 'create', { slug: 'ada', name: 'Ada', role: 'admin' }, '_form'],
		[
			'missing relationship',
			'courses',
			'create',
			{ teacherId: '', code: 'CSC 205', title: 'Data Structures' },
			'teacherId'
		],
		[
			'fraction with too many cents',
			'books',
			'create',
			{
				bookstoreId: IDS.store,
				title: 'Book',
				author: '',
				isbn: '',
				retailerUrl: 'https://shop.example.com/book',
				coverUrl: '',
				price: '10.001'
			},
			'price'
		],
		[
			'fee below five dollars',
			'bookstores',
			'create',
			{ name: 'Store', serviceFee: '4.99' },
			'serviceFee'
		],
		[
			'fee above seven dollars',
			'bookstores',
			'create',
			{ name: 'Store', serviceFee: '7.01' },
			'serviceFee'
		],
		[
			'invalid ISBN checksum',
			'books',
			'create',
			{
				bookstoreId: IDS.store,
				title: 'Book',
				author: '',
				isbn: '9780131103628',
				retailerUrl: 'https://shop.example.com/book',
				coverUrl: '',
				price: '10.00'
			},
			'isbn'
		],
		[
			'unapproved retailer',
			'books',
			'create',
			{
				bookstoreId: IDS.store,
				title: 'Book',
				author: '',
				isbn: '',
				retailerUrl: 'https://evil.example.net/book',
				coverUrl: '',
				price: '10.00'
			},
			'retailerUrl'
		],
		[
			'assignment identity edit',
			'assignments',
			'update',
			{ courseId: IDS.course, bookId: IDS.book, position: '1' },
			'_form'
		]
	])('rejects %s with a field-specific error', (_label, resource, mode, input, field) => {
		const failure = (() => {
			try {
				return normalizeStaffCatalogueInput(resource, mode, input, new Set(HOSTS));
			} catch (error) {
				return error;
			}
		})();
		expect(failure).toBeInstanceOf(StaffCatalogueValidationError);
		expect(failure.fieldErrors).toHaveProperty(field);
		expect(failure.message).toBe('Catalogue entry is invalid');
	});

	it('accepts valid ISBN-10, normalizes optional separators, and rejects a misplaced X', () => {
		const base = {
			bookstoreId: IDS.store,
			title: 'Book',
			author: '',
			retailerUrl: 'https://shop.example.com/book',
			coverUrl: '',
			price: '0.00'
		};
		expect(
			normalizeStaffCatalogueInput(
				'books',
				'create',
				{ ...base, isbn: '0-306-40615-2' },
				new Set(HOSTS)
			).isbn
		).toBe('0306406152');
		expect(() =>
			normalizeStaffCatalogueInput(
				'books',
				'create',
				{ ...base, isbn: 'X306406152' },
				new Set(HOSTS)
			)
		).toThrow(StaffCatalogueValidationError);
		expect(
			normalizeStaffCatalogueInput(
				'books',
				'create',
				{ ...base, isbn: '080442957X' },
				new Set(HOSTS)
			).isbn
		).toBe('080442957X');
	});

	it.each([
		['unsupported mode', 'teachers', 'remove', { slug: 'ada', name: 'Ada' }, new Set(HOSTS)],
		['null input', 'teachers', 'create', null, new Set(HOSTS)],
		['primitive input', 'teachers', 'create', 'ada', new Set(HOSTS)],
		['array input', 'teachers', 'create', [], new Set(HOSTS)],
		['invalid host set', 'teachers', 'create', { slug: 'ada', name: 'Ada' }, HOSTS]
	])('rejects an invalid normalization envelope: %s', (_label, resource, mode, input, hosts) => {
		expect(() => normalizeStaffCatalogueInput(resource, mode, input, hosts)).toThrow(
			StaffCatalogueValidationError
		);
	});

	it.each([
		['non-string', { slug: 1, name: 'Ada' }, 'slug'],
		['empty', { slug: '', name: 'Ada' }, 'slug'],
		['too long', { slug: 'a'.repeat(121), name: 'Ada' }, 'slug'],
		['surrounding whitespace', { slug: ' ada', name: 'Ada' }, 'slug'],
		['null byte', { slug: 'ad\0a', name: 'Ada' }, 'slug'],
		['carriage return', { slug: 'ad\ra', name: 'Ada' }, 'slug'],
		['line feed', { slug: 'ad\na', name: 'Ada' }, 'slug']
	])('rejects %s text fields', (_label, input, field) => {
		expect(() => normalizeStaffCatalogueInput('teachers', 'create', input, new Set(HOSTS))).toThrow(
			expect.objectContaining({
				fieldErrors: expect.objectContaining({ [field]: expect.any(String) })
			})
		);
	});

	it.each([
		['non-string ISBN', null],
		['oversized ISBN', '1'.repeat(33)],
		['whitespace ISBN', ' 0306406152'],
		['invalid assignment position', '-1']
	])('rejects malformed specialized input: %s', (_label, value) => {
		if (_label.includes('position')) {
			expect(() =>
				normalizeStaffCatalogueInput(
					'assignments',
					'create',
					{ courseId: IDS.course, bookId: IDS.book, position: value },
					new Set(HOSTS)
				)
			).toThrow(
				expect.objectContaining({
					fieldErrors: expect.objectContaining({ position: expect.any(String) })
				})
			);
			return;
		}
		expect(() =>
			normalizeStaffCatalogueInput(
				'books',
				'create',
				validBookInput({ isbn: value }),
				new Set(HOSTS)
			)
		).toThrow(
			expect.objectContaining({
				fieldErrors: expect.objectContaining({ isbn: expect.any(String) })
			})
		);
	});

	it.each([
		['', ''],
		['  Ada  ', 'Ada'],
		['CSC 205', 'CSC 205']
	])('normalizes bounded search %j', (value, expected) => {
		expect(normalizeStaffCatalogueSearch(value)).toBe(expected);
	});

	it.each([null, 'x'.repeat(101), 'line\nbreak', '\0'])('rejects unsafe search %#', (value) => {
		expect(() => normalizeStaffCatalogueSearch(value)).toThrow(StaffCatalogueValidationError);
	});
});

describe('staff catalogue repository reads', () => {
	it('lists all five resources with direct and effective state', async () => {
		const results = [
			[teacherRow()],
			[courseRow({ teacherActive: false })],
			[bookstoreRow()],
			[bookRow({ bookstoreActive: false })],
			[assignmentRow({ courseActive: false, teacherActive: false, bookActive: false, bookstoreActive: false })]
		];
		const { repository, operations } = repositoryWith(results);

		await expect(repository.listStaffCatalogue('teachers', '')).resolves.toEqual({
			records: [expect.objectContaining({ id: IDS.teacher, active: true, effectiveActive: true })],
			totalCount: 1
		});
		await expect(repository.listStaffCatalogue('courses', '')).resolves.toEqual({
			records: [
				expect.objectContaining({
					id: IDS.course,
					active: true,
					effectiveActive: false,
					blockedBy: ['teacher']
				})
			],
			totalCount: 1
		});
		await expect(repository.listStaffCatalogue('bookstores', '')).resolves.toEqual({
			records: [expect.objectContaining({ id: IDS.store, effectiveActive: true })],
			totalCount: 1
		});
		await expect(repository.listStaffCatalogue('books', '')).resolves.toEqual({
			records: [expect.objectContaining({ id: IDS.book, blockedBy: ['bookstore'] })],
			totalCount: 1
		});
		await expect(repository.listStaffCatalogue('assignments', '')).resolves.toEqual({
			records: [
				expect.objectContaining({
					id: IDS.assignment,
					effectiveActive: false,
					blockedBy: ['course', 'teacher', 'book', 'bookstore']
				})
			],
			totalCount: 1
		});
		expect(operations.every(({ lock }) => lock === null)).toBe(true);
	});

	it('filters a bounded list without searching raw URL fields', async () => {
		const { repository } = repositoryWith([
			[
				teacherRow(),
				teacherRow({ id: IDS.otherTeacher, slug: 'grace-hopper', name: 'Grace Hopper' })
			],
			[bookRow()]
		]);
		await expect(repository.listStaffCatalogue('teachers', 'grace')).resolves.toEqual({
			records: [expect.objectContaining({ name: 'Grace Hopper' })],
			totalCount: 2
		});
		await expect(repository.listStaffCatalogue('books', 'shop.example.com')).resolves.toEqual({
			records: [],
			totalCount: 1
		});
	});

	it('searches every staff-facing label while omitting nullable book metadata', async () => {
		const { repository } = repositoryWith([
			[courseRow()],
			[bookstoreRow()],
			[bookRow({ author: null, isbn: null })],
			[assignmentRow({ courseActive: false })]
		]);
		await expect(repository.listStaffCatalogue('courses', 'Ada')).resolves.toMatchObject({
			records: [expect.objectContaining({ id: IDS.course })]
		});
		await expect(repository.listStaffCatalogue('bookstores', 'Campus')).resolves.toMatchObject({
			records: [expect.objectContaining({ id: IDS.store })]
		});
		await expect(repository.listStaffCatalogue('books', 'Campus')).resolves.toMatchObject({
			records: [expect.objectContaining({ author: null, isbn: null })]
		});
		await expect(repository.listStaffCatalogue('assignments', 'Ada')).resolves.toMatchObject({
			records: [
				expect.objectContaining({
					id: IDS.assignment,
					effectiveActive: false,
					blockedBy: ['course']
				})
			]
		});
	});

	it.each([
		['null row', 'teachers', null],
		['primitive row', 'teachers', 'bad'],
		['invalid base id', 'teachers', teacherRow({ id: 'bad' })],
		['invalid base active', 'teachers', teacherRow({ active: 'yes' })],
		['noninteger base version', 'teachers', teacherRow({ version: 1.5 })],
		['nonpositive base version', 'teachers', teacherRow({ version: 0 })],
		['invalid creation date', 'teachers', teacherRow({ createdAt: 'today' })],
		['invalid update date', 'teachers', teacherRow({ updatedAt: 'today' })],
		['non-string stored text', 'teachers', teacherRow({ name: null })],
		['empty stored text', 'teachers', teacherRow({ name: '' })],
		['oversized stored text', 'teachers', teacherRow({ name: 'a'.repeat(161) })],
		['invalid course teacher id', 'courses', courseRow({ teacherId: 'bad' })],
		['invalid course teacher state', 'courses', courseRow({ teacherActive: 'yes' })],
		['noninteger bookstore fee', 'bookstores', bookstoreRow({ serviceFeeCents: 500.5 })],
		['low bookstore fee', 'bookstores', bookstoreRow({ serviceFeeCents: 499 })],
		['high bookstore fee', 'bookstores', bookstoreRow({ serviceFeeCents: 701 })],
		['invalid book store id', 'books', bookRow({ bookstoreId: 'bad' })],
		['invalid book store state', 'books', bookRow({ bookstoreActive: 'yes' })],
		['noninteger book price', 'books', bookRow({ priceCents: 1.5 })],
		['negative book price', 'books', bookRow({ priceCents: -1 })],
		['invalid assignment course id', 'assignments', assignmentRow({ courseId: 'bad' })],
		['invalid assignment book id', 'assignments', assignmentRow({ bookId: 'bad' })],
		['noninteger assignment position', 'assignments', assignmentRow({ position: 1.5 })],
		['negative assignment position', 'assignments', assignmentRow({ position: -1 })],
		['invalid course state', 'assignments', assignmentRow({ courseActive: 'yes' })],
		['invalid teacher state', 'assignments', assignmentRow({ teacherActive: 'yes' })],
		['invalid book state', 'assignments', assignmentRow({ bookActive: 'yes' })],
		['invalid bookstore state', 'assignments', assignmentRow({ bookstoreActive: 'yes' })]
	])('fails closed for corrupt stored data: %s', async (_label, resource, row) => {
		const { repository } = repositoryWith([[row]]);
		await expect(repository.listStaffCatalogue(resource, '')).rejects.toBeInstanceOf(
			StaffCatalogueUnavailableError
		);
	});

	it('loads one exact record and returns null when it does not exist', async () => {
		const { repository, operations } = repositoryWith([[courseRow()], []]);
		await expect(repository.getStaffCatalogueRecord('courses', IDS.course)).resolves.toMatchObject({
			id: IDS.course,
			teacherName: 'Ada Lovelace'
		});
		await expect(repository.getStaffCatalogueRecord('courses', IDS.course)).resolves.toBeNull();
		expect(operations.every(({ lock }) => lock === null)).toBe(true);
	});

	it('rejects unknown resources and oversized storage before returning partial data', async () => {
		const { repository, runTransaction } = repositoryWith([]);
		await expect(repository.listStaffCatalogue('orders', '')).rejects.toBeInstanceOf(
			StaffCatalogueValidationError
		);
		expect(runTransaction).not.toHaveBeenCalled();

		const oversized = repositoryWith([Array.from({ length: 201 }, () => teacherRow())]).repository;
		await expect(oversized.listStaffCatalogue('teachers', '')).rejects.toBeInstanceOf(
			StaffCatalogueUnavailableError
		);
	});

	it('rejects invalid record identifiers and malformed read results', async () => {
		const untouched = repositoryWith([]);
		await expect(
			untouched.repository.getStaffCatalogueRecord('teachers', null)
		).rejects.toBeInstanceOf(StaffCatalogueValidationError);
		await expect(
			untouched.repository.getStaffCatalogueRecord('teachers', 'bad-id')
		).rejects.toBeInstanceOf(StaffCatalogueValidationError);
		expect(untouched.runTransaction).not.toHaveBeenCalled();

		await expect(
			repositoryWith([null]).repository.getStaffCatalogueRecord('teachers', IDS.teacher)
		).rejects.toBeInstanceOf(StaffCatalogueUnavailableError);
		await expect(
			repositoryWith([
				[teacherRow(), teacherRow({ id: IDS.otherTeacher })]
			]).repository.getStaffCatalogueRecord('teachers', IDS.teacher)
		).rejects.toBeInstanceOf(StaffCatalogueUnavailableError);
	});
});

describe('staff catalogue repository configuration', () => {
	it.each([
		['non-string database URL', { databaseUrl: null }],
		['empty database URL', { databaseUrl: '' }],
		['padded database URL', { databaseUrl: ' postgresql://db ' }],
		['invalid transaction runner', { runTransaction: null }],
		['invalid clock', { getNow: null }]
	])('fails closed for %s', (_label, override) => {
		expect(() =>
			createStaffCatalogueRepository({
				databaseUrl: 'postgresql://staff:secret@db.example.com/club',
				approvedHostnames: HOSTS,
				runTransaction: vi.fn(),
				getNow: () => NOW,
				...override
			})
		).toThrow(StaffCatalogueUnavailableError);
	});

	it.each([
		['non-array hosts', null],
		['empty hosts', []],
		['too many hosts', Array.from({ length: 33 }, (_, index) => `shop${index}.example.com`)],
		['duplicate hosts', ['shop.example.com', 'shop.example.com']],
		['malformed host', ['bad host.example.com']]
	])('fails closed for %s', (_label, approvedHostnames) => {
		expect(() =>
			createStaffCatalogueRepository({
				databaseUrl: 'postgresql://staff:secret@db.example.com/club',
				approvedHostnames,
				runTransaction: vi.fn(),
				getNow: () => NOW
			})
		).toThrow(StaffCatalogueUnavailableError);
	});
});

describe('staff catalogue repository mutations', () => {
	it('creates a related course and writes a constrained audit row in the same transaction', async () => {
		const created = courseRow();
		const { repository, operations, runTransaction } = repositoryWith([
			[{ id: IDS.teacher }],
			[created],
			[]
		]);
		await expect(
			repository.createStaffCatalogueRecord(
				'courses',
				{ teacherId: IDS.teacher, code: 'CSC 205', title: 'Data Structures' },
				actor
			)
		).resolves.toMatchObject({ id: IDS.course, version: 1 });
		expect(runTransaction).toHaveBeenCalledOnce();
		expect(operations[0].lock).toBe('key share');
		const audit = operations[2].values;
		expect(audit).toMatchObject({
			resourceType: 'course',
			resourceId: IDS.course,
			actorKind: 'staff',
			staffUserId: actor.userId,
			staffIdentity: actor.email,
			action: 'catalogue.course.created',
			requestId: IDS.request,
			previousState: null,
			nextState: {
				active: true,
				version: 1,
				changedFields: ['code', 'teacherId', 'title']
			}
		});
	});

	it('locks, validates the expected version, updates, increments version, and never audits raw URLs', async () => {
		const updated = bookRow({ title: 'Updated Book', version: 2, updatedAt: NOW });
		const { repository, operations } = repositoryWith([
			[bookRow()],
			[{ id: IDS.store }],
			[updated],
			[]
		]);
		await expect(
			repository.updateStaffCatalogueRecord(
				'books',
				IDS.book,
				1,
				{
					bookstoreId: IDS.store,
					title: 'Updated Book',
					author: 'Brian Kernighan and Dennis Ritchie',
					isbn: '9780131103627',
					retailerUrl: 'https://shop.example.com/books/new-private-path',
					coverUrl: 'https://images.example.com/covers/new-private-path.webp',
					price: '42.99'
				},
				actor
			)
		).resolves.toMatchObject({ id: IDS.book, version: 2 });
		expect(operations[0].lock).toBe('update');
		expect(operations[1].lock).toBe('key share');
		expect(operations[2].values.version).toBe(2);
		const auditText = JSON.stringify(operations[3].values);
		expect(operations[3].values.nextState.changedFields).toEqual([
			'coverUrl',
			'retailerUrl',
			'title'
		]);
		expect(auditText).not.toContain('new-private-path');
		expect(auditText).not.toContain('shop.example.com');
	});

	it('rejects a stale writer after locking without updating or auditing', async () => {
		const { repository, operations } = repositoryWith([[teacherRow({ version: 2 })]]);
		await expect(
			repository.updateStaffCatalogueRecord(
				'teachers',
				IDS.teacher,
				1,
				{ slug: 'ada-lovelace', name: 'Ada Byron' },
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueConflictError);
		expect(operations).toHaveLength(1);
		expect(operations[0].lock).toBe('update');
	});

	it('activates and deactivates only through versioned POST mutations', async () => {
		const { repository, operations } = repositoryWith([
			[teacherRow()],
			[teacherRow({ active: false, version: 2 })],
			[]
		]);
		await expect(
			repository.setStaffCatalogueRecordActive('teachers', IDS.teacher, 1, false, actor)
		).resolves.toMatchObject({ active: false, version: 2 });
		expect(operations[0].lock).toBe('update');
		expect(operations[1].values).toMatchObject({ active: false, version: 2 });
		expect(operations[2].values).toMatchObject({
			action: 'catalogue.teacher.deactivated',
			previousState: { active: true, version: 1 },
			nextState: { active: false, version: 2, changedFields: ['active'] }
		});
	});

	it('rejects missing relationships, no-op edits, no-op active changes, and malformed actor data', async () => {
		const missingRelation = repositoryWith([[]]).repository;
		await expect(
			missingRelation.createStaffCatalogueRecord(
				'courses',
				{ teacherId: IDS.teacher, code: 'CSC 205', title: 'Data Structures' },
				actor
			)
		).rejects.toMatchObject({ fieldErrors: { teacherId: expect.any(String) } });

		const noChange = repositoryWith([[teacherRow()]]).repository;
		await expect(
			noChange.updateStaffCatalogueRecord(
				'teachers',
				IDS.teacher,
				1,
				{ slug: 'ada-lovelace', name: 'Ada Lovelace' },
				actor
			)
		).rejects.toMatchObject({ fieldErrors: { _form: expect.any(String) } });

		const sameState = repositoryWith([[teacherRow()]]).repository;
		await expect(
			sameState.setStaffCatalogueRecordActive('teachers', IDS.teacher, 1, true, actor)
		).rejects.toMatchObject({ fieldErrors: { _form: expect.any(String) } });

		const malformedActor = repositoryWith([]).repository;
		await expect(
			malformedActor.createStaffCatalogueRecord(
				'teachers',
				{ slug: 'ada-lovelace', name: 'Ada Lovelace' },
				{ ...actor, email: 'attacker@example.com' }
			)
		).rejects.toBeInstanceOf(StaffCatalogueValidationError);
	});

	it.each([
		['null actor', null],
		['primitive actor', 'staff'],
		['array actor', []],
		['non-string user id', { ...actor, userId: 1 }],
		['empty user id', { ...actor, userId: '' }],
		['oversized user id', { ...actor, userId: 'u'.repeat(256) }],
		['wrong email', { ...actor, email: 'attacker@example.com' }],
		['non-string request id', { ...actor, requestId: 1 }],
		['invalid request id', { ...actor, requestId: 'bad' }]
	])('rejects %s before opening a transaction', async (_label, invalidActor) => {
		const harness = repositoryWith([]);
		await expect(
			harness.repository.createStaffCatalogueRecord(
				'teachers',
				{ slug: 'ada-lovelace', name: 'Ada Lovelace' },
				invalidActor
			)
		).rejects.toBeInstanceOf(StaffCatalogueValidationError);
		expect(harness.runTransaction).not.toHaveBeenCalled();
	});

	it.each([
		['non-string version', '1'],
		['fractional version', 1.5],
		['nonpositive version', 0]
	])('rejects %s before opening an update transaction', async (_label, version) => {
		const harness = repositoryWith([]);
		await expect(
			harness.repository.updateStaffCatalogueRecord(
				'teachers',
				IDS.teacher,
				version,
				{ slug: 'ada-lovelace', name: 'Ada Byron' },
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueValidationError);
		expect(harness.runTransaction).not.toHaveBeenCalled();
	});

	it.each([
		['missing result', []],
		['null result set', null],
		['invalid id', [{ id: 'bad', version: 1, active: true }]],
		['invalid version', [{ id: IDS.teacher, version: 2, active: true }]],
		['invalid active state', [{ id: IDS.teacher, version: 1, active: false }]]
	])('rolls back a malformed create result: %s', async (_label, createdRows) => {
		const repository = repositoryWith([createdRows]).repository;
		await expect(
			repository.createStaffCatalogueRecord(
				'teachers',
				{ slug: 'ada-lovelace', name: 'Ada Lovelace' },
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueUnavailableError);
	});

	it('checks both assignment relationships with key-share locks', async () => {
		const missingBook = repositoryWith([[{ id: IDS.course }], []]);
		await expect(
			missingBook.repository.createStaffCatalogueRecord(
				'assignments',
				{ courseId: IDS.course, bookId: IDS.book, position: '0' },
				actor
			)
		).rejects.toMatchObject({ fieldErrors: { bookId: expect.any(String) } });
		expect(missingBook.operations.map(({ lock }) => lock)).toEqual(['key share', 'key share']);
	});

	it.each([
		['non-array locked rows', null],
		['missing locked row', []],
		['duplicate locked rows', [teacherRow(), teacherRow({ id: IDS.otherTeacher })]]
	])('rejects update with %s', async (_label, lockedRows) => {
		const repository = repositoryWith([lockedRows]).repository;
		await expect(
			repository.updateStaffCatalogueRecord(
				'teachers',
				IDS.teacher,
				1,
				{ slug: 'ada-lovelace', name: 'Ada Byron' },
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueConflictError);
	});

	it.each([
		['missing updated row', []],
		['wrong updated id', [{ id: IDS.otherTeacher, version: 2 }]],
		['wrong updated version', [{ id: IDS.teacher, version: 3 }]]
	])('rejects a malformed update CAS result: %s', async (_label, updatedRows) => {
		const repository = repositoryWith([[teacherRow()], updatedRows]).repository;
		await expect(
			repository.updateStaffCatalogueRecord(
				'teachers',
				IDS.teacher,
				1,
				{ slug: 'ada-lovelace', name: 'Ada Byron' },
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueConflictError);
	});

	it('rejects malformed active values and stale or missing locked state', async () => {
		const invalidActive = repositoryWith([]);
		await expect(
			invalidActive.repository.setStaffCatalogueRecordActive(
				'teachers',
				IDS.teacher,
				1,
				'false',
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueValidationError);
		expect(invalidActive.runTransaction).not.toHaveBeenCalled();

		await expect(
			repositoryWith([[]]).repository.setStaffCatalogueRecordActive(
				'teachers',
				IDS.teacher,
				1,
				false,
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueConflictError);
		await expect(
			repositoryWith([[teacherRow({ version: 2 })]]).repository.setStaffCatalogueRecordActive(
				'teachers',
				IDS.teacher,
				1,
				false,
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueConflictError);
	});

	it.each([
		['missing active row', []],
		['wrong active row id', [{ id: IDS.otherTeacher, version: 2, active: false }]],
		['wrong active row version', [{ id: IDS.teacher, version: 3, active: false }]],
		['wrong active row state', [{ id: IDS.teacher, version: 2, active: true }]]
	])('rejects a malformed active CAS result: %s', async (_label, updatedRows) => {
		const repository = repositoryWith([[teacherRow()], updatedRows]).repository;
		await expect(
			repository.setStaffCatalogueRecordActive('teachers', IDS.teacher, 1, false, actor)
		).rejects.toBeInstanceOf(StaffCatalogueConflictError);
	});

	it('activates an inactive entry and records the exact action', async () => {
		const { repository, operations } = repositoryWith([
			[teacherRow({ active: false })],
			[teacherRow({ active: true, version: 2 })],
			[]
		]);
		await expect(
			repository.setStaffCatalogueRecordActive('teachers', IDS.teacher, 1, true, actor)
		).resolves.toEqual({ id: IDS.teacher, active: true, version: 2 });
		expect(operations[2].values.action).toBe('catalogue.teacher.activated');
	});

	it('maps uniqueness to validation and redacts audit or database failures', async () => {
		const unique = Object.assign(new Error('duplicate private value'), { code: '23505' });
		const uniqueRepository = repositoryWith([unique]).repository;
		await expect(
			uniqueRepository.createStaffCatalogueRecord(
				'teachers',
				{ slug: 'ada-lovelace', name: 'Ada Lovelace' },
				actor
			)
		).rejects.toBeInstanceOf(StaffCatalogueValidationError);

		const failureRepository = createStaffCatalogueRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: HOSTS,
			runTransaction: vi.fn().mockRejectedValue(new Error('postgresql://private-secret'))
		});
		const failure = await failureRepository
			.listStaffCatalogue('teachers', '')
			.catch((error) => error);
		expect(failure).toBeInstanceOf(StaffCatalogueUnavailableError);
		expect(failure.message).toBe('Staff catalogue is unavailable');
		expect(JSON.stringify(failure)).not.toContain('private-secret');

		for (const rawFailure of [
			null,
			new Error('failure'),
			Object.assign(new Error('failure'), { code: 42 })
		]) {
			const generic = createStaffCatalogueRepository({
				databaseUrl: 'postgresql://staff:secret@db.example.com/club',
				approvedHostnames: HOSTS,
				runTransaction: vi.fn().mockRejectedValue(rawFailure)
			});
			await expect(generic.listStaffCatalogue('teachers', '')).rejects.toBeInstanceOf(
				StaffCatalogueUnavailableError
			);
		}
	});
});
