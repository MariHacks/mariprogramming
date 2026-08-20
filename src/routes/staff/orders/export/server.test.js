// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { CsvExportError } from '$lib/server/csv.js';
import { StaffOrderUnavailableError } from '$lib/server/orders/staff-repository.js';
import { StaffActionRequestError } from '$lib/server/staff/request.js';
import { _createStaffPurchaseExportHandler } from './+server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});
const RUNTIME = Object.freeze({
	appOrigin: 'https://club.example.com',
	databaseUrl: 'postgresql://staff:secret@db.example.com/club',
	rateLimitHmacKey: 'long-rate-key-long-rate-key-long-rate-key',
	approvedHostnames: ['shop.example.com']
});
const ROWS = Object.freeze([
	Object.freeze({
		bookstore: 'Campus Books',
		title: 'The C Programming Language',
		isbn: '9780131103627',
		quantity: 3
	})
]);

function setup(overrides = {}) {
	const repository = {
		listBookstorePurchaseRows: vi.fn(async () => ROWS),
		...overrides.repository
	};
	const guardMutation = vi.fn(async () => ({
		staff: STAFF,
		form: { intent: 'purchase_list' },
		requestId: '60000000-0000-4000-8000-000000000001',
		runtime: RUNTIME
	}));
	const createRepository = vi.fn(() => repository);
	const buildCsv = vi.fn(
		() =>
			'bookstore,title,ISBN,quantity\r\nCampus Books,The C Programming Language,9780131103627,3\r\n'
	);
	const handler = _createStaffPurchaseExportHandler({
		guardMutation,
		createRepository,
		buildCsv,
		...overrides
	});
	return { handler, repository, guardMutation, createRepository, buildCsv };
}

function event() {
	const url = 'https://club.example.com/staff/orders/export';
	return {
		locals: { staff: STAFF },
		request: new Request(url, { method: 'POST' }),
		url: new URL(url),
		setHeaders: vi.fn()
	};
}

describe('staff bookstore purchase export', () => {
	it('authorizes, rate limits, and returns only the fixed CSV download', async () => {
		const harness = setup();
		const current = event();
		const response = await harness.handler(current);

		expect(harness.guardMutation).toHaveBeenCalledWith(current, {
			action: 'orders_export_purchase_list',
			fields: ['intent'],
			route: '/staff/orders/export'
		});
		expect(harness.createRepository).toHaveBeenCalledWith({
			databaseUrl: RUNTIME.databaseUrl,
			approvedHostnames: RUNTIME.approvedHostnames
		});
		expect(harness.repository.listBookstorePurchaseRows).toHaveBeenCalledOnce();
		expect(harness.buildCsv).toHaveBeenCalledWith(ROWS);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe(
			'attachment; filename="bookstore-purchase-list.csv"'
		);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		const body = await response.text();
		expect(body).toContain('bookstore,title,ISBN,quantity');
		for (const prohibited of [
			'student@example.com',
			'MPC-ABCDEFGH2345',
			'cs_test_secret',
			'10000000-0000-4000-8000-000000000001'
		]) {
			expect(body).not.toContain(prohibited);
		}
	});

	it('rejects an unknown intent before opening the repository', async () => {
		const harness = setup({
			guardMutation: vi.fn(async () => ({
				staff: STAFF,
				form: { intent: 'all_customer_data' },
				requestId: '60000000-0000-4000-8000-000000000001',
				runtime: RUNTIME
			}))
		});
		await expect(harness.handler(event())).rejects.toMatchObject({ status: 400 });
		expect(harness.createRepository).not.toHaveBeenCalled();
	});

	it.each([
		[new StaffActionRequestError(400), 400],
		[new StaffActionRequestError(403), 403],
		[new StaffActionRequestError(413), 413],
		[new StaffActionRequestError(415), 415],
		[new StaffActionRequestError(429, 30), 429],
		[new StaffActionRequestError(503), 503]
	])('returns a bounded HTTP error when the guard rejects with %i', async (failure, status) => {
		const harness = setup({
			guardMutation: vi.fn(async () => {
				throw failure;
			})
		});
		await expect(harness.handler(event())).rejects.toMatchObject({
			status,
			body: { message: expect.not.stringMatching(/student|secret|session/i) }
		});
		expect(harness.createRepository).not.toHaveBeenCalled();
	});

	it.each([
		['database unavailable', new StaffOrderUnavailableError()],
		['invalid generated CSV', new CsvExportError()]
	])('fails closed when %s', async (kind, failure) => {
		const harness = setup(
			kind === 'database unavailable'
				? {
						repository: {
							listBookstorePurchaseRows: vi.fn(async () => {
								throw failure;
							})
						}
					}
				: {
						buildCsv: vi.fn(() => {
							throw failure;
						})
					}
		);
		await expect(harness.handler(event())).rejects.toMatchObject({ status: 503 });
	});

	it('does not hide an unexpected export defect', async () => {
		const defect = new TypeError('programming defect');
		const harness = setup({
			repository: {
				listBookstorePurchaseRows: vi.fn(async () => {
					throw defect;
				})
			}
		});
		await expect(harness.handler(event())).rejects.toBe(defect);
	});

	it('does not hide an unexpected guard defect', async () => {
		const defect = new TypeError('guard programming defect');
		const harness = setup({
			guardMutation: vi.fn(async () => {
				throw defect;
			})
		});
		await expect(harness.handler(event())).rejects.toBe(defect);
	});
});
